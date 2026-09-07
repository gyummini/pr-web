const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.md': 'text/plain', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.woff2': 'font/woff2' };
http.createServer((req, res) => {
  let file;
  try { file = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0])); }
  catch { res.writeHead(400); res.end(); return; }
  if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403); res.end(); return; }
  if (!path.extname(file)) file = path.join(root, 'index.html');
  fs.readFile(file, (error, content) => {
    if (error) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(content);
  });
}).listen(4173, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:4173/evidence'));
