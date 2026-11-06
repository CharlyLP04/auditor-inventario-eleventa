import { linkRecoveryEmail, requestPasswordRecovery } from '../src/services/cloud/recovery.ts';
import { registerDevice, requestClosing, confirmDevice, deviceKey } from '../src/services/cloud/closing.ts';
import { createAuditBackup } from '../src/services/cloud/backup.ts';
// Escenarios de dos personas contando la misma auditoría, con dos clientes reales del SDK contra el emulador.
// Ejecutar con: npm run test:cloud
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, applyActionCode, reload, signOut, signInWithEmailAndPassword, confirmPasswordReset } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, disableNetwork, enableNetwork, waitForPendingWrites, onSnapshot, writeBatch, terminate } from 'firebase/firestore';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  createCompany, createCloudAudit, recordCapture, undoCapture, registerUnregistered, editUnregistered, setUnregisteredExcluded,
  linkUnregistered, uploadLocalAudit, claimDepartment, releaseDepartment, setDepartmentStatus, reassignDepartment, setAuditStatus, readAuditState, readCaptures, auditRefs, saveAuditNotes, verifyAuditIntegrity, readAuditHistory,
} from '../src/services/cloud/repository.ts';
import { verifyIntegrity } from '../src/services/cloud/model.ts';
import { calculateStats } from '../src/services/auditState.ts';

