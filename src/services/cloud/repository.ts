import { doc, collection, getDoc, getDocs, runTransaction, writeBatch, serverTimestamp, increment, FieldPath, setDoc, Timestamp } from 'firebase/firestore';
import type { Firestore, DocumentData, DocumentReference, WriteBatch } from 'firebase/firestore';
import type { Product, CountMode, ImportReport } from '../../types';
import { BUCKETS, bucketOf, codeKey, departmentKey, splitCatalog, planCapture, assembleProducts, mergeBuckets } from './model';
import type { BucketData, UnregisteredDoc } from './model';

/** Operaciones de la auditoría compartida en Firestore. Las reglas (firestore.rules) validan cada escritura. */
export interface CloudUser { uid: string; name: string; role: 'admin' | 'auditor'; }
export type DepartmentStatus = 'pending' | 'in_progress' | 'done';
export interface CloudDepartment { key: string; name: string; assignee: string | null; assigneeName: string | null; status: DepartmentStatus; }
export type AuditStatus = 'in_progress' | 'completed' | 'closed';
export interface CloudAudit {
  id: string; companyId: string; period: string; title: string; status: AuditStatus; notes?: string; createdAt?: string; completedAt?: string | null;
  catalog?: { chunks: number; products: number; importedAt: string; importedBy: string; fileName?: string; report?: ImportReport };
}
export interface CloudCompany { id: string; name: string; contactName?: string; phone?: string; address?: string; notes?: string; }
export interface CaptureRecord { id: string; code: string; delta: number; mode: string; by: string; byName: string; at?: string; voids?: string; department?: string; outsideAssignment?: boolean; }

export function auditRefs(db: Firestore, auditId: string) {
  const audit = doc(db, 'audits', auditId);
  return {
    audit, catalog: collection(audit, 'catalog'), counts: collection(audit, 'counts'), captures: collection(audit, 'captures'),
    departments: collection(audit, 'departments'), unregistered: collection(audit, 'unregistered'), events: collection(audit, 'events'),
    bucket: (code: string) => doc(audit, 'counts', `b${bucketOf(code)}`),
  };
}
// Firestore no acepta undefined: se eliminan antes de escribir (los valores especiales como serverTimestamp se agregan después).
const clean = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const iso = (value: unknown) => value instanceof Timestamp ? value.toDate().toISOString() : typeof value === 'string' ? value : undefined;
const device = () => typeof navigator === 'undefined' ? 'sin navegador' : navigator.userAgent.slice(0, 120);
const stamp = (user: CloudUser) => ({ updatedBy: user.uid, updatedAt: serverTimestamp() });
// Lote o transacción: ambos exponen set(ref, data).
function logEvent(target: { set(ref: DocumentReference, data: DocumentData): unknown }, events: ReturnType<typeof auditRefs>['events'], user: CloudUser, type: string, detail: string) {
  target.set(doc(events), { by: user.uid, byName: user.name, at: serverTimestamp(), type, detail });
}
async function commitInChunks(db: Firestore, writes: ((batch: WriteBatch) => void)[]) {
  for (let i = 0; i < writes.length; i += 450) {
    const batch = writeBatch(db);
    writes.slice(i, i + 450).forEach(write => write(batch));
    await batch.commit();
  }
}

export async function createCompany(db: Firestore, user: CloudUser, data: Omit<CloudCompany, 'id'>) {
  const ref = doc(collection(db, 'companies'));
  await setDoc(ref, clean({ ...data, name: data.name.trim(), createdBy: user.uid, createdAt: new Date().toISOString() }));
  return ref.id;
}

