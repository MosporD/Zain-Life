// Tiny static server for previewing www/ in a browser during development.
// Usage: node dev-server.js            ->  http://localhost:5173  (Zain Life)
//        node dev-server.js personal   ->  the same app as the personal brand, rebranded on the fly
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, 'www');
const port = 5173;
const brandId = process.argv[2];
const brand = brandId && require('./tools/brand.js');
const B = brand && brand.load(brandId), SRC = brand && brand.source();
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const file = path.normalize(path.join(root, urlPath === '/' ? 'index.html' : urlPath));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    if (brand) data = brand.transformFile(path.relative(root, file), data, B, SRC);
    if (data === null) { res.writeHead(404); return res.end('Not in this brand'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(port, '127.0.0.1', () => console.log(`${B ? B.name : 'Zain Life'} preview on http://localhost:${port}`));
