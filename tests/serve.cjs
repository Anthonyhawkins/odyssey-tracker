const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.resolve(__dirname, '../index.html'));
// Browser-test-only origin: serves the prototype and a simple embedding host.
// No repository data directories or personal storage are exposed.
http.createServer((request, response) => {
  if (request.url === '/map.png') { response.writeHead(200, { 'Content-Type': 'image/png' }); response.end(fs.readFileSync(path.resolve(__dirname, '../map.png'))); return; }
  if (['/assets/tailwind.js', '/assets/local-app.js', '/assets/print-export.js'].includes(request.url)) { response.writeHead(200, { 'Content-Type': 'text/javascript' }); response.end(fs.readFileSync(path.resolve(__dirname, '..' + request.url))); return; }
  if (request.url === '/health') { response.writeHead(200); response.end('ok'); return; }
  if (request.url === '/embed') {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end('<!doctype html><html><body style="margin:0"><iframe title="Quest preview" src="/" style="width:100vw;height:100vh;border:0"></iframe></body></html>'); return;
  }
  if (request.url === '/' || request.url === '/index.html') {
    response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' }); response.end(html); return;
  }
  response.writeHead(404); response.end('Not found');
}).listen(8765, '127.0.0.1');