/** Crea la auditoría con su catálogo, contadores y departamentos. El ID empresa_periodo impide duplicados. */
export async function createCloudAudit(db: Firestore, user: CloudUser, input: { companyId: string; period: string; products: Product[]; report?: ImportReport }) {
  if (user.role !== 'admin') throw new Error('Solo un administrador crea auditorías.');
  const auditId = `${input.companyId}_${input.period}`;
  const refs = auditRefs(db, auditId);
  const duplicate = () => new Error('Ya existe una auditoría de esa empresa para ese mes. Ábrela desde la lista.');
  if ((await getDoc(refs.audit)).exists()) throw duplicate();
  const chunks = splitCatalog(input.products);
  const departments = [...new Set(input.products.map(p => p.department))];
  await commitInChunks(db, [
    ...Array.from({ length: BUCKETS }, (_, b) => (batch: WriteBatch) => batch.set(doc(refs.counts, `b${b}`), { q: {}, n: {}, u: {} })),
    ...chunks.map((products, index) => (batch: WriteBatch) => batch.set(doc(refs.catalog, String(index)), clean({ products }))),
    ...departments.map(name => (batch: WriteBatch) => batch.set(doc(refs.departments, departmentKey(name)), { name, assignee: null, assigneeName: null, status: 'pending' })),
  ]);
  // La auditoría se publica al final: nadie la ve hasta que su catálogo completo está guardado.
  await runTransaction(db, async tx => {
    if ((await tx.get(refs.audit)).exists()) throw duplicate();
    const report = input.report ? { ...input.report, issues: input.report.issues.slice(0, 2000) } : undefined;
    tx.set(refs.audit, clean({
      companyId: input.companyId, period: input.period, title: `Auditoría ${input.period}`, status: 'in_progress', createdBy: user.uid, createdAt: new Date().toISOString(),
      catalog: { chunks: chunks.length, products: input.products.length, importedAt: new Date().toISOString(), importedBy: user.name, fileName: input.report?.fileName, report },
    }));
    logEvent(tx, refs.events, user, 'import', `${input.products.length} productos${input.report?.issues.length ? `, ${input.report.issues.length} filas omitidas` : ''}`);
  });
  return auditId;
}

/**
 * Sube una auditoría guardada en este dispositivo: catálogo y cada producto contado como captura "migrated".
 * No modifica ni borra los datos locales. Los no encontrados excluidos se omiten (siguen en el respaldo local).
 */
export async function uploadLocalAudit(db: Firestore, admin: CloudUser, input: { companyId: string; period: string; products: Product[]; report?: ImportReport }) {
  const catalogProducts = input.products.filter(p => !p.isUnregistered);
  const auditId = await createCloudAudit(db, admin, { companyId: input.companyId, period: input.period, products: catalogProducts, report: input.report });
  const refs = auditRefs(db, auditId);
  const counted = input.products.filter(p => (p.counted ?? (p.physicalStock > 0 || Boolean(p.lastScannedAt))) && !p.excludedAt);
  for (let i = 0; i < counted.length; i += 150) {
    const batch = writeBatch(db);
    for (const p of counted.slice(i, i + 150)) {
      addCapture(batch, db, admin, auditId, { code: p.code, delta: p.physicalStock, mode: 'migrated', observed: null, department: p.department });
      if (p.isUnregistered) batch.set(doc(refs.unregistered, codeKey(p.code)), clean({ code: p.code, department: p.department, labels: { [admin.uid]: { name: p.description, note: p.note } } }), { merge: true });
    }
    await batch.commit();
  }
  return { auditId, migrated: counted.length, skippedExcluded: input.products.filter(p => p.excludedAt).length };
}

