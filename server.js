const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

const ROOT   = path.join(__dirname, 'public');
const API_DIR = path.join(__dirname, 'api');
const PORT   = 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.pdf':  'application/pdf',
  '.json': 'application/json',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

// Load API handlers
const apiFiles    = require('./api/files');
const apiGenerate = require('./api/generate');

// Minimal mock for local generate (no GitHub/OpenAI)
function localGenerate(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Geração local desativada. Use o Vercel.' }));
}

const server = http.createServer((req, res) => {
  const { pathname } = url.parse(req.url);
  const decoded = decodeURIComponent(pathname);

  // API routes
  if (decoded === '/api/files') {
    return apiFiles(req, { status: () => ({ json: (d) => { res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify(d)); } }), setHeader: () => {}, status(c) { return { json: (d) => { res.writeHead(c,{'Content-Type':'application/json'}); res.end(JSON.stringify(d)); }}; } });
  }
  if (decoded === '/api/generate' && req.method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Geração disponível apenas no Vercel.' }));
  }

  // Static files from public/
  let filePath = path.join(ROOT, decoded === '/' ? '/index.html' : decoded);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, {'Content-Type':'text/plain'}); return res.end('Not found'); }
    const ext  = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

// Wire up api/files properly
const origFilesHandler = apiFiles;
server.removeAllListeners('request');
server.on('request', (req, res) => {
  const { pathname } = url.parse(req.url);
  const p = decodeURIComponent(pathname);

  const mockRes = (statusCode) => ({
    _code: statusCode,
    setHeader() {},
    status(c) { return mockRes(c); },
    json(d) { res.writeHead(this._code || 200, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}); res.end(JSON.stringify(d)); },
  });

  if (p === '/api/files') return origFilesHandler(req, mockRes(200));
  if (p === '/api/generate' && req.method === 'POST') {
    res.writeHead(200, {'Content-Type':'application/json'});
    return res.end(JSON.stringify({ error: 'Geração disponível apenas no Vercel.' }));
  }
  if (p === '/api/version') {
    const pkg = require('./package.json');
    res.writeHead(200, {'Content-Type':'application/json'});
    return res.end(JSON.stringify({ version: pkg.version, commit: 'local', deployedAt: null }));
  }
  if (p === '/api/instagram' && req.method === 'POST') {
    res.writeHead(200, {'Content-Type':'application/json'});
    return res.end(JSON.stringify({ error: 'Publicação disponível apenas no Vercel.' }));
  }

  let filePath = path.join(ROOT, p === '/' ? '/index.html' : p);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end(); }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`\n  Hub rodando em: http://localhost:${PORT}\n`));
