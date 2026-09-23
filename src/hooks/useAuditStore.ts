import { useEffect, useRef, useState } from 'react';
import type { Product, WorkspaceData, Company, AuditRecord, AuditorProfile } from '../types';
import { calculateStats, validateProducts } from '../services/auditState';
import { initializeWorkspace, writeWorkspace, newAudit, parseMasterBackup, recoverWorkspace, LEGACY_KEY } from '../services/storageIndexedDB';
import type { PreparedDownload } from '../services/fileDownload';
import { prepareDownload, startDownload, releaseDownload } from '../services/fileDownload';
export const STORAGE_KEY = LEGACY_KEY;
export function useAuditStore() {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const state = useRef<WorkspaceData | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [backupDownload, setBackupDownload] = useState<PreparedDownload | null>(null);
  const backupRef = useRef<PreparedDownload | null>(null);
  const locked = useRef(false);
  const productsRef = useRef<{ products: Product[] }>({ products: [] });
  const adopt = (next: WorkspaceData) => {
    state.current = next; productsRef.current.products = next.audits.find(a => a.id === next.activeAuditId)?.products ?? []; setData(next);
  };
  useEffect(() => {
    let mounted = true;
    initializeWorkspace().then(next => { if (mounted) adopt(next); }).catch(e => { if (mounted) setError(String(e.message)); });
    const leaving = (event: BeforeUnloadEvent) => { if (locked.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', leaving);
    return () => { mounted = false; if (backupRef.current) releaseDownload(backupRef.current); window.removeEventListener('beforeunload', leaving); };
  }, []);
  const change = async (update: (d: WorkspaceData) => WorkspaceData, replace = false) => {
    if (!state.current || locked.current) { setError('Espera a que termine el guardado antes de continuar.'); return false; }
    locked.current = true; setBusy(true);
    try { adopt(await writeWorkspace(update(state.current), state.current.revision, replace, state.current)); setError(''); return true; }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.'); return false; }
    finally { locked.current = false; setBusy(false); }
  };
  const expectedAuditId = data?.activeAuditId;
  const commit = async (products: Product[], _replace = false) => {
    if (state.current?.activeAuditId !== expectedAuditId) { setError('La auditoría activa cambió. Vuelve a importar o contar en la empresa seleccionada.'); return false; }
    if (!validateProducts(products)) { setError('El catálogo contiene datos inválidos.'); return false; }
    const current = state.current?.audits.find(a => a.id === state.current?.activeAuditId);
    if (!current || current.status !== 'in_progress') { setError('Selecciona una auditoría en curso para editar el conteo.'); return false; }
    return change(d => ({ ...d, audits: d.audits.map(a => a.id === d.activeAuditId ? { ...a, products, stats: calculateStats(products) } : a) }));
  };
  const backup = () => {
    try {
    const content = state.current ? JSON.stringify({ format: 'auditor-eleventa-master', version: 1, exportedAt: new Date().toISOString(), data: state.current }, null, 2) : localStorage.getItem(LEGACY_KEY) ?? '[]';
    const file = prepareDownload(new Blob([content], { type: 'application/json' }), state.current ? 'Respaldo_Maestro_Auditor.json' : 'Respaldo_Anterior_Auditor.json');
    if (backupRef.current) releaseDownload(backupRef.current);
    backupRef.current = file; setBackupDownload(file);
    startDownload(file);
    } catch { setError('No se pudo iniciar la descarga. Usa el enlace Guardar respaldo si está disponible.'); }
  };
  const saveCompany = (company: Company) => change(d => ({ ...d, companies: [...d.companies.filter(c => c.id !== company.id), company] }));
  const createAudit = (companyId: string, period: string) => change(d => {
    if (!d.companies.some(c => c.id === companyId) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('Selecciona una empresa y un mes válido.');
    if (d.audits.some(a => a.companyId === companyId && a.period === period)) throw new Error('Ya existe una auditoría de esa empresa para ese mes. Abre su historial.');
    const audit = newAudit(companyId, period);
    return { ...d, audits: [...d.audits, audit], activeAuditId: audit.id, activeCompanyId: companyId, companies: d.companies.map(c => c.id === companyId ? { ...c, lastAuditAt: audit.createdAt } : c) };
  });
  const selectAudit = (id: string) => change(d => {
    if (!d.audits.some(a => a.id === id)) throw new Error('Auditoría no encontrada.');
    return { ...d, activeAuditId: id, activeCompanyId: d.audits.find(a => a.id === id)!.companyId };
  });
  const selectCompany = (id: string) => change(d => {
    if (!d.companies.some(c => c.id === id)) throw new Error('Empresa no encontrada.');
    const latest = d.audits.filter(a => a.companyId === id).sort((a, b) => b.period.localeCompare(a.period))[0];
    return { ...d, activeCompanyId: id, activeAuditId: latest?.id ?? null };
  });
  const updateAudit = (id: string, patch: Pick<AuditRecord, 'status' | 'notes'>) => change(d => ({ ...d, audits: d.audits.map(a => a.id === id ? { ...a, ...patch, completedAt: patch.status === 'in_progress' ? undefined : a.completedAt ?? new Date().toISOString() } : a) }));
  const removeCompany = (id: string) => change(d => {
    const audits = d.audits.filter(a => a.companyId !== id);
    return { ...d, companies: d.companies.filter(c => c.id !== id), audits, activeCompanyId: d.activeCompanyId === id ? null : d.activeCompanyId, activeAuditId: audits.some(a => a.id === d.activeAuditId) ? d.activeAuditId : null };
  }, true);
  const removeAudit = (id: string) => change(d => ({ ...d, audits: d.audits.filter(a => a.id !== id), activeAuditId: d.activeAuditId === id ? null : d.activeAuditId }), true);
  const saveProfile = (profile: AuditorProfile) => change(d => ({ ...d, profile }));
  const restore = async (file: File) => {
    try {
      if (file.size > 250 * 1024 * 1024) throw new Error('El respaldo supera 250 MB.');
      const restored = parseMasterBackup(await file.text());
      if (!window.confirm(`Reemplazar los datos locales por ${restored.companies.length} empresas y ${restored.audits.length} auditorías. Descarga primero tu respaldo actual. ¿Continuar?`)) return false;
      return await change(() => restored, true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Respaldo inválido.'); return false; }
  };
  const recover = async () => {
    if (!window.confirm('¿Abrir el directorio sin migrar el conteo anterior? El original se conservará en localStorage. Descarga primero su respaldo.')) return;
    try { adopt(await recoverWorkspace()); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo abrir IndexedDB.'); }
  };
  const activeAudit = data?.audits.find(a => a.id === data.activeAuditId);
  return { data, activeAudit, products: activeAudit?.products ?? [], productsRef, error, busy, commit, backup, backupDownload, saveCompany, createAudit, selectAudit, updateAudit, removeCompany, removeAudit, saveProfile, restore, recover, selectCompany };
}
export type AuditStore = ReturnType<typeof useAuditStore>;
