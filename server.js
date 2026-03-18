// Minimal static server with SSE live-reload — no dependencies.
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
http.createServer((req, res) => {

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

}).listen(PORT, () => {
  console.log(`Visual Node  →  http://localhost:${PORT}`);
  console.log(`Live-reload active (watching public/)`);
});