interface CaptureInput { code: string; delta: number; mode: string; observed: number | null; department?: string; outsideAssignment?: boolean; voids?: string; countDelta?: number; }
/** Agrega a un lote la captura y el incremento de su contador: o se aplican ambos o ninguno, también al salir de la cola sin conexión. */
function addCapture(batch: WriteBatch, db: Firestore, user: CloudUser, auditId: string, input: CaptureInput) {
  const refs = auditRefs(db, auditId);
  const capture = doc(refs.captures);
  batch.set(capture, {
    ...clean({
      code: input.code, delta: input.delta, mode: input.mode, observed: input.observed, by: user.uid, byName: user.name,
      clientAt: new Date().toISOString(), device: device(), department: input.department ?? '',
      ...(input.voids ? { voids: input.voids } : {}), ...(input.outsideAssignment ? { outsideAssignment: true } : {}),
    }),
    at: serverTimestamp(),
  });
  const countDelta = input.countDelta ?? 1;
  batch.update(refs.bucket(input.code), new FieldPath('q', input.code), increment(input.delta), new FieldPath('n', input.code), increment(countDelta), new FieldPath('u', input.code, user.uid), increment(countDelta));
  return capture.id;
}
function writeCapture(db: Firestore, user: CloudUser, auditId: string, input: CaptureInput, extra?: (batch: WriteBatch) => void) {
  const batch = writeBatch(db);
  const captureId = addCapture(batch, db, user, auditId, input);
  extra?.(batch);
  return { captureId, committed: batch.commit() };
}

export function recordCapture(db: Firestore, user: CloudUser, auditId: string, input: { code: string; quantity: number; mode: CountMode; current?: Pick<Product, 'physicalStock'>; department?: string; outsideAssignment?: boolean }) {
  const plan = planCapture(input.current ?? { physicalStock: 0 }, input.quantity, input.mode);
  const written = writeCapture(db, user, auditId, { code: input.code, delta: plan.delta, mode: input.mode, observed: plan.observed, department: input.department, outsideAssignment: input.outsideAssignment });
  return { ...written, delta: plan.delta, total: plan.total };
}

/** Deshacer es otra captura con el delta inverso; resta también la captura del conteo para que un producto vuelva a "pendiente". */
export function undoCapture(db: Firestore, user: CloudUser, auditId: string, last: { captureId: string; code: string; delta: number; department?: string }) {
  return writeCapture(db, user, auditId, { code: last.code, delta: -last.delta, mode: 'undo', observed: null, department: last.department, voids: last.captureId, countDelta: -1 });
}

export function registerUnregistered(db: Firestore, user: CloudUser, auditId: string, input: { code: string; name?: string; note?: string; quantity: number; department?: string }) {
  const code = input.code.trim();
  if (!code || code.length > 128) throw new Error('El código debe tener entre 1 y 128 caracteres.');
  if (!(input.quantity > 0)) throw new Error('Escribe una cantidad mayor que cero.');
  const refs = auditRefs(db, auditId);
  // set + merge: si el otro teléfono ya lo registró (aunque haya sido sin conexión), ambos convergen en el mismo documento.
  return writeCapture(db, user, auditId, { code, delta: input.quantity, mode: 'unregistered', observed: null, department: input.department }, batch => batch.set(doc(refs.unregistered, codeKey(code)), clean({
    code, ...(input.department ? { department: input.department } : {}), labels: { [user.uid]: { name: input.name?.trim().slice(0, 200) || undefined, note: input.note?.trim().slice(0, 1000) || undefined } },
  }), { merge: true }));
}

export function editUnregistered(db: Firestore, user: CloudUser, auditId: string, code: string, patch: { name?: string; note?: string }) {
  const name = patch.name?.trim().slice(0, 200);
  if (patch.name !== undefined && !name) return Promise.reject(new Error('El nombre no puede quedar vacío.'));
  const refs = auditRefs(db, auditId);
  const batch = writeBatch(db);
  batch.update(doc(refs.unregistered, codeKey(code)), { ...(name ? { name } : {}), ...(patch.note !== undefined ? { note: patch.note.trim().slice(0, 1000) } : {}), ...stamp(user) });
  logEvent(batch, refs.events, user, 'unregistered_edit', `${code} · ${[name, patch.note].filter(Boolean).join(' · ')}`);
  return batch.commit();
}

