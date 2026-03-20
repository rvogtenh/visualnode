// engine.js — WebGL engine, audio analysis, render loop
// Depends on: GLSL_HELPERS (glsl-helpers.js), SCENES + SCENES2 (scenes/*.js, scenes2/*.js)

(function () {
'use strict';

// ---- DOM -------------------------------------------------------
const canvas    = document.getElementById('canvas');
const startScr  = document.getElementById('start-screen');
const startBtn  = document.getElementById('start-btn');
const statusEl  = document.getElementById('status');
const ui        = document.getElementById('ui');
const infoEl    = document.getElementById('info');
const shaderSel = document.getElementById('shader-select');

// Populate dropdown
SCENES.forEach((s, i) => {
  const opt = document.createElement('option');
  opt.value = i;
  opt.textContent = s.name;
  shaderSel.appendChild(opt);
});

// ---- WebGL -------------------------------------------------------
const gl = canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: false });
if (!gl) { statusEl.textContent = 'WebGL not supported'; return; }

// ---- Render resolution scale ------------------------------------
// Shaders run at RENDER_SCALE × screen resolution, then upscale.
// 0.5 = quarter the pixels → ~4× faster on Pi. Barely visible on blurry shaders.
const RENDER_SCALE = 0.5;
let fboW = 1, fboH = 1;

// ---- FBOs -------------------------------------------------------
let fbos1 = [], fbos2 = [], pingpong1 = 0, pingpong2 = 0;

function createFBO(w, h) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fbo };
}

function recreateFBOs1() {
  fbos1.forEach(f => { gl.deleteTexture(f.tex); gl.deleteFramebuffer(f.fbo); });
  fbos1 = [createFBO(fboW, fboH), createFBO(fboW, fboH)];
  pingpong1 = 0;
}
function recreateFBOs2() {
  fbos2.forEach(f => { gl.deleteTexture(f.tex); gl.deleteFramebuffer(f.fbo); });
  fbos2 = [createFBO(fboW, fboH), createFBO(fboW, fboH)];
  pingpong2 = 0;
}
function recreateFBOs() { recreateFBOs1(); recreateFBOs2(); }

function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  fboW = Math.max(1, Math.floor(canvas.width  * RENDER_SCALE));
  fboH = Math.max(1, Math.floor(canvas.height * RENDER_SCALE));
  gl.viewport(0, 0, canvas.width, canvas.height);
  if (fbos1.length) recreateFBOs();
}
window.addEventListener('resize', resize);

// ---- Shader compilation ----------------------------------------
function compileShader(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s));
  return s;
}

function buildProgram(vsSrc, fsSrc) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compileShader(gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(prog));
  return prog;
}

// ---- Quad ------------------------------------------------------
const quadBuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

function bindQuad(prog) {
  const loc = gl.getAttribLocation(prog, 'a_pos');
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
}

// ---- Build programs --------------------------------------------
const vsSrc = document.getElementById('vs').textContent;

function getUniforms(prog) {
  return {
    time:       gl.getUniformLocation(prog, 'time'),
    resolution: gl.getUniformLocation(prog, 'resolution'),
    bands:      gl.getUniformLocation(prog, 'bands'),
    onset:      gl.getUniformLocation(prog, 'onset'),
    delta:      gl.getUniformLocation(prog, 'delta'),
    backbuffer: gl.getUniformLocation(prog, 'backbuffer'),
  };
}

// Layer 1 programs from SCENES array
const programs1 = SCENES.map(scene => {
  try { return buildProgram(vsSrc, window.GLSL_HELPERS + '\n' + scene.glsl); }
  catch (e) { console.error(`[L1:${scene.name}] compile error:`, e.message); return null; }
});
const uniforms1 = programs1.map(p => p ? getUniforms(p) : null);

// Layer 2 programs from SCENES2 array
const programs2 = SCENES2.map(scene => {
  try { return buildProgram(vsSrc, window.GLSL_HELPERS + '\n' + scene.glsl); }
  catch (e) { console.error(`[L2:${scene.name}] compile error:`, e.message); return null; }
});
const uniforms2 = programs2.map(p => p ? getUniforms(p) : null);

// Blend program — takes both layer FBOs and outputs directly to canvas
const blendFSrc = document.getElementById('fs-blend').textContent;
const blendProg = buildProgram(vsSrc, blendFSrc);
const blendU = {
  layer1: gl.getUniformLocation(blendProg, 'u_layer1'),
  layer2: gl.getUniformLocation(blendProg, 'u_layer2'),
  res:    gl.getUniformLocation(blendProg, 'u_res'),
  blend:  gl.getUniformLocation(blendProg, 'u_blend'),
  mode:   gl.getUniformLocation(blendProg, 'u_mode'),
};

// ---- WebSocket audio/midi source --------------------------------
let wsConnected = false;
let ws = null;