const project = 'demo-auditor';
const apps = [];
const databases = [];
let env, oscar, charly, auditId;
async function client(name, email) {
  const app = initializeApp({ projectId: project, apiKey: 'demo-key', authDomain: 'localhost' }, name);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = initializeFirestore(app, {});
  databases.push(db);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const { user } = await createUserWithEmailAndPassword(auth, email, 'contraseña-de-prueba');
  return { db, auth, uid: user.uid };
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
after(async () => { await Promise.all(databases.map(db => terminate(db))); for (const app of apps) await deleteApp(app); await env?.cleanup(); });

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
test('la cola pendiente se detecta al volver a suscribirse y solo se confirma tras reconectar', async () => {
  await disableNetwork(charly.db);
  const written = recordCapture(charly.db, charly.user, auditId, { code: '101', quantity: 1, mode: 'add' });
  let metadata;
  const stop = onSnapshot(auditRefs(charly.db, auditId).counts, { includeMetadataChanges: true }, snapshot => { metadata = snapshot.metadata; });
  try {
    await until(() => metadata?.hasPendingWrites === true, 'No recuperó las escrituras pendientes');
    assert.equal(metadata.fromCache, true);
    await enableNetwork(charly.db); await written.committed;
    await until(() => metadata?.hasPendingWrites === false && metadata.fromCache === false, 'No confirmó el envío');
  } finally { stop(); await enableNetwork(charly.db); }
});

test('una corrección desactualizada no borra lo contado en otro dispositivo', async () => {
  const current = await product(charly, '101');
  await recordCapture(oscar.db, oscar.user, auditId, { code: '101', quantity: 2, mode: 'add', current }).committed;
  await assert.rejects(recordCapture(charly.db, charly.user, auditId, { code: '101', quantity: 1, mode: 'set', current }).committed, /cambió en otro dispositivo/);
  assert.equal((await product(charly, '101')).physicalStock, current.physicalStock + 2);
  assert.deepEqual(verifyIntegrity(await readCaptures(oscar.db, auditId), (await state(oscar)).buckets), []);
});

test('11 · al completar la auditoría ya no se aceptan capturas y el balance final es consistente', async () => {
  await registerDevice(oscar.db, oscar.user, auditId);
  await registerDevice(charly.db, charly.user, auditId);
  await assert.rejects(setAuditStatus(oscar.db, oscar.user, auditId, 'completed'), /confirmación/);
  await requestClosing(oscar.db, auditId);
  const token = (await getDoc(auditRefs(oscar.db, auditId).audit)).data().closingToken;
  await confirmDevice(oscar.db, oscar.user, auditId, token);
  await assert.rejects(setAuditStatus(oscar.db, oscar.user, auditId, 'completed'), /confirmación/);
  await confirmDevice(charly.db, charly.user, auditId, token);
  await assert.rejects(recordCapture(charly.db, charly.user, auditId, { code: '001', quantity: 1, mode: 'add' }).committed);
  await setAuditStatus(oscar.db, oscar.user, auditId, 'completed');
  const backup = await createAuditBackup(oscar.db, auditId), data = JSON.parse(backup.payload);
  assert.equal(data.audit.id, auditId);
  assert.equal(data.collections.counts.length, 16);
  assert.ok(data.collections.captures.length > 0);
  assert.deepEqual(data.integrityDifferences, []);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(backup.payload));
  assert.equal(backup.sha256, Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join(''));
  await assert.rejects(recordCapture(charly.db, charly.user, auditId, { code: '001', quantity: 1, mode: 'add', current: { physicalStock: 0 }, department: 'Lácteos' }).committed);
  const { products } = await state(charly);
  const stats = calculateStats(products);
  assert.equal(stats.auditedCount, products.filter(p => !p.excludedAt && !p.isUnregistered && p.counted).length);
  assert.ok(stats.totalPiecesPhysical > 0);
});
test('una auditoría local se sube a la nube con sus conteos sin tocar los datos locales', async () => {
  const local = [
    { ...catalog[0], physicalStock: 12, counted: true }, { ...catalog[1] }, { ...catalog[2], physicalStock: 0, counted: true },
    { code: 'NF-1', description: 'Caja sin etiqueta', note: 'Pasillo 3', cost: 0, price: 0, department: 'Abarrotes', theoreticalStock: 0, physicalStock: 2, counted: true, isUnregistered: true },
    { code: 'NF-2', description: 'Excluido', cost: 0, price: 0, department: 'Abarrotes', theoreticalStock: 0, physicalStock: 1, counted: true, isUnregistered: true, excludedAt: '2026-10-01T10:00:00.000Z' },
  ];
  const snapshot = JSON.stringify(local);
  const companyId = await createCompany(oscar.db, oscar.user, { name: 'Tienda migrada' });
  const result = await uploadLocalAudit(oscar.db, oscar.user, { companyId, period: '2026-10', products: local });
  assert.equal(JSON.stringify(local), snapshot, 'los datos locales no se modifican');
  assert.equal(result.migrated, 4, 'incluye el excluido preservado como traza, sin sumarlo al balance'); assert.equal(result.skippedExcluded, 0);
  const { products } = await readAuditState(charly.db, result.auditId);
  const byCode = Object.fromEntries(products.map(p => [p.code, p]));
  assert.equal(byCode['001'].physicalStock, 12); assert.equal(byCode['002'].counted, false);
  assert.equal(byCode['101'].counted, true); assert.equal(byCode['101'].physicalStock, 0);
  assert.equal(byCode['NF-1'].isUnregistered, true); assert.equal(byCode['NF-1'].description, 'Caja sin etiqueta');
  assert.equal(byCode['NF-2'].excludedAt, '2026-10-01T10:00:00.000Z');
});

test('notas simultáneas: conserva el cambio remoto y rechaza el borrador obsoleto', async () => {
  await setAuditStatus(oscar.db, oscar.user, auditId, 'in_progress');
  const before = (await state(oscar)).audit.notes ?? '';
  await saveAuditNotes(oscar.db, oscar.user, auditId, 'Notas de Oscar', before);
  await assert.rejects(saveAuditNotes(charly.db, charly.user, auditId, 'Notas de Charly', before), /Otra persona/);
  assert.equal((await state(charly)).audit.notes, 'Notas de Oscar');
  await saveAuditNotes(charly.db, charly.user, auditId, 'Notas combinadas', 'Notas de Oscar');
  assert.equal((await state(oscar)).audit.notes, 'Notas combinadas');
});

test('integridad: consulta historial y contadores actuales del servidor', async () => {
  assert.deepEqual(await verifyAuditIntegrity(oscar.db, auditId), []);
});

