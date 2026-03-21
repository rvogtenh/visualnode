// Minimal static server with SSE live-reload and WebSocket support.
// File changes in public/ are watched and broadcast to all connected browsers.

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT   = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript',
  '.css':  'text/css',
  '.glsl': 'text/plain',
  '.json': 'application/json',
};

// ---- SSE live-reload clients -----------------------------------
const clients = new Set();
let debounce;

fs.watch(PUBLIC, { recursive: true }, (_eventType, filename) => {
  if (!filename || filename.includes('.DS_Store')) return;
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    console.log(`  changed: ${filename} — reloading ${clients.size} client(s)`);
    for (const res of clients) {
      try { res.write('data: reload\n\n'); } catch (_) {}
    }
    clients.clear();
  }, 80);
});

// ---- HTTP server -----------------------------------------------
const server = http.createServer((req, res) => {

  // SSE endpoint for live-reload
  if (req.url === '/__reload') {
    res.writeHead(200, {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    });
    res.write('data: connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  // Static file serving
  let filePath = path.join(PUBLIC, req.url === '/' ? 'index.html' : req.url);

  // Prevent path traversal
  if (!filePath.startsWith(PUBLIC)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext  = path.extname(filePath);
    const mime = MIME[ext] || 'application/octet-stream';
    const noCache = mime.startsWith('text/') || mime === 'application/json';
    res.writeHead(200, {
      'Content-Type': mime,
      ...(noCache ? { 'Cache-Control': 'no-store' } : {}),
    });
    res.end(data);
  });

});

server.listen(PORT, () => {
  console.log(`Visual Node  →  http://localhost:${PORT}`);
  console.log(`WebSocket    →  ws://localhost:${PORT}`);
  console.log(`Live-reload active (watching public/)`);
});

// ---- WebSocket server ------------------------------------------
const wsClients = new Set();

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const ws of wsClients) {
    if (ws.readyState === 1 /* OPEN */) {
      try { ws.send(msg); } catch (_) {}
    }
  }
}

let WebSocketServer;
try {
  WebSocketServer = require('ws').Server;
} catch (_) {
  console.warn('[ws] "ws" package not found — WebSocket support disabled. Run: npm install ws');
}

// ---- Shared performance state ----------------------------------
const L2_KEYS = ['q','w','e','r','t','z','u','i'];
const state = {
  scene1: 0, scene2: 0,
  blend: 0.0, blendMode: 0,
  autoMode: -1,        // -1=off, 4=energy, 5=rhythmic, 6=stochastic, 7=algorithmic
  autoLayer: 0,        // 0=all, 1=L1 only, 2=L2 only
  autoIntensity: 0.5,  // fader value in auto mode (0-1)
  paused: false,
};

const AUTO_CYCLE = [-1, 4, 5, 6, 7]; // cycle order for 'a' key

function activateAuto(mode) {
  state.autoIntensity = state.blend;
  state.autoMode = mode;
}

function applyKey(key) {
  const n = parseInt(key);
  if (n >= 1 && n <= 8)  { state.scene1 = n - 1; return true; }
  const l2 = L2_KEYS.indexOf(key.toLowerCase());
  if (l2 >= 0)           { state.scene2 = l2; return true; }
  if (key === 'ArrowUp') {
    if (state.autoMode >= 4) state.autoIntensity = Math.min(1, +(state.autoIntensity + 0.05).toFixed(2));
    else                     state.blend = Math.min(1, +(state.blend + 0.05).toFixed(2));
    return true;
  }
  if (key === 'ArrowDown') {
    if (state.autoMode >= 4) state.autoIntensity = Math.max(0, +(state.autoIntensity - 0.05).toFixed(2));
    else                     state.blend = Math.max(0, +(state.blend - 0.05).toFixed(2));
    return true;
  }
  // Blend modes: b cycles, n/m/,/. direct (b also exits auto)
  if (key === 'b' || key === 'B') { state.blendMode = (state.blendMode + 1) % 4; state.autoMode = -1; return true; }
  if (key === 'n' || key === 'N') { state.blendMode = 0; state.autoMode = -1; return true; }
  if (key === 'm' || key === 'M') { state.blendMode = 1; state.autoMode = -1; return true; }
  if (key === ',')                 { state.blendMode = 2; state.autoMode = -1; return true; }
  if (key === '.')                 { state.blendMode = 3; state.autoMode = -1; return true; }
  // Auto modes: a cycles, s/d/f/g direct
  if (key === 'a' || key === 'A') {
    const idx  = AUTO_CYCLE.indexOf(state.autoMode);
    const next = AUTO_CYCLE[(idx + 1) % AUTO_CYCLE.length];
    if (next === -1) state.autoMode = -1; else activateAuto(next);
    return true;
  }
  if (key === 's' || key === 'S') { activateAuto(4); return true; }
  if (key === 'd' || key === 'D') { activateAuto(5); return true; }
  if (key === 'f' || key === 'F') { activateAuto(6); return true; }
  if (key === 'g' || key === 'G') { activateAuto(7); return true; }
  return false;
}