export function setUnregisteredExcluded(db: Firestore, user: CloudUser, auditId: string, code: string, excluded: boolean, reason?: string) {
  const refs = auditRefs(db, auditId);
  const batch = writeBatch(db);
  batch.update(doc(refs.unregistered, codeKey(code)), {
    excluded, excludedBy: excluded ? user.uid : null, excludedAt: excluded ? new Date().toISOString() : null,
    reason: excluded ? (reason?.trim().slice(0, 1000) || 'Sin motivo registrado') : null, ...stamp(user),
  });
  logEvent(batch, refs.events, user, excluded ? 'unregistered_exclude' : 'unregistered_restore', `${code}${excluded && reason ? ` · ${reason}` : ''}`);
  return batch.commit();
}

/** Las piezas de un no encontrado pasan al producto real del catálogo; el registro queda excluido como traza. */
export function linkUnregistered(db: Firestore, user: CloudUser, auditId: string, code: string, targetCode: string, quantity: number) {
  const refs = auditRefs(db, auditId);
  return writeCapture(db, user, auditId, { code: targetCode, delta: quantity, mode: 'link', observed: null }, batch => {
    batch.update(doc(refs.unregistered, codeKey(code)), { linkedTo: targetCode, excluded: true, excludedBy: user.uid, excludedAt: new Date().toISOString(), reason: `Identificado como ${targetCode}`, ...stamp(user) });
    logEvent(batch, refs.events, user, 'unregistered_link', `${code} → ${targetCode} (${quantity})`);
  }).committed;
}

async function updateDepartment(db: Firestore, user: CloudUser, auditId: string, name: string, change: (current: CloudDepartment) => Partial<CloudDepartment>, eventType: string) {
  const refs = auditRefs(db, auditId);
  const ref = doc(refs.departments, departmentKey(name));
  // Una transacción lee el estado vigente en el servidor: si otra persona lo tomó un instante antes, esta falla.
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error(`El departamento ${name} no existe en esta auditoría.`);
    const next = change(toDepartment(snap.id, snap.data()));
    tx.update(ref, { ...next, ...stamp(user) });
    logEvent(tx, refs.events, user, eventType, `${name}${next.assigneeName !== undefined ? ` · ${next.assigneeName ?? 'sin asignar'}` : ''}${next.status ? ` · ${next.status}` : ''}`);
  });
}
const takenError = (department: CloudDepartment) => new Error(`${department.name} ya lo está contando ${department.assigneeName ?? 'otra persona'}. Pide a un administrador que lo reasigne si necesitas ayudar.`);
export function claimDepartment(db: Firestore, user: CloudUser, auditId: string, name: string) {
  return updateDepartment(db, user, auditId, name, current => {
    if (current.assignee && current.assignee !== user.uid) throw takenError(current);
    return { assignee: user.uid, assigneeName: user.name, status: current.status === 'done' ? 'done' : 'in_progress' };
  }, 'department_claim');
}
export function releaseDepartment(db: Firestore, user: CloudUser, auditId: string, name: string) {
  return updateDepartment(db, user, auditId, name, current => {
    if (current.assignee !== user.uid && user.role !== 'admin') throw takenError(current);
    return { assignee: null, assigneeName: null, status: current.status === 'done' ? 'done' : 'pending' };
  }, 'department_release');
}
export function setDepartmentStatus(db: Firestore, user: CloudUser, auditId: string, name: string, status: DepartmentStatus) {
  return updateDepartment(db, user, auditId, name, current => {
    if (current.assignee && current.assignee !== user.uid && user.role !== 'admin') throw takenError(current);
    return current.assignee ? { status } : { status, assignee: user.uid, assigneeName: user.name };
  }, 'department_status');
}
export function reassignDepartment(db: Firestore, admin: CloudUser, auditId: string, name: string, to: { uid: string; name: string } | null) {
  if (admin.role !== 'admin') return Promise.reject(new Error('Solo un administrador reasigna departamentos.'));
  return updateDepartment(db, admin, auditId, name, current => ({ assignee: to?.uid ?? null, assigneeName: to?.name ?? null, status: current.status === 'done' ? 'done' : to ? 'in_progress' : 'pending' }), 'department_reassign');
}

