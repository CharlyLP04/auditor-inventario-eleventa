import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditDataLoaded, summarizeSync, SYNC_SOURCES, sharedAuditId, auditLink } from '../src/services/cloud/teamState.ts';
const confirmed = () => Object.fromEntries(SYNC_SOURCES.map(key => [key, { fromCache: false, hasPendingWrites: false }]));
test('equipo: no declara sincronización antes de recibir todos los datos del servidor', () => {
  assert.equal(summarizeSync({}).confirmed, false);
  const data = confirmed(); delete data.catalog;
  assert.equal(summarizeSync(data).confirmed, false);
  assert.deepEqual(summarizeSync(confirmed()), { confirmed: true, pending: false });
});
test('equipo: recupera pendientes de metadatos aunque el contador en memoria se reinicie', () => {
  const data = confirmed(); data.counts = { fromCache: true, hasPendingWrites: true };
  assert.deepEqual(summarizeSync(data), { confirmed: false, pending: true });
  data.counts = { fromCache: true, hasPendingWrites: false };
  assert.deepEqual(summarizeSync(data), { confirmed: false, pending: false });
  data.counts = { fromCache: false, hasPendingWrites: false };
  assert.deepEqual(summarizeSync(data), { confirmed: true, pending: false });
});
test('equipo: espera también notas, departamentos y no encontrados pendientes', () => {
  for (const key of SYNC_SOURCES) {
    const data = confirmed(); data[key].hasPendingWrites = true;
    assert.deepEqual(summarizeSync(data), { confirmed: false, pending: true });
  }
});
test('equipo: el enlace conserva el origen y abre la auditoría indicada', () => {
  const url = new URL(auditLink('https://auditor.example/app?old=1#section', 'tienda_2026-10'));
  assert.equal(url.origin, 'https://auditor.example'); assert.equal(url.pathname, '/app');
  assert.equal(url.hash, ''); assert.equal(url.searchParams.has('old'), false);
  assert.equal(sharedAuditId(url.search), 'tienda_2026-10');
});
test('equipo: rechaza enlaces sin auditoría o con rutas de documentos inválidas', () => {
  for (const value of ['', '?audit=', '?audit=..', '?audit=foo%2Fbar', '?audit=' + 'a'.repeat(301)]) assert.equal(sharedAuditId(value), null);
});

test('no muestra ceros mientras faltan contadores o colecciones', () => {
  assert.equal(auditDataLoaded({}, 2, 2, 16), false);
  assert.equal(auditDataLoaded(confirmed(), 2, 1, 16), false);
  assert.equal(auditDataLoaded(confirmed(), 2, 2, 15), false);
  assert.equal(auditDataLoaded(confirmed(), 2, 2, 16), true);
});
