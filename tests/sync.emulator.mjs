// Escenarios de dos personas contando la misma auditoría, con dos clientes reales del SDK contra el emulador.
// Ejecutar con: npm run test:cloud
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, disableNetwork, enableNetwork, waitForPendingWrites, onSnapshot, writeBatch } from 'firebase/firestore';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  createCompany, createCloudAudit, recordCapture, undoCapture, registerUnregistered, editUnregistered, setUnregisteredExcluded,
  linkUnregistered, claimDepartment, releaseDepartment, setDepartmentStatus, reassignDepartment, setAuditStatus, readAuditState, readCaptures, auditRefs,
} from '../src/services/cloud/repository.ts';
import { verifyIntegrity } from '../src/services/cloud/model.ts';
import { calculateStats } from '../src/services/auditState.ts';

const project = 'demo-auditor';
const apps = [];
let env, oscar, charly, auditId;
async function client(name, email) {
  const app = initializeApp({ projectId: project, apiKey: 'demo-key', authDomain: 'localhost' }, name);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = initializeFirestore(app, {});
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const { user } = await createUserWithEmailAndPassword(auth, email, 'contraseña-de-prueba');
  return { db, uid: user.uid };
}
const catalog = [
  { code: '001', description: 'Leche entera', cost: 10, price: 20, department: 'Lácteos', theoreticalStock: 30, physicalStock: 0, counted: false },
  { code: '002', description: 'Yogur', cost: 5, price: 9, department: 'Lácteos', theoreticalStock: 10, physicalStock: 0, counted: false },
  { code: '101', description: 'Arroz', cost: 12, price: 25, department: 'Abarrotes', theoreticalStock: 50, physicalStock: 0, counted: false },
  { code: '102', description: 'Frijol', cost: 14, price: 28, department: 'Abarrotes', theoreticalStock: 40, physicalStock: 0, counted: false },
];
const report = { headerRow: 0, headers: ['Código', 'Descripción', 'Existencia'], mapping: { code: 0, sku: -1, description: 1, stock: 2, cost: -1, price: -1, wholesale: -1, minimum: -1, department: -1, unit: -1 }, fileRows: 6, imported: 4, issues: [{ row: 5, code: '001', reason: 'código duplicado: igual que la fila 2' }, { row: 7, reason: 'falta un código válido' }], unusedColumns: ['Marca'], warnings: [], fileName: 'catalogo.csv' };
const state = async who => readAuditState(who.db, auditId);
const product = async (who, code) => (await state(who)).products.find(p => p.code === code);
const until = async (predicate, message) => { const end = Date.now() + 10000; while (Date.now() < end) { if (await predicate()) return; await new Promise(r => setTimeout(r, 50)); } throw new Error(message); };

before(async () => {
  env = await initializeTestEnvironment({ projectId: project, firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 } });
  await env.clearFirestore();
  const o = await client('oscar', 'oscar@grid.test'), c = await client('charly', 'charly@grid.test');
  oscar = { ...o, user: { uid: o.uid, name: 'Oscar', role: 'admin' } };
  charly = { ...c, user: { uid: c.uid, name: 'Charly', role: 'admin' } };
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), `members/${oscar.uid}`), { name: 'Oscar', role: 'admin', active: true });
    await setDoc(doc(context.firestore(), `members/${charly.uid}`), { name: 'Charly', role: 'admin', active: true });
  });
  const companyId = await createCompany(oscar.db, oscar.user, { name: 'Tienda de prueba' });
  auditId = await createCloudAudit(oscar.db, oscar.user, { companyId, period: '2026-11', products: catalog, report });
});
after(async () => { for (const app of apps) await deleteApp(app); await env?.cleanup(); });

