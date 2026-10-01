import http from 'node:http';
import https from 'node:https';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { execFile } from 'node:child_process';
import { terminalQr } from './terminal-qr.mjs';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.env.AUDITOR_PORT || 5173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Puerto inválido');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const handler = (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    const rel = relative(root, file);
    if (rel.startsWith('..') || rel.includes(':') || !existsSync(file) || !statSync(file).isFile()) { response.writeHead(404); response.end('No encontrado'); return; }
    const body = readFileSync(file);
    response.writeHead(200, {
      'Content-Type': mime[extname(file)] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch { response.writeHead(400); response.end('Solicitud inválida'); }
};
export { handler };
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
if (!existsSync(resolve(root, 'index.html'))) {
  console.error('Falta la aplicación compilada. Abre Iniciar-Auditor.bat.');
  process.exit(1);
}
// Optional locally supplied certificates; no automatic changes to system trust.
const certPath = process.env.AUDITOR_CERT_FILE;
const keyPath = process.env.AUDITOR_KEY_FILE;
if (Boolean(certPath) !== Boolean(keyPath)) { console.error('Configura AUDITOR_CERT_FILE y AUDITOR_KEY_FILE juntos.'); process.exit(1); }
const secure = Boolean(certPath && keyPath);
const server = secure ? https.createServer({ cert: readFileSync(certPath), key: readFileSync(keyPath) }, handler) : http.createServer(handler);
const scheme = secure ? 'https' : 'http';
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? 'El puerto 5173 está ocupado. Cierra el Auditor anterior u otra aplicación que lo use.' : error.message);
  process.exitCode = 1;
});
server.listen(port, process.env.AUDITOR_HOST || '0.0.0.0', () => {
  const localUrl = `${scheme}://localhost:${port}`;
  console.log(`\nAuditor local: ${localUrl}\nMantén esta ventana abierta. Ctrl+C para detener.\n`);
  const addresses = new Set(Object.values(networkInterfaces()).flat().filter(entry => entry && !entry.internal && entry.family === 'IPv4').map(entry => entry.address));
  for (const address of addresses) {
    const url = `${scheme}://${address}:${port}`;
    console.log(`Celular en la misma red Wi-Fi: ${url}`);
    if (process.env.AUDITOR_NO_QR !== '1') console.log(terminalQr(url));
  }
  if (!secure) console.log('En el celular, HTTP permite ingreso manual; cámara y PWA requieren HTTPS con certificado confiable.');
  console.log('Cada navegador guarda su propio conteo. No hay sincronización entre PC y celular.');
  try {
  if (process.platform === 'win32' && process.env.AUDITOR_NO_OPEN !== '1') execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Start-Process '${localUrl}'`], { windowsHide: true }, error => { if (error) console.log(`Abre ${localUrl} en tu navegador.`); });
  } catch { console.log(`Abre ${localUrl} en tu navegador.`); }
});

}
