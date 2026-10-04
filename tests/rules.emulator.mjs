// Pruebas de firestore.rules contra el emulador. Ejecutar con: npm run test:cloud
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, increment, writeBatch, FieldPath } from 'firebase/firestore';

let env;
const db = uid => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();
const captureData = (uid, extra = {}) => ({ code: '001', delta: 1, mode: 'add', observed: 0, by: uid, byName: 'Prueba', at: serverTimestamp(), clientAt: '2026-10-03T10:00:00.000Z', device: 'test', department: 'Lácteos', ...extra });

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-auditor', firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 } });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const fs = context.firestore();
    await setDoc(doc(fs, 'members/admin1'), { name: 'Oscar', role: 'admin', active: true });
    await setDoc(doc(fs, 'members/aud1'), { name: 'Charly', role: 'auditor', active: true });
    await setDoc(doc(fs, 'members/aud2'), { name: 'Auditor dos', role: 'auditor', active: true });
    await setDoc(doc(fs, 'members/old1'), { name: 'Exempleado', role: 'auditor', active: false });
    await setDoc(doc(fs, 'audits/A1'), { companyId: 'C1', period: '2026-11', status: 'in_progress', createdBy: 'admin1' });
    await setDoc(doc(fs, 'audits/A2'), { companyId: 'C1', period: '2026-10', status: 'closed', createdBy: 'admin1' });
    for (const audit of ['A1', 'A2']) await setDoc(doc(fs, `audits/${audit}/counts/b0`), { q: {}, n: {}, u: {} });
    await setDoc(doc(fs, 'audits/A1/departments/d_free'), { name: 'Lácteos', assignee: null, assigneeName: null, status: 'pending' });
    await setDoc(doc(fs, 'audits/A1/departments/d_taken'), { name: 'Abarrotes', assignee: 'aud2', assigneeName: 'Auditor dos', status: 'in_progress' });
    await setDoc(doc(fs, 'audits/A1/unregistered/c_X1'), { code: 'X1', labels: { aud2: { name: 'Caja' } } });
    await setDoc(doc(fs, 'audits/A1/captures/existing'), captureData('aud1', { at: new Date() }));
  });
});

