import http from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { handler } from '../scripts/local-server.mjs';
import { terminalQr } from '../scripts/terminal-qr.mjs';
const fixtures = { valid: [['Código','Descripción','Existencia','Costo','Precio Venta'], ['001234','Café de prueba', 5, 10, 15], ['002','Arroz de prueba',10,8,12]], duplicate: [['Código','Descripción','Existencia'], ['001','A',5], ['001','B',10]] };
const server = http.createServer((request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  if (path === '/__tests.html' || path === '/__tests.js') {
    response.setHeader('Content-Type', path.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8');
    response.end(readFileSync(new URL(path.endsWith('.html') ? './browser.html' : './browser.js', import.meta.url))); return;
  }
  if (path === '/__axe.js' || path === '/__qr-reader.js') {
    response.setHeader('Content-Type', 'text/javascript');
    response.end(readFileSync(new URL(path === '/__axe.js' ? '../node_modules/axe-core/axe.min.js' : '../node_modules/html5-qrcode/html5-qrcode.min.js', import.meta.url))); return;
  }
  if (path === '/__qr.json') { response.setHeader('Content-Type','application/json'); response.end(JSON.stringify(['http://192.168.1.1:5173', 'https://255.255.255.255:65535'].map(url => ({ url, terminal: terminalQr(url) })))); return; }
  if (path.startsWith('/__fixture/')) {
    const name = path.split('/')[2];
    if (!fixtures[name]) { response.writeHead(404); response.end(); return; }
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(fixtures[name]),'Productos');
    response.end(XLSX.write(wb,{type:'buffer',bookType:'xlsx'})); return;
  }
  if (path === '/__results' && request.method === 'POST') {
    let body = ''; request.on('data', chunk => { body += chunk; }); request.on('end', () => { writeFileSync(new URL('./browser-results.json', import.meta.url),body); response.end('OK'); }); return;
  }
  handler(request,response);
});
server.listen(5183,'127.0.0.1', () => console.log('Pruebas locales: http://localhost:5183/__tests.html'));