function applyMidiToState(event) {
  // Note 48-55: Layer 1 scene switch
  if (event.type === 'noteon' && event.note >= 48 && event.note <= 55 && event.value > 0.5)
    { state.scene1 = event.note - 48; return true; }
  // Note 56-63: Layer 2 scene switch
  if (event.type === 'noteon' && event.note >= 56 && event.note <= 63 && event.value > 0.5)
    { state.scene2 = event.note - 56; return true; }
  // CC 48-55 / 56-63: scene switch (CC fallback)
  if (event.name === 'scene1' && event.value > 0.5) { state.scene1 = event.scene; return true; }
  if (event.name === 'scene2' && event.value > 0.5) { state.scene2 = event.scene; return true; }
  // CC 112: master blend / auto intensity
  if (event.name === 'master') {
    if (state.autoMode >= 4) state.autoIntensity = Math.max(0, Math.min(1, event.value));
    else                     state.blend = Math.max(0, Math.min(1, event.value));
    return true;
  }
  // PC 0-3: blend mode + exit auto
  if (event.type === 'pc' && event.scene >= 0 && event.scene <= 3)
    { state.blendMode = event.scene; state.autoMode = -1; return true; }
  // PC 4-7: automation mode (toggle off if same, else activate)
  if (event.type === 'pc' && event.scene >= 4 && event.scene <= 7) {
    if (state.autoMode === event.scene) { state.autoMode = -1; console.log('[auto] off via MIDI'); }
    else { activateAuto(event.scene); console.log(`[auto] mode ${event.scene} activated via MIDI`); }
    return true;
  }
  return false;
}

if (WebSocketServer) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    wsClients.add(ws);
    console.log(`[ws] client connected (total: ${wsClients.size})`);
    // Send current state immediately to new client
    ws.send(JSON.stringify({ type: 'state', ...state }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'key' && applyKey(msg.key)) {
          console.log(`[key] "${msg.key}" → autoMode:${state.autoMode} blend:${state.blend.toFixed(2)}`);
          broadcast({ type: 'state', ...state });
        } else if (msg.type === 'pause') {
          state.paused = true;
          console.log('[pause] paused');
          broadcast({ type: 'pause' });
        } else if (msg.type === 'resume') {
          state.paused = false;
          console.log('[pause] resumed');
          broadcast({ type: 'resume' });
        }
      } catch (err) { console.error('[ws] invalid message:', err.message); }
    });

    ws.on('close', () => {
      wsClients.delete(ws);
      console.log(`[ws] client disconnected (total: ${wsClients.size})`);
    });
  });
}

// ---- Automation engine -----------------------------------------
let autoLastSwitch = 0;
let autoBlendDir   = 1;
let lastAudio      = { onset: [0, 0, 0, 0], bands: [0, 0, 0, 0] };
const AUTO_NAMES   = { 4: 'energy', 5: 'rhythmic', 6: 'stochastic', 7: 'algorithmic' };

