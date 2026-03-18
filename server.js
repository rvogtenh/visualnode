// Minimal static server — serves public/ on http://localhost:3000
// No dependencies required.

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

http.createServer((req, res) => {
  let filePath = path.join(PUBLIC, req.url === '/' ? 'index.html' : req.url);

  // Security: prevent path traversal
  if (!filePath.startsWith(PUBLIC)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found: ' + req.url);
      return;
    }
    const ext  = path.extname(filePath);
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`Visual Node running at http://localhost:${PORT}`);
});
