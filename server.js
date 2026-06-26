const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = __dirname;
const PORT = 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.pdf':  'application/pdf',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

function scanDir(rootPath) {
  const result = [];
  try {
    const entries = fs.readdirSync(rootPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      if (entry.isDirectory()) {
        const files = scanFiles(path.join(rootPath, entry.name), entry.name);
        if (files.length > 0) {
          result.push({ folder: entry.name, files });
        }
      }
    }
  } catch (e) { /* ignore */ }
  return result;
}

function scanFiles(dirPath, folderName) {
  const files = [];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (ext === '.html' || ext === '.pdf') {
          files.push({
            name: entry.name,
            path: `/${folderName}/${entry.name}`,
            ext: ext.replace('.', ''),
          });
        }
      }
    }
  } catch (e) { /* ignore */ }
  return files.sort((a, b) => a.name.localeCompare(b.name));
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);
  let pathname = decodeURIComponent(parsed.pathname);

  // API endpoint
  if (pathname === '/api/files') {
    const data = scanDir(ROOT);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(data));
    return;
  }

  // Serve hub
  if (pathname === '/' || pathname === '/index.html') {
    pathname = '/hub.html';
  }

  const filePath = path.join(ROOT, pathname);

  // Security: stay within ROOT
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  Hub de Documentos rodando em: http://localhost:${PORT}\n`);
});
