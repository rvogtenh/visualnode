// engine.js — WebGL engine, audio analysis, render loop
// Depends on: GLSL_HELPERS (glsl-helpers.js), SCENES (scenes/*.js)

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

// ---- Resize + FBOs ----------------------------------------------
let fbos = [], pingpong = 0;

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

function recreateFBOs() {
  fbos.forEach(f => { gl.deleteTexture(f.tex); gl.deleteFramebuffer(f.fbo); });
  const w = canvas.width, h = canvas.height;
  fbos = [createFBO(w, h), createFBO(w, h)];
  pingpong = 0;
}

function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  gl.viewport(0, 0, canvas.width, canvas.height);
  if (fbos.length) recreateFBOs();
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
const vsSrc    = document.getElementById('vs').textContent;
const blitFSrc = document.getElementById('fs-blit').textContent;

const programs = SCENES.map(scene => {
  try {
    return buildProgram(vsSrc, window.GLSL_HELPERS + '\n' + scene.glsl);
  } catch (e) {
    console.error(`[${scene.name}] compile error:`, e.message);
    return null;
  }
});

function getUniforms(prog) {
  return {
    time:       gl.getUniformLocation(prog, 'time'),
    resolution: gl.getUniformLocation(prog, 'resolution'),
    bands:      gl.getUniformLocation(prog, 'bands'),
    backbuffer: gl.getUniformLocation(prog, 'backbuffer'),
  };
}

const uniforms     = programs.map(p => p ? getUniforms(p) : null);
const blitProg     = buildProgram(vsSrc, blitFSrc);
const blitUniforms = {
  tex: gl.getUniformLocation(blitProg, 'u_tex'),
  res: gl.getUniformLocation(blitProg, 'u_res'),
};

// ---- Audio analysis --------------------------------------------
let bands = [0, 0, 0, 0];
let audioCtx, analyser, dataArray;

async function startAudio() {
  try {
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
}

// ---- Render loop -----------------------------------------------
let currentScene = 0;
let startTime = null;
let frameCount = 0, lastFpsTime = 0, fps = 0;

function render(timestamp) {
  if (!startTime) startTime = timestamp;
  const t = (timestamp - startTime) / 1000.0;

  frameCount++;
  if (timestamp - lastFpsTime > 1000) {
    fps = Math.round(frameCount * 1000 / (timestamp - lastFpsTime));
    frameCount = 0; lastFpsTime = timestamp;
    infoEl.textContent =
      `fps: ${fps} | bass: ${bands[0].toFixed(2)} | mid: ${bands[2].toFixed(2)} | high: ${bands[3].toFixed(2)}`;
  }

  getBands();

  const prog = programs[currentScene];
  const u    = uniforms[currentScene];
  if (!prog || !u) { requestAnimationFrame(render); return; }

  const w = canvas.width, h = canvas.height;
  const readFBO  = fbos[pingpong];
  const writeFBO = fbos[1 - pingpong];

  // Scene → writeFBO
  gl.bindFramebuffer(gl.FRAMEBUFFER, writeFBO.fbo);
  gl.viewport(0, 0, w, h);
  gl.useProgram(prog);
  bindQuad(prog);
  gl.uniform1f(u.time, t);
  gl.uniform2f(u.resolution, w, h);
  gl.uniform4f(u.bands, bands[0], bands[1], bands[2], bands[3]);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, readFBO.tex);
  gl.uniform1i(u.backbuffer, 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  // Blit → canvas
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, w, h);
  gl.useProgram(blitProg);
  bindQuad(blitProg);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, writeFBO.tex);
  gl.uniform1i(blitUniforms.tex, 0);
  gl.uniform2f(blitUniforms.res, w, h);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  pingpong = 1 - pingpong;
  requestAnimationFrame(render);
}

// ---- UI / Init -------------------------------------------------
resize();
recreateFBOs();

startBtn.addEventListener('click', async () => {
  statusEl.textContent = 'Requesting audio…';
  const ok = await startAudio();
  if (ok) {
    startScr.style.display = 'none';
    ui.classList.remove('hidden');
    requestAnimationFrame(render);
  } else {
    statusEl.textContent = 'Microphone access denied. Check browser permissions.';
  }
});

shaderSel.addEventListener('change', () => {
  currentScene = parseInt(shaderSel.value);
  recreateFBOs();
});

document.addEventListener('keydown', e => {
  if (e.key === 'h' || e.key === 'H') ui.classList.toggle('hidden');
  const n = parseInt(e.key);
  if (n >= 1 && n <= SCENES.length) {
    currentScene = n - 1;
    shaderSel.value = currentScene;
    recreateFBOs();
  }
});

})();
