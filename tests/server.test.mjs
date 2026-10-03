import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeServiceWorker } from '../scripts/sw-manifest.mjs';
import { handler } from '../scripts/local-server.mjs';
const template = "const CACHE = 'auditor-shell-__BUILD_ID__';\nconst ASSETS = /*__PRECACHE__*/ [];\n";
function build(files) {
  const dir = mkdtempSync(join(tmpdir(), 'auditor-sw-'));
  mkdirSync(join(dir, 'assets'));
  for (const [name, body] of Object.entries({ 'sw.js': template, ...files })) writeFileSync(join(dir, name), body);
  return dir;
}
const generated = files => { const dir = build(files); try { writeServiceWorker(dir); return readFileSync(join(dir, 'sw.js'), 'utf8'); } finally { rmSync(dir, { recursive: true, force: true }); } };
test('build service worker gets a version and precaches built assets and the report logo', () => {
  const sw = generated({ 'index.html': '<html>', 'assets/index-abc.js': 'code', 'grid-logo.png': 'png' });
  assert.doesNotMatch(sw, /__BUILD_ID__|__PRECACHE__/);
  const assets = JSON.parse(sw.match(/const ASSETS = (\[.*\]);/)[1]);
  assert.ok(assets.includes('/assets/index-abc.js'));
  assert.ok(assets.includes('/grid-logo.png'));
});
test('service worker version changes when a built file changes', () => {
  const version = sw => sw.match(/auditor-shell-([0-9a-f]+)/)[1];
  assert.equal(version(generated({ 'index.html': 'a' })), version(generated({ 'index.html': 'a' })));
  assert.notEqual(version(generated({ 'index.html': 'a' })), version(generated({ 'index.html': 'b' })));
});
test('service worker install precaches each URL once', async () => {
  const dir = build({ 'index.html': '<html>', 'manifest.json': '{}', 'icon-192.png': 'png', 'assets/index-abc.js': 'code' });
  try {
    writeFileSync(join(dir, 'sw.js'), readFileSync(new URL('../public/sw.js', import.meta.url)));
    writeServiceWorker(dir);
    const listeners = {}, added = [];
    const scope = { addEventListener: (type, listener) => { listeners[type] = listener; } };
    const caches = { open: async () => ({ addAll: async urls => { added.push(...urls); } }) };
    new Function('self', 'caches', readFileSync(join(dir, 'sw.js'), 'utf8'))(scope, caches);
    let installing;
    listeners.install({ waitUntil: promise => { installing = promise; } });
    await installing;
    // Cache.addAll rechaza toda la instalación si una URL se repite.
    assert.equal(new Set(added).size, added.length);
    assert.ok(added.includes('/assets/index-abc.js'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
function request(method, url) {
  return new Promise(resolve => {
    const response = { status: 0, writeHead(status) { this.status = status; return this; }, end() { resolve(this.status); } };
    handler({ method, url }, response);
  });
}
test('local server never serves source files or paths outside dist', async () => {
  for (const path of ['/src/App.tsx', '/package.json', '/..%2fpackage.json', '/%2e%2e%5cpackage.json', '/..%5c..%5cpackage.json']) assert.equal(await request('GET', path), 404, path);
});
test('local server only accepts read requests', async () => assert.equal(await request('POST', '/index.html'), 405));
test('Vercel publishes the same security headers as the local server', async () => {
  const { SECURITY_HEADERS } = await import('../scripts/security-headers.mjs');
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const published = Object.fromEntries(vercel.headers.find(h => h.source === '/(.*)').headers.map(h => [h.key, h.value]));
  assert.deepEqual(published, SECURITY_HEADERS);
  assert.doesNotMatch(SECURITY_HEADERS['Content-Security-Policy'], /unsafe-eval|script-src[^;]*unsafe-inline/);
});
test('local server sends the security headers', async () => {
  const headers = await new Promise(resolve => handler({ method: 'GET', url: '/index.html' }, { writeHead(status, h) { resolve({ status, ...h }); return this; }, end() {} }));
  if (headers.status === 404) return; // Sin build (dist) no hay archivo que servir.
  assert.match(headers['Content-Security-Policy'], /frame-ancestors 'none'/);
  assert.equal(headers['X-Frame-Options'], 'DENY');
});