function connectWebSocket() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}`);

  ws.onopen = () => {
    wsConnected = true;
    console.log('[ws] connected — server-side audio/midi active');
  };

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'audio') {
      bands[0] = msg.bands[0]; bands[1] = msg.bands[1];
      bands[2] = msg.bands[2]; bands[3] = msg.bands[3];
      onset[0] = msg.onset[0]; onset[1] = msg.onset[1];
      onset[2] = msg.onset[2]; onset[3] = msg.onset[3];
      delta[0] = msg.delta[0]; delta[1] = msg.delta[1];
      delta[2] = msg.delta[2]; delta[3] = msg.delta[3];
    } else if (msg.type === 'state') {
      if (msg.scene1 !== currentScene[0]) { currentScene[0] = msg.scene1; recreateFBOs1(); }
      if (msg.scene2 !== currentScene[1]) { currentScene[1] = msg.scene2; recreateFBOs2(); }
      blendAmount = msg.blend;
      blendMode   = msg.blendMode;
      shaderSel.value = currentScene[0];
    } else if (msg.type === 'midi') {
      handleMidi(msg);
    }
  };

  ws.onerror = () => { wsConnected = false; };
  ws.onclose = () => {
    wsConnected = false;
    ws = null;
    console.log('[ws] disconnected');
    // retry after 3s
    setTimeout(connectWebSocket, 3000);
  };
}

function handleMidi(msg) {
  // Pushbuttons 64-70 → Layer 1 scene switch
  if (msg.name === 'scene' && msg.value > 0.5) {
    const n = msg.scene;
    if (n >= 0 && n < SCENES.length) {
      currentScene[0] = n;
      shaderSel.value = currentScene[0];
      recreateFBOs1();
    }
  }
  // TODO: CC 56-63 → Layer 2 scene switch (when midi.js updated)
}

// ---- Audio analysis --------------------------------------------
let bands  = [0, 0, 0, 0];
let onset  = [0, 0, 0, 0]; // positive attack (hold + decay), 0..1
let delta  = [0, 0, 0, 0]; // signed per-frame change, amplified
let _prevBands = [0, 0, 0, 0];
let audioCtx, analyser, dataArray;

async function startAudio() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(
        'getUserMedia not available.\n' +
        'Browser blocks microphone access on non-secure origins (HTTP + IP address).\n\n' +
        'Fix options:\n' +
        '  A) SSH tunnel:  ssh -L 3000:localhost:3000 patch@192.168.1.87\n' +
        '     then open:   http://localhost:3000\n\n' +
        '  B) Chrome flag: chrome://flags/#unsafely-treat-insecure-origin-as-secure\n' +
        '     add entry:   http://192.168.1.87:3000'
      );
    }
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const src    = audioCtx.createMediaStreamSource(stream);
    analyser     = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.72;
    src.connect(analyser);
    dataArray = new Float32Array(analyser.frequencyBinCount);
    return true;
  } catch (e) {
    console.error('Audio:', e);
    // Store error name globally so UI can show it
    window._audioError = e.name + ': ' + e.message;
    return false;
  }
}

function getBands() {
  if (!analyser) return;
  analyser.getFloatFrequencyData(dataArray);
  const nyq   = audioCtx.sampleRate / 2;
  const len   = dataArray.length;
  const toIdx = hz => Math.min(Math.round(hz / nyq * len), len - 1);

  function bandRMS(lo, hi) {
    const a = toIdx(lo), b = toIdx(hi);
    let sum = 0, n = 0;
    for (let i = a; i <= b; i++) {
      const lin = Math.pow(10, dataArray[i] / 20);
      sum += lin * lin; n++;
    }
    return Math.sqrt(sum / Math.max(n, 1));
  }

  bands[0] = Math.min(bandRMS(20,   120)  * 6.0, 1.0);
  bands[1] = Math.min(bandRMS(120,  500)  * 4.5, 1.0);
  bands[2] = Math.min(bandRMS(500,  4000) * 3.5, 1.0);
  bands[3] = Math.min(bandRMS(4000, 20000)* 5.5, 1.0);

  // onset: hold-and-decay attack detector per band
  // delta: signed per-frame change (amplified for shader use)
  for (let i = 0; i < 4; i++) {
    const d   = bands[i] - _prevBands[i];
    delta[i]  = Math.max(-1, Math.min(1, d * 8.0));
    const atk = Math.max(0, d) * 7.0;
    onset[i]  = Math.min(1.0, Math.max(atk, onset[i] * 0.65));
    _prevBands[i] = bands[i];
  }
}

// ---- Render loop -----------------------------------------------
let currentScene = [0, 0]; // [layer1_scene_index, layer2_scene_index]
let blendAmount = 0.0;  // 0 = only Layer1, 1 = only Layer2
let blendMode   = 1;    // 0=hardcut, 1=crossfade, 2=additive, 3=multiply
const BLEND_NAMES = ['hardcut', 'crossfade', 'additive', 'multiply'];

let startTime = null;
let frameCount = 0, lastFpsTime = 0, fps = 0;

function render(timestamp) {
  if (!startTime) startTime = timestamp;
  const t = (timestamp - startTime) / 1000.0;

  frameCount++;
  if (timestamp - lastFpsTime > 1000) {
    fps = Math.round(frameCount * 1000 / (timestamp - lastFpsTime));
    frameCount = 0; lastFpsTime = timestamp;
    const n1 = SCENES[currentScene[0]]  ? SCENES[currentScene[0]].name  : '-';
    const n2 = SCENES2[currentScene[1]] ? SCENES2[currentScene[1]].name : '-';
    infoEl.textContent = `fps: ${fps} | L1: ${n1} | L2: ${n2} | blend: ${blendAmount.toFixed(2)} [${BLEND_NAMES[blendMode]}]`;
  }

  if (!wsConnected) getBands();

  // Helper: render one layer into its write FBO
  function renderLayer(programs, uniforms, scene, fbos, pingpong) {
    const prog = programs[scene];
    const u    = uniforms[scene];
    if (!prog || !u) return pingpong;
    const readFBO  = fbos[pingpong];
    const writeFBO = fbos[1 - pingpong];
    gl.bindFramebuffer(gl.FRAMEBUFFER, writeFBO.fbo);
    gl.viewport(0, 0, fboW, fboH);
    gl.useProgram(prog);
    bindQuad(prog);
    gl.uniform1f(u.time, t);
    gl.uniform2f(u.resolution, fboW, fboH);
    gl.uniform4f(u.bands,  bands[0],  bands[1],  bands[2],  bands[3]);
    gl.uniform4f(u.onset,  onset[0],  onset[1],  onset[2],  onset[3]);
    gl.uniform4f(u.delta,  delta[0],  delta[1],  delta[2],  delta[3]);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, readFBO.tex);
    gl.uniform1i(u.backbuffer, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return 1 - pingpong;
  }

  pingpong1 = renderLayer(programs1, uniforms1, currentScene[0], fbos1, pingpong1);
  pingpong2 = renderLayer(programs2, uniforms2, currentScene[1], fbos2, pingpong2);

  // Blend both layers → canvas
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.useProgram(blendProg);
  bindQuad(blendProg);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, fbos1[pingpong1].tex);
  gl.uniform1i(blendU.layer1, 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, fbos2[pingpong2].tex);
  gl.uniform1i(blendU.layer2, 1);
  gl.uniform2f(blendU.res, canvas.width, canvas.height);
  gl.uniform1f(blendU.blend, blendAmount);
  gl.uniform1i(blendU.mode, blendMode);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  requestAnimationFrame(render);
}

// ---- UI / Init -------------------------------------------------
resize();
recreateFBOs();

function autoStart() {
  startScr.style.display = 'none';
  requestAnimationFrame(render);
  document.documentElement.requestFullscreen().catch(() => {});
}

// Try to auto-connect on page load — auto-starts if server responds
connectWebSocket();
statusEl.textContent = 'Connecting to server…';
let autoStartTimer = setTimeout(() => {
  // Server not reachable within 1.5s → show manual start
  statusEl.textContent = 'No server — click START for local audio';
}, 1500);

ws.addEventListener('message', function onFirstMsg(e) {
  const msg = JSON.parse(e.data);
  if (msg.type === 'state' || msg.type === 'audio') {
    clearTimeout(autoStartTimer);
    statusEl.textContent = 'Server audio active';
    autoStart();
    ws.removeEventListener('message', onFirstMsg);
  }
});

startBtn.addEventListener('click', async () => {
  clearTimeout(autoStartTimer);
  if (wsConnected) {
    autoStart();
    return;
  }
  // Fallback: local getUserMedia
  statusEl.textContent = 'Requesting audio…';
  const ok = await startAudio();
  if (ok) {
    autoStart();
  } else {
    statusEl.textContent = 'Audio error: ' + (window._audioError || 'unknown');
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && startScr.style.display !== 'none') startBtn.click();
});

shaderSel.addEventListener('change', () => {
  currentScene[0] = parseInt(shaderSel.value);
  recreateFBOs1();
});

// Performance keys handled server-side (mirrors applyKey() in server.js)
const PERF_KEYS = new Set(['b','B','ArrowUp','ArrowDown',
                           '1','2','3','4','5','6','7','8',
                           'q','w','e','r','t','z','u','i']);

document.addEventListener('keydown', e => {
  if (e.key === 'Tab') { e.preventDefault(); ui.classList.toggle('hidden'); }
  if (e.key === 'h' || e.key === 'H') ui.classList.toggle('hidden');

  if (e.key === 'Backspace') {
    e.preventDefault();
    recreateFBOs();
    infoEl.textContent = 'RESET — ' + new Date().toLocaleTimeString();
  }

  // Performance keys → send to server (syncs all clients + monitoring)
  if (PERF_KEYS.has(e.key)) {
    e.preventDefault();
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'key', key: e.key }));
  }
});

})();
