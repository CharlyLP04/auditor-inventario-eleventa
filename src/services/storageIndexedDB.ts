import type { WorkspaceData, Company, AuditRecord } from '../types';
import { calculateStats, validateProducts } from './auditState';
export function createId() { return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join(''); }
export const LEGACY_KEY = 'auditor_eleventa_products_v1';
const initial = (): WorkspaceData => ({ companies: [], audits: [], activeAuditId: null, activeCompanyId: null, revision: 0,
  profile: { serviceName: 'Servicio de auditoría de inventarios', auditorName: '', letterhead: '' } });
let connection: Promise<IDBDatabase> | undefined;
function open() {
  if (!connection) connection = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('AuditorEleventaDB', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('companies', { keyPath: 'id' });
      const audits = db.createObjectStore('audits', { keyPath: 'id' });
      audits.createIndex('companyId', 'companyId');
      db.createObjectStore('app_settings');
    };
    request.onerror = () => { connection = undefined; reject(request.error); };
    request.onblocked = () => { connection = undefined; reject(new Error('Cierra otras pestañas del auditor y recarga.')); };
    request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); connection = undefined; }; resolve(request.result); };
  });
  return connection;
}
const failure = (tx: IDBTransaction) => tx.error ?? new Error('No se pudo guardar. Conserva la pestaña abierta y descarga un respaldo.');
export async function readWorkspace(): Promise<WorkspaceData> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['companies', 'audits', 'app_settings'], 'readonly');
    const companies = tx.objectStore('companies').getAll();
    const audits = tx.objectStore('audits').getAll();
    const settings = tx.objectStore('app_settings').get('workspace');
    tx.oncomplete = () => resolve({ ...initial(), ...settings.result, companies: companies.result, audits: audits.result });
    tx.onabort = () => reject(failure(tx));
  });
}
// A revision check and all writes share one transaction, including across tabs.
export async function writeWorkspace(next: WorkspaceData, expected: number, replace = false, previous?: WorkspaceData): Promise<WorkspaceData> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['companies', 'audits', 'app_settings'], 'readwrite');
    const settings = tx.objectStore('app_settings');
    let conflict = false;
    const check = settings.get('workspace');
    check.onsuccess = () => {
      if ((check.result?.revision ?? 0) !== expected) { conflict = true; tx.abort(); return; }
      const companies = tx.objectStore('companies'), audits = tx.objectStore('audits');
      if (replace) { companies.clear(); audits.clear(); }
      const oldCompanies = new Map(previous?.companies.map(c => [c.id, c]));
      const oldAudits = new Map(previous?.audits.map(a => [a.id, a]));
      next.companies.forEach(c => { if (replace || oldCompanies.get(c.id) !== c) companies.put(c); });
      next.audits.forEach(a => { if (replace || oldAudits.get(a.id) !== a) audits.put(a); });
      settings.put({ activeCompanyId: next.activeCompanyId, activeAuditId: next.activeAuditId, profile: next.profile, revision: expected + 1 }, 'workspace');
    };
    tx.oncomplete = () => resolve({ ...next, revision: expected + 1 });
    tx.onabort = () => reject(conflict ? new Error('Otra pestaña cambió los datos. Descarga tu respaldo y recarga antes de continuar.') : failure(tx));
  });
}
export function newAudit(companyId: string, period: string): AuditRecord {
  return { id: createId(), companyId, period, title: `Auditoría ${period}`, status: 'in_progress', createdAt: new Date().toISOString(), products: [], stats: calculateStats([]) };
}
let initialization: Promise<WorkspaceData> | undefined;
export function initializeWorkspace() {
  if (!initialization) initialization = migrateWorkspace().catch(error => { initialization = undefined; throw error; });
  return initialization;
}
export async function recoverWorkspace() {
  const current = await readWorkspace();
  return current.revision ? current : writeWorkspace(current, 0);
}
async function migrateWorkspace() {
  let data = await readWorkspace();
  if (data.revision !== 0) return data;
  const raw = localStorage.getItem(LEGACY_KEY);
  if (raw) {
    const products: unknown = JSON.parse(raw);
    if (!validateProducts(products)) throw new Error('El conteo anterior no es válido. Se conserva en localStorage; no se ha reemplazado.');
    if (products.length) {
      const company: Company = { id: createId(), name: 'Empresa del conteo anterior', createdAt: new Date().toISOString() };
      const today = new Date();
      const audit = newAudit(company.id, `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
      audit.products = products; audit.stats = calculateStats(products);
      data = { ...data, companies: [company], audits: [audit], activeAuditId: audit.id, activeCompanyId: company.id };
    }
  }
  // Keep the original localStorage entry as recovery; the revision marks migration complete.
  return writeWorkspace(data, 0);
}
const object = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown) => typeof v === 'string' && v.length <= 10000;
const date = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
export function parseMasterBackup(raw: string): WorkspaceData {
  const root: unknown = JSON.parse(raw);
  if (!object(root) || root.format !== 'auditor-eleventa-master' || root.version !== 1 || !object(root.data)) throw new Error('No es un respaldo maestro compatible.');
  const d = root.data;
  if (!Array.isArray(d.companies) || !Array.isArray(d.audits) || !object(d.profile)) throw new Error('Respaldo incompleto.');
  const ids = new Set<string>(), auditIds = new Set<string>(), periods = new Set<string>();
  for (const c of d.companies) {
    if (!object(c) || !text(c.id) || !c.id || ids.has(c.id as string) || !text(c.name) || !(c.name as string).trim() || !date(c.createdAt)
      || ['contactName', 'phone', 'address', 'notes'].some(k => c[k] !== undefined && !text(c[k]))) throw new Error('Empresa inválida o duplicada.');
    ids.add(c.id as string);
  }
  for (const a of d.audits) {
    if (!object(a) || !text(a.id) || !a.id || auditIds.has(a.id as string) || !ids.has(a.companyId as string)
      || !text(a.title) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(a.period)) || !date(a.createdAt)
      || !['in_progress', 'completed', 'closed'].includes(String(a.status)) || !validateProducts(a.products)
      || (a.notes !== undefined && !text(a.notes)) || (a.completedAt !== undefined && !date(a.completedAt))) throw new Error('Auditoría inválida o sin empresa.');
    const periodKey = JSON.stringify([a.companyId, a.period]);
    if (periods.has(periodKey)) throw new Error('Hay dos auditorías de la misma empresa y mes.');
    periods.add(periodKey);
    auditIds.add(a.id as string); a.stats = calculateStats(a.products);
  }
  if (d.activeCompanyId !== null && !ids.has(d.activeCompanyId as string)) throw new Error('Empresa activa inválida.');
  if (d.activeAuditId !== null && !auditIds.has(d.activeAuditId as string)) throw new Error('Auditoría activa inválida.');
  if (d.activeAuditId !== null && d.audits.find(a => a.id === d.activeAuditId)?.companyId !== d.activeCompanyId) throw new Error('La auditoría activa no pertenece a la empresa seleccionada.');
  for (const k of ['serviceName', 'auditorName', 'letterhead']) if (!text(d.profile[k])) throw new Error('Membrete inválido.');
  if (d.profile.logo !== undefined && (typeof d.profile.logo !== 'string' || d.profile.logo.length > 1500000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(d.profile.logo))) throw new Error('Logotipo inválido.');
  return { companies: d.companies as Company[], audits: d.audits as AuditRecord[], activeAuditId: d.activeAuditId as string | null, activeCompanyId: d.activeCompanyId as string | null, profile: d.profile as unknown as WorkspaceData['profile'], revision: 0 };
}