test('historial: lee páginas de 20, sin duplicados ni auditorías abiertas', async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db=context.firestore();
    await Promise.all(Array.from({length:23}, (_,i) => setDoc(doc(db,'audits','history_'+String(i).padStart(2,'0')), {
      status:i%2 ? 'completed':'closed', period:'2026-10', title:'Historial de prueba', companyId:'history'
    })));
  });
  const first=await readAuditHistory(oscar.db);
  assert.equal(first.audits.length,20);
  assert.equal(first.hasMore,true);
  const second=await readAuditHistory(oscar.db,first.cursor);
  const ids=[...first.audits,...second.audits].map(a=>a.id);
  assert.equal(new Set(ids).size,ids.length);
  assert.equal(ids.filter(id=>id.startsWith('history_')).length,23);
  assert.ok([...first.audits,...second.audits].every(a=>['completed','closed'].includes(a.status)));
  assert.equal(second.hasMore,false);
});

test('cierre: la cola offline llega antes de confirmar y una solicitud cancelada no acepta confirmaciones viejas', async () => {
  await registerDevice(oscar.db, oscar.user, auditId); await registerDevice(charly.db, charly.user, auditId);
  await disableNetwork(charly.db);
  const capture = recordCapture(charly.db, charly.user, auditId, { code: '001', quantity: 2, mode: 'add' });
  await requestClosing(oscar.db, auditId);
  const token = (await getDoc(auditRefs(oscar.db, auditId).audit)).data().closingToken;
  await confirmDevice(oscar.db, oscar.user, auditId, token);
  await assert.rejects(setAuditStatus(oscar.db, oscar.user, auditId, 'closed'), /confirmación/);
  await enableNetwork(charly.db); await capture.committed;
  await confirmDevice(charly.db, charly.user, auditId, token);
  assert.equal((await getDoc(auditRefs(oscar.db, auditId).audit)).data().deviceConfirmations[deviceKey(charly.uid)], true);
  await requestClosing(oscar.db, auditId, true);
  await assert.rejects(confirmDevice(charly.db, charly.user, auditId, token), /cambió/);
  await assert.rejects(createAuditBackup(oscar.db, auditId), /Finaliza/);
});

test('recuperación: verificar correo conserva UID y permite recuperar contraseña sin correo sintético', async () => {
  const c = await client('recovery-test','recuperacion@auth.grid.mx');
  const uid = c.uid, oldPassword = 'contraseña-de-prueba';
  await linkRecoveryEmail(c.auth,'persona@example.test',oldPassword);
  assert.equal(c.auth.currentUser.email,'recuperacion@auth.grid.mx','el acceso viejo sigue hasta verificar');
  const codes = async () => (await (await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-auditor/oobCodes')).json()).oobCodes;
  const verification = (await codes()).find(c => c.requestType === 'VERIFY_AND_CHANGE_EMAIL' && c.email === 'recuperacion@auth.grid.mx');
  assert.ok(verification);
  await applyActionCode(c.auth, verification.oobCode); await reload(c.auth.currentUser);
  assert.equal(c.auth.currentUser.uid,uid); assert.equal(c.auth.currentUser.emailVerified,true);
  await signOut(c.auth);
  const login = await signInWithEmailAndPassword(c.auth,'persona@example.test',oldPassword);
  assert.equal(login.user.uid,uid);
  await signOut(c.auth); await requestPasswordRecovery(c.auth,'persona@example.test');
  const reset = (await codes()).find(c => c.requestType === 'PASSWORD_RESET' && c.email === 'persona@example.test');
  assert.ok(reset); await confirmPasswordReset(c.auth,reset.oobCode,'nueva-contraseña-prueba');
  assert.equal((await signInWithEmailAndPassword(c.auth,'persona@example.test','nueva-contraseña-prueba')).user.uid,uid);
  await assert.rejects(requestPasswordRecovery(c.auth,'recuperacion@auth.grid.mx'),/correo real/);
});
