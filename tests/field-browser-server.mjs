import http from 'node:http';
import { readFileSync } from 'node:fs';
import { handler } from '../scripts/local-server.mjs';
import { terminalQr } from '../scripts/terminal-qr.mjs';
let results = { status: 'pending' };
http.createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/__field.html') { results = { status: 'pending' }; res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(readFileSync(new URL('./field-browser.html', import.meta.url))); return; }
  if (path === '/__field.js' || path === '/__axe.js' || path === '/__qr-reader.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(readFileSync(new URL({ '/__field.js': './field-browser.js', '/__axe.js': '../node_modules/axe-core/axe.min.js', '/__qr-reader.js': '../node_modules/html5-qrcode/html5-qrcode.min.js' }[path], import.meta.url))); return; }
  if (path === '/__qr.json') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(['http://192.168.1.1:5173', 'https://255.255.255.255:65535'].map(url => ({ url, terminal: terminalQr(url) })))); return; }
  if (path === '/__results') {
    if (req.method === 'POST') { let body=''; req.on('data', part => { body += part; }); req.on('end', () => { results=JSON.parse(body); res.end('OK'); }); }
    else { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(results)); } return;
  }
  handler(req,res);
}).listen(5191,'127.0.0.1',()=>console.log('Pruebas aisladas: http://localhost:5191/__field.html'));
