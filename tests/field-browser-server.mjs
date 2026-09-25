import http from 'node:http';
import { readFileSync } from 'node:fs';
import { handler } from '../scripts/local-server.mjs';
let results = { status: 'pending' };
http.createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/__field.html') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(readFileSync(new URL('./field-browser.html', import.meta.url))); return; }
  if (path === '/__field.js' || path === '/__axe.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(readFileSync(new URL(path === '/__field.js' ? './field-browser.js' : '../node_modules/axe-core/axe.min.js', import.meta.url))); return; }
  if (path === '/__results') {
    if (req.method === 'POST') { let body=''; req.on('data', part => { body += part; }); req.on('end', () => { results=JSON.parse(body); res.end('OK'); }); }
    else { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(results)); } return;
  }
  handler(req,res);
}).listen(5191,'127.0.0.1',()=>console.log('Pruebas aisladas: http://localhost:5191/__field.html'));