test('sin sesión no se lee ninguna auditoría', async () => { await assertFails(getDoc(doc(db(null), 'audits/A1'))); });
test('una cuenta sin membresía no lee auditorías ni conteos, pero sí puede consultar su propia membresía', async () => {
  await assertFails(getDoc(doc(db('stranger'), 'audits/A1')));
  await assertFails(getDoc(doc(db('stranger'), 'audits/A1/counts/b0')));
  await assertSucceeds(getDoc(doc(db('stranger'), 'members/stranger')));
});
test('un miembro desactivado pierde el acceso', async () => { await assertFails(getDoc(doc(db('old1'), 'audits/A1'))); });
test('un auditor no puede darse acceso de administrador ni agregar miembros', async () => {
  const stamp = uid => ({ updatedBy: uid, updatedAt: serverTimestamp() });
  await assertFails(updateDoc(doc(db('aud1'), 'members/aud1'), { role: 'admin', ...stamp('aud1') }));
  await assertFails(setDoc(doc(db('aud1'), 'members/nuevo'), { name: 'X', role: 'auditor', active: true, ...stamp('aud1') }));
  await assertFails(setDoc(doc(db('stranger'), 'members/stranger'), { name: 'Yo', role: 'admin', active: true, ...stamp('stranger') }));
});
test('un administrador agrega miembros, pero no puede quitarse su propio acceso', async () => {
  const stamp = { updatedBy: 'admin1', updatedAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(db('admin1'), 'members/nuevo'), { name: 'Nueva auditora', email: 'a@b.mx', role: 'auditor', active: true, ...stamp }));
  await assertFails(updateDoc(doc(db('admin1'), 'members/admin1'), { active: false, ...stamp }));
});
test('solo un administrador cambia el estado de la auditoría; un auditor puede guardar notas', async () => {
  await assertFails(updateDoc(doc(db('aud1'), 'audits/A1'), { status: 'closed' }));
  await assertSucceeds(updateDoc(doc(db('aud1'), 'audits/A1'), { notes: 'Bodega revisada', updatedBy: 'aud1', updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(db('admin1'), 'audits/A1'), { status: 'completed' }));
});
test('una captura solo la crea su autor con hora del servidor y nunca se edita ni se borra', async () => {
  await assertSucceeds(setDoc(doc(db('aud1'), 'audits/A1/captures/c1'), captureData('aud1')));
  await assertFails(setDoc(doc(db('aud1'), 'audits/A1/captures/c2'), captureData('aud2')));
  await assertFails(setDoc(doc(db('aud1'), 'audits/A1/captures/c3'), captureData('aud1', { at: new Date('2020-01-01') })));
  await assertFails(setDoc(doc(db('aud1'), 'audits/A1/captures/c4'), captureData('aud1', { delta: 1e10 })));
  await assertFails(updateDoc(doc(db('aud1'), 'audits/A1/captures/existing'), { delta: 50 }));
  await assertFails(deleteDoc(doc(db('admin1'), 'audits/A1/captures/existing')));
});
test('no se registran capturas ni conteos en una auditoría cerrada', async () => {
  await assertFails(setDoc(doc(db('aud1'), 'audits/A2/captures/c1'), captureData('aud1')));
  await assertFails(updateDoc(doc(db('aud1'), 'audits/A2/counts/b0'), new FieldPath('q', '001'), increment(1)));
});
test('captura y contador se escriben juntos; el contador no admite otros campos', async () => {
  const fs = db('aud1');
  const batch = writeBatch(fs);
  batch.set(doc(fs, 'audits/A1/captures/c9'), captureData('aud1', { delta: 3 }));
  batch.update(doc(fs, 'audits/A1/counts/b0'), new FieldPath('q', '001'), increment(3), new FieldPath('n', '001'), increment(1), new FieldPath('u', '001', 'aud1'), increment(1), 'lastCode', '001', 'lastCapture', 'c9');
  await assertSucceeds(batch.commit());
  await assertFails(updateDoc(doc(fs, 'audits/A1/counts/b0'), { owner: 'aud1' }));
});
test('un auditor toma un departamento libre, pero no uno ajeno; puede soltar el suyo', async () => {
  const stamp = uid => ({ updatedBy: uid, updatedAt: serverTimestamp() });
  await assertSucceeds(updateDoc(doc(db('aud1'), 'audits/A1/departments/d_free'), { assignee: 'aud1', assigneeName: 'Charly', status: 'in_progress', ...stamp('aud1') }));
  await assertFails(updateDoc(doc(db('aud1'), 'audits/A1/departments/d_taken'), { assignee: 'aud1', assigneeName: 'Charly', status: 'in_progress', ...stamp('aud1') }));
  await assertFails(updateDoc(doc(db('aud1'), 'audits/A1/departments/d_taken'), { assignee: null, assigneeName: null, status: 'pending', ...stamp('aud1') }));
  await assertSucceeds(updateDoc(doc(db('aud1'), 'audits/A1/departments/d_free'), { assignee: null, assigneeName: null, status: 'pending', ...stamp('aud1') }));
});
test('un administrador reasigna un departamento ajeno', async () => {
  await assertSucceeds(updateDoc(doc(db('admin1'), 'audits/A1/departments/d_taken'), { assignee: 'aud1', assigneeName: 'Charly', status: 'in_progress', updatedBy: 'admin1', updatedAt: serverTimestamp() }));
});
test('un no encontrado acepta la etiqueta de cada persona, pero nadie cambia la de otro ni lo borra', async () => {
  await assertSucceeds(setDoc(doc(db('aud1'), 'audits/A1/unregistered/c_X1'), { code: 'X1', labels: { aud1: { name: 'Caja de cereal' } } }, { merge: true }));
  await assertFails(setDoc(doc(db('aud1'), 'audits/A1/unregistered/c_X1'), { code: 'X1', labels: { aud2: { name: 'Cambio ajeno' } } }, { merge: true }));
  await assertSucceeds(setDoc(doc(db('aud1'), 'audits/A1/unregistered/c_NEW'), { code: 'NEW', department: 'Lácteos', labels: { aud1: { name: 'Nuevo' } } }, { merge: true }));
  await assertFails(deleteDoc(doc(db('admin1'), 'audits/A1/unregistered/c_X1')));
});
test('un auditor no puede modificar el catálogo', async () => {
  await assertFails(setDoc(doc(db('aud1'), 'audits/A1/catalog/0'), { products: [] }));
  await assertSucceeds(setDoc(doc(db('admin1'), 'audits/A1/catalog/0'), { products: [] }));
});
