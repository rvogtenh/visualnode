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
    res.writeHead(200, { 'Content-Type': mime });
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
const state = { scene1: 0, scene2: 0, blend: 0.0, blendMode: 1 };

function applyKey(key) {
  const n = parseInt(key);
  if (n >= 1 && n <= 8)           { state.scene1 = n - 1; return true; }
  const l2 = L2_KEYS.indexOf(key.toLowerCase());
  if (l2 >= 0)                    { state.scene2 = l2;    return true; }
  if (key === 'ArrowUp')   { state.blend = Math.min(1, +(state.blend + 0.05).toFixed(2)); return true; }
  if (key === 'ArrowDown') { state.blend = Math.max(0, +(state.blend - 0.05).toFixed(2)); return true; }
  if (key === 'b' || key === 'B') { state.blendMode = (state.blendMode + 1) % 4; return true; }
  return false;
}

function applyMidiToState(event) {
  // CC 64-71: Layer 1 scene switch
  if (event.name === 'scene1' && event.value > 0.5)
    { state.scene1 = event.scene; return true; }
  // CC 56-63: Layer 2 scene switch
  if (event.name === 'scene2' && event.value > 0.5)
    { state.scene2 = event.scene; return true; }
  // CC 112: master blend
  if (event.name === 'master')
    { state.blend = Math.max(0, Math.min(1, event.value)); return true; }
  // PC 0-3: blend mode (hardcut / crossfade / additive / multiply)
  if (event.type === 'pc' && event.scene >= 0 && event.scene <= 3)
    { state.blendMode = event.scene; return true; }
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
          broadcast({ type: 'state', ...state });
        }
      } catch (err) { console.error('[ws] invalid message:', err.message); }
    });

    ws.on('close', () => {
      wsClients.delete(ws);
      console.log(`[ws] client disconnected (total: ${wsClients.size})`);
    });
  });
}

// ---- Audio / MIDI modules --------------------------------------
try {
  const audio = require('./audio.js');
  audio.startAudio(data => broadcast({ type: 'audio', ...data }));
} catch (_) {}

try {
  const midi = require('./midi.js');
  midi.startMidi(event => {
    if (applyMidiToState(event)) broadcast({ type: 'state', ...state });
    broadcast({ type: 'midi', ...event }); // intentional: monitoring/controller page
  });
} catch (_) {}