export function setAuditStatus(db: Firestore, admin: CloudUser, auditId: string, status: AuditStatus) {
  if (admin.role !== 'admin') return Promise.reject(new Error('Solo un administrador cambia el estado de la auditoría.'));
  const refs = auditRefs(db, auditId);
  const batch = writeBatch(db);
  batch.update(refs.audit, { status, completedAt: status === 'in_progress' ? null : new Date().toISOString(), ...stamp(admin) });
  logEvent(batch, refs.events, admin, 'status', status);
  return batch.commit();
}
export function saveAuditNotes(db: Firestore, user: CloudUser, auditId: string, notes: string) {
  const batch = writeBatch(db);
  batch.update(auditRefs(db, auditId).audit, { notes: notes.slice(0, 10000), ...stamp(user) });
  return batch.commit();
}
export function saveMember(db: Firestore, admin: CloudUser, uid: string, member: { name: string; email?: string; role: 'admin' | 'auditor'; active: boolean }) {
  const email = member.email?.trim();
  return setDoc(doc(db, 'members', uid.trim()), { name: member.name.trim(), ...(email ? { email } : {}), role: member.role, active: member.active, ...stamp(admin) });
}

// Conversión de documentos de Firestore al modelo de la aplicación.
export const toBucket = (data: DocumentData): BucketData => ({ q: data.q ?? {}, n: data.n ?? {}, u: data.u ?? {} });
export const toDepartment = (key: string, data: DocumentData): CloudDepartment => ({ key, name: data.name, assignee: data.assignee ?? null, assigneeName: data.assigneeName ?? null, status: data.status ?? 'pending' });
export const toUnregistered = (data: DocumentData): UnregisteredDoc => ({
  code: data.code, name: data.name ?? undefined, note: data.note ?? undefined, department: data.department ?? undefined, labels: data.labels ?? {},
  excluded: Boolean(data.excluded), excludedAt: iso(data.excludedAt), reason: data.reason ?? undefined, linkedTo: data.linkedTo ?? undefined,
});
export const toAudit = (id: string, data: DocumentData): CloudAudit => ({ ...(data as Omit<CloudAudit, 'id'>), id, createdAt: iso(data.createdAt), completedAt: iso(data.completedAt) ?? null });
export const catalogFrom = (docs: { id: string; data: () => DocumentData }[]) => docs.slice().sort((a, b) => Number(a.id) - Number(b.id)).map(d => (d.data().products ?? []) as Product[]);
export const contributorsFrom = (buckets: BucketData[]): Record<string, string[]> => Object.fromEntries(Object.entries(mergeBuckets(buckets).u).map(([code, people]) => [code, Object.keys(people).filter(uid => people[uid] > 0)]));

/** Lectura completa (para pruebas y verificaciones puntuales). La app usa suscripciones en useCloudAudit. */
export async function readAuditState(db: Firestore, auditId: string) {
  const refs = auditRefs(db, auditId);
  const [audit, catalog, counts, departments, unregistered] = await Promise.all([getDoc(refs.audit), getDocs(refs.catalog), getDocs(refs.counts), getDocs(refs.departments), getDocs(refs.unregistered)]);
  if (!audit.exists()) throw new Error('La auditoría no existe o no tienes acceso.');
  const buckets = counts.docs.map(d => toBucket(d.data()));
  return {
    audit: toAudit(audit.id, audit.data()), buckets, contributors: contributorsFrom(buckets),
    departments: departments.docs.map(d => toDepartment(d.id, d.data())),
    products: assembleProducts(catalogFrom(catalog.docs), buckets, unregistered.docs.map(d => toUnregistered(d.data()))),
  };
}
export async function readCaptures(db: Firestore, auditId: string): Promise<CaptureRecord[]> {
  const snapshot = await getDocs(auditRefs(db, auditId).captures);
  return snapshot.docs.map(d => { const data = d.data(); return { id: d.id, code: data.code, delta: data.delta, mode: data.mode, by: data.by, byName: data.byName, at: iso(data.at), voids: data.voids, department: data.department, outsideAssignment: data.outsideAssignment }; });
}