function autoSwitch() {
  if (state.autoLayer !== 2) state.scene1 = (state.scene1 + 1) % 8;
  if (state.autoLayer !== 1) state.scene2 = (state.scene2 + 1) % 8;
}
function autoSwitchRandom() {
  if (state.autoLayer !== 2) state.scene1 = Math.floor(Math.random() * 8);
  if (state.autoLayer !== 1) state.scene2 = Math.floor(Math.random() * 8);
}

setInterval(() => {
  if (state.autoMode === -1) return;
  const now       = Date.now();
  const intensity = state.autoIntensity;
  const { onset, bands } = lastAudio;

  // Animate blend (slow oscillation, speed by intensity)
  const blendSpeed = 0.002 + intensity * 0.012;
  state.blend = +Math.max(0, Math.min(1, state.blend + blendSpeed * autoBlendDir)).toFixed(3);
  if (state.blend >= 1) autoBlendDir = -1;
  if (state.blend <= 0) autoBlendDir =  1;

  // Scene switching
  if (state.autoMode === 4) {
    // Energy: onset-triggered, intensity = sensitivity; min 2s cooldown
    const threshold = 0.85 - intensity * 0.60;
    const peak = Math.max(onset[0], onset[1], onset[2], onset[3]);
    if (peak > threshold && now - autoLastSwitch > 2000) {
      autoSwitch(); autoLastSwitch = now;
      console.log(`[auto] energy switch → L1:${state.scene1} L2:${state.scene2}`);
    }
  } else if (state.autoMode === 5) {
    // Rhythmic: fixed interval, intensity = speed (5s–60s)
    const interval = 60000 - intensity * 55000;
    if (now - autoLastSwitch > interval) {
      autoSwitch(); autoLastSwitch = now;
      console.log(`[auto] rhythmic switch → L1:${state.scene1} L2:${state.scene2}`);
    }
  } else if (state.autoMode === 6) {
    // Stochastic: random timing, intensity = frequency (3s–30s avg)
    const avgMs = 30000 - intensity * 27000;
    if (now - autoLastSwitch > avgMs * (0.5 + Math.random())) {
      autoSwitchRandom(); autoLastSwitch = now;
      console.log(`[auto] stochastic switch → L1:${state.scene1} L2:${state.scene2}`);
    }
  } else if (state.autoMode === 7) {
    // Algorithmic: audio-driven scene selection (2s–8s cooldown)
    const cooldown = 8000 - intensity * 6000;
    if (now - autoLastSwitch > cooldown && Math.max(...bands) > 0.05) {
      const bassHeavy = bands[0] > 0.5 && bands[3] < 0.3;
      const highHeavy = bands[3] > 0.4;
      if (bassHeavy) {
        if (state.autoLayer !== 2) state.scene1 = Math.floor(Math.random() * 4);
        if (state.autoLayer !== 1) state.scene2 = Math.floor(Math.random() * 4);
      } else if (highHeavy) {
        if (state.autoLayer !== 2) state.scene1 = 4 + Math.floor(Math.random() * 4);
        if (state.autoLayer !== 1) state.scene2 = 4 + Math.floor(Math.random() * 4);
      } else {
        if (state.autoLayer !== 2) state.scene1 = 2 + Math.floor(Math.random() * 4);
        if (state.autoLayer !== 1) state.scene2 = 2 + Math.floor(Math.random() * 4);
      }
      autoLastSwitch = now;
      console.log(`[auto] algorithmic switch → L1:${state.scene1} L2:${state.scene2}`);
    }
  }

  broadcast({ type: 'state', ...state });
}, 100);

// ---- Audio / MIDI modules --------------------------------------
try {
  const audio = require('./audio.js');
  audio.startAudio(data => {
    broadcast({ type: 'audio', ...data });
    lastAudio = data;
  });
} catch (_) {}

try {
  const midi = require('./midi.js');
  midi.startMidi(event => {
    if (applyMidiToState(event)) broadcast({ type: 'state', ...state });
    broadcast({ type: 'midi', ...event }); // intentional: monitoring/controller page
  });
} catch (_) {}