test('1 · las dos personas entran a la misma auditoría y ven el mismo catálogo', async () => {
  const [a, b] = await Promise.all([state(oscar), state(charly)]);
  assert.equal(a.products.length, 4);
  assert.deepEqual(a.products.map(p => p.code).sort(), b.products.map(p => p.code).sort());
  assert.equal(a.audit.catalog.report.issues.length, 2, 'el reporte de importación (filas omitidas) se conserva en la auditoría');
});
test('10 · una auditoría no se duplica para la misma empresa y mes', async () => {
  const { companyId } = (await getDoc(auditRefs(oscar.db, auditId).audit)).data();
  await assert.rejects(createCloudAudit(oscar.db, oscar.user, { companyId, period: '2026-11', products: catalog, report }), /Ya existe/);
});
test('2 · cada persona toma departamentos distintos y nadie toma el ajeno', async () => {
  await claimDepartment(oscar.db, oscar.user, auditId, 'Lácteos');
  await claimDepartment(charly.db, charly.user, auditId, 'Abarrotes');
  await assert.rejects(claimDepartment(charly.db, charly.user, auditId, 'Lácteos'), /Oscar/);
  const departments = (await state(oscar)).departments;
  assert.equal(departments.find(d => d.name === 'Lácteos').assigneeName, 'Oscar');
  assert.equal(departments.find(d => d.name === 'Abarrotes').assigneeName, 'Charly');
});
test('2b · si dos personas toman el mismo departamento al mismo tiempo, solo una lo consigue', async () => {
  await env.withSecurityRulesDisabled(async context => { await setDoc(doc(context.firestore(), `audits/${auditId}/departments/d_${encodeURIComponent('Bodega')}`), { name: 'Bodega', assignee: null, assigneeName: null, status: 'pending' }); });
  const results = await Promise.allSettled([claimDepartment(oscar.db, oscar.user, auditId, 'Bodega'), claimDepartment(charly.db, charly.user, auditId, 'Bodega')]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1, JSON.stringify(results.map(r => r.status)));
});
test('3 · escaneos simultáneos de productos distintos se registran completos', async () => {
  const writes = [];
  for (let i = 0; i < 20; i++) writes.push(recordCapture(oscar.db, oscar.user, auditId, { code: '001', quantity: 1, mode: 'add', current: { physicalStock: i }, department: 'Lácteos' }).committed);
  for (let i = 0; i < 20; i++) writes.push(recordCapture(charly.db, charly.user, auditId, { code: '101', quantity: 2, mode: 'add', current: { physicalStock: i * 2 }, department: 'Abarrotes' }).committed);
  await Promise.all(writes);
  assert.equal((await product(oscar, '001')).physicalStock, 20);
  assert.equal((await product(charly, '101')).physicalStock, 40);
});
test('4 · las dos personas suman al mismo producto al mismo tiempo sin perder conteos', async () => {
  const writes = [];
  for (let i = 0; i < 25; i++) {
    writes.push(recordCapture(oscar.db, oscar.user, auditId, { code: '002', quantity: 1, mode: 'add', current: { physicalStock: 0 }, department: 'Lácteos' }).committed);
    writes.push(recordCapture(charly.db, charly.user, auditId, { code: '002', quantity: 1, mode: 'add', current: { physicalStock: 0 }, department: 'Lácteos', outsideAssignment: true }).committed);
  }
  await Promise.all(writes);
  const yogur = await product(oscar, '002');
  assert.equal(yogur.physicalStock, 50);
  assert.deepEqual((await state(oscar)).contributors['002'].sort(), [charly.uid, oscar.uid].sort(), 'el producto queda marcado con las dos personas que lo contaron');
});
test('5 · una corrección se refleja en el otro teléfono sin recargar', async () => {
  let seen = null;
  const stop = onSnapshot(auditRefs(oscar.db, auditId).counts, snapshot => { for (const d of snapshot.docs) { const q = d.data().q ?? {}; if ('102' in q) seen = q['102']; } });
  const current = await product(charly, '102');
  await recordCapture(charly.db, charly.user, auditId, { code: '102', quantity: 37, mode: 'set', current, department: 'Abarrotes' }).committed;
  await until(() => seen === 37, `Oscar ve ${seen} en lugar de 37`);
  stop();
});
test('6 y 7 · sin conexión se sigue contando y al reconectar se sincroniza la cola sin pérdidas', async () => {
  const before = (await product(charly, '101')).physicalStock;
  await disableNetwork(charly.db);
  const pending = [];
  for (let i = 0; i < 5; i++) pending.push(recordCapture(charly.db, charly.user, auditId, { code: '101', quantity: 1, mode: 'add', current: { physicalStock: before + i }, department: 'Abarrotes' }).committed);
  await recordCapture(oscar.db, oscar.user, auditId, { code: '101', quantity: 3, mode: 'add', current: { physicalStock: before }, department: 'Abarrotes', outsideAssignment: true }).committed;
  let settled = false; void Promise.all(pending).then(() => { settled = true; });
  await new Promise(r => setTimeout(r, 300));
  assert.equal(settled, false, 'sin red las capturas deben quedar pendientes, no confirmadas');
  await enableNetwork(charly.db);
  await waitForPendingWrites(charly.db);
  await Promise.all(pending);
  assert.equal((await product(oscar, '101')).physicalStock, before + 8);
});
test('8 · el mismo no encontrado registrado desde ambos teléfonos queda en un solo registro', async () => {
  await disableNetwork(charly.db);
  const offline = registerUnregistered(charly.db, charly.user, auditId, { code: 'X-77', name: 'Galletas sin etiqueta', note: 'Anaquel 4', quantity: 2, department: 'Abarrotes' }).committed;
  await registerUnregistered(oscar.db, oscar.user, auditId, { code: 'X-77', name: 'Galletas de avena', quantity: 3, department: 'Abarrotes' }).committed;
  await enableNetwork(charly.db); await offline;
  const all = (await state(oscar)).products.filter(p => p.code === 'X-77');
  assert.equal(all.length, 1);
  assert.equal(all[0].physicalStock, 5);
  assert.match(all[0].note, /Anaquel 4/);
});
test('9 · un no encontrado se edita, se excluye sin borrarse y se reincorpora', async () => {
  await editUnregistered(oscar.db, oscar.user, auditId, 'X-77', { name: 'Galletas avena 500 g', note: 'Confirmado con encargado' });
  assert.equal((await product(charly, 'X-77')).description, 'Galletas avena 500 g');
  await setUnregisteredExcluded(charly.db, charly.user, auditId, 'X-77', true, 'Era de otra tienda');
  const excluded = await product(oscar, 'X-77');
  assert.ok(excluded.excludedAt); assert.equal(excluded.physicalStock, 5, 'la cantidad se conserva como traza');
  assert.equal(calculateStats((await state(oscar)).products).excludedCount, 1);
  await setUnregisteredExcluded(oscar.db, oscar.user, auditId, 'X-77', false);
  assert.equal((await product(charly, 'X-77')).excludedAt, undefined);
});
test('9b · vincular un no encontrado suma sus piezas al producto real y deja la traza', async () => {
  await registerUnregistered(oscar.db, oscar.user, auditId, { code: 'Y-1', name: 'Leche sin etiqueta', quantity: 4, department: 'Lácteos' }).committed;
  const before = (await product(oscar, '001')).physicalStock;
  await linkUnregistered(oscar.db, oscar.user, auditId, 'Y-1', '001', 4);
  assert.equal((await product(charly, '001')).physicalStock, before + 4);
  const traced = await product(charly, 'Y-1');
  assert.equal(traced.linkedTo, '001'); assert.ok(traced.excludedAt);
});
test('deshacer agrega una captura inversa: el historial conserva ambas', async () => {
  const before = (await product(oscar, '001')).physicalStock;
  const capture = recordCapture(oscar.db, oscar.user, auditId, { code: '001', quantity: 6, mode: 'add', current: { physicalStock: before }, department: 'Lácteos' });
  await capture.committed;
  await undoCapture(oscar.db, oscar.user, auditId, { captureId: capture.captureId, code: '001', delta: capture.delta, department: 'Lácteos' }).committed;
  assert.equal((await product(oscar, '001')).physicalStock, before);
  const history = (await readCaptures(oscar.db, auditId)).filter(c => c.voids === capture.captureId);
  assert.equal(history.length, 1);
});
test('un lote repetido con la misma captura se rechaza completo y no duplica el conteo', async () => {
  const before = (await product(oscar, '002')).physicalStock;
  const capture = recordCapture(oscar.db, oscar.user, auditId, { code: '002', quantity: 1, mode: 'add', current: { physicalStock: before }, department: 'Lácteos' });
  await capture.committed;
  const refs = auditRefs(oscar.db, auditId);
  const replay = writeBatch(oscar.db);
  const original = (await getDoc(doc(refs.captures, capture.captureId))).data();
  replay.set(doc(refs.captures, capture.captureId), { ...original, at: original.at });
  await assert.rejects(replay.commit());
  assert.equal((await product(oscar, '002')).physicalStock, before + 1);
});
test('los totales coinciden con el historial de capturas (verificación de integridad)', async () => {
  const { buckets } = await state(oscar);
  assert.deepEqual(verifyIntegrity(await readCaptures(oscar.db, auditId), buckets), []);
});
test('soltar, completar y reasignar departamentos queda registrado', async () => {
  await setDepartmentStatus(oscar.db, oscar.user, auditId, 'Lácteos', 'done');
  await releaseDepartment(charly.db, charly.user, auditId, 'Abarrotes');
  await reassignDepartment(oscar.db, oscar.user, auditId, 'Abarrotes', { uid: charly.uid, name: 'Charly' });
  const departments = (await state(charly)).departments;
  assert.equal(departments.find(d => d.name === 'Lácteos').status, 'done');
  assert.equal(departments.find(d => d.name === 'Abarrotes').assigneeName, 'Charly');
});
test('11 · al completar la auditoría ya no se aceptan capturas y el balance final es consistente', async () => {
  await setAuditStatus(oscar.db, oscar.user, auditId, 'completed');
  await assert.rejects(recordCapture(charly.db, charly.user, auditId, { code: '001', quantity: 1, mode: 'add', current: { physicalStock: 0 }, department: 'Lácteos' }).committed);
  const { products } = await state(charly);
  const stats = calculateStats(products);
  assert.equal(stats.auditedCount, products.filter(p => !p.excludedAt && p.counted).length);
  assert.ok(stats.totalPiecesPhysical > 0);
});
