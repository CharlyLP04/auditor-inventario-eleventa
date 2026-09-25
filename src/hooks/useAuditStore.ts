import { useEffect, useRef, useState } from 'react';
import type { Product, WorkspaceData, Company, AuditRecord, AuditorProfile, UserRole, ScannerPreferences, CountMode } from '../types';
import { calculateStats, validateProducts } from '../services/auditState';
import { initializeWorkspace, writeWorkspace, newAudit, parseMasterBackup, recoverWorkspace, readWorkspace, LEGACY_KEY } from '../services/storageIndexedDB';
import type { PreparedDownload } from '../services/fileDownload';
import { prepareDownload, startDownload, releaseDownload } from '../services/fileDownload';
import { applyCount, revertCount, requireAdmin, validatePin, validPreferences, DEFAULT_SCANNER } from '../services/scannerState';
import type { CountUndo } from '../services/scannerState';
export const STORAGE_KEY = LEGACY_KEY;
export function useAuditStore() {
  const [role, setRole] = useState<UserRole>('auditor');
  const roleRef = useRef<UserRole>('auditor');
  const pinAttempts = useRef({ count: 0, until: 0 });
  const undoRef = useRef<{ auditId: string; entry: CountUndo } | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [data, setData] = useState<WorkspaceData | null>(null);
  const state = useRef<WorkspaceData | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [backupDownload, setBackupDownload] = useState<PreparedDownload | null>(null);
  const backupRef = useRef<PreparedDownload | null>(null);
  const locked = useRef(false);
  const productsRef = useRef<{ products: Product[] }>({ products: [] });
  const adopt = (next: WorkspaceData) => {
    if (state.current?.activeAuditId !== next.activeAuditId) { undoRef.current = null; setCanUndo(false); }
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
    if (roleRef.current !== 'admin') { setError('Se requiere Administrador para reemplazar o reiniciar el catálogo.'); return false; }
    if (state.current?.activeAuditId !== expectedAuditId) { setError('La auditoría activa cambió. Vuelve a importar o contar en la empresa seleccionada.'); return false; }
    if (!validateProducts(products)) { setError('El catálogo contiene datos inválidos.'); return false; }
    const current = state.current?.audits.find(a => a.id === state.current?.activeAuditId);
    if (!current || current.status !== 'in_progress') { setError('Selecciona una auditoría en curso para editar el conteo.'); return false; }
    const saved = await change(d => ({ ...d, audits: d.audits.map(a => a.id === d.activeAuditId ? { ...a, products, stats: calculateStats(products) } : a) }));
    if (saved) { undoRef.current = null; setCanUndo(false); }
    return saved;
  };
  const backup = () => {
    try {
      const content = state.current ? JSON.stringify({ format: 'auditor-eleventa-master', version: 1, exportedAt: new Date().toISOString(), data: { ...state.current, security: undefined } }, null, 2) : localStorage.getItem(LEGACY_KEY) ?? '[]';
      const file = prepareDownload(new Blob([content], { type: 'application/json' }), state.current ? 'Respaldo_Maestro_Auditor.json' : 'Respaldo_Anterior_Auditor.json');
      if (backupRef.current) releaseDownload(backupRef.current);
      backupRef.current = file;
      setBackupDownload(null);
      try {
        startDownload(file);
      } catch {
        setBackupDownload(file);
      }
    } catch { setError('No se pudo generar el archivo de respaldo.'); }
  };
  const saveCompany = (company: Company) => change(d => { requireAdmin(roleRef.current); return { ...d, companies: [...d.companies.filter(c => c.id !== company.id), company] }; });
  const createAudit = (companyId: string, period: string) => change(d => {
    requireAdmin(roleRef.current);
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
  const updateAudit = (id: string, patch: Pick<AuditRecord, 'status' | 'notes'>) => change(d => {
    const current = d.audits.find(a => a.id === id);
    if (!current) throw new Error('Auditoría no encontrada.');
    if (patch.status !== current.status) requireAdmin(roleRef.current);
    if (patch.notes !== current.notes && current.status !== 'in_progress') throw new Error('Reabre la auditoría para editar notas.');
    if (!['in_progress', 'completed', 'closed'].includes(patch.status) || (patch.notes !== undefined && (typeof patch.notes !== 'string' || patch.notes.length > 10000))) throw new Error('Notas o estado inválidos.');
    return { ...d, audits: d.audits.map(a => a.id === id ? { ...a, ...patch, completedAt: patch.status === 'in_progress' ? undefined : a.completedAt ?? new Date().toISOString() } : a) };
  });
  const removeCompany = (id: string) => change(d => {
    requireAdmin(roleRef.current);
    const audits = d.audits.filter(a => a.companyId !== id);
    return { ...d, companies: d.companies.filter(c => c.id !== id), audits, activeCompanyId: d.activeCompanyId === id ? null : d.activeCompanyId, activeAuditId: audits.some(a => a.id === d.activeAuditId) ? d.activeAuditId : null };
  }, true);
  const removeAudit = (id: string) => change(d => { requireAdmin(roleRef.current); return { ...d, audits: d.audits.filter(a => a.id !== id), activeAuditId: d.activeAuditId === id ? null : d.activeAuditId }; }, true);
  const saveProfile = (profile: AuditorProfile) => change(d => { requireAdmin(roleRef.current); return { ...d, profile }; });
  const restore = async (file: File) => {
    try {
      requireAdmin(roleRef.current);
      if (file.size > 250 * 1024 * 1024) throw new Error('El respaldo supera 250 MB.');
      const restored = parseMasterBackup(await file.text());
      if (!window.confirm(`Reemplazar los datos locales por ${restored.companies.length} empresas y ${restored.audits.length} auditorías. Descarga primero tu respaldo actual. ¿Continuar?`)) return false;
      return await change(d => { requireAdmin(roleRef.current); return { ...restored, security: d.security }; }, true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Respaldo inválido.'); return false; }
  };
  const recover = async () => {
    if (!window.confirm('¿Abrir el directorio sin migrar el conteo anterior? El original se conservará en localStorage. Descarga primero su respaldo.')) return;
    try { adopt(await recoverWorkspace()); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo abrir IndexedDB.'); }
  };
  const recordCount = async (code: string, quantity: number, mode: CountMode = 'add', zone?: string): Promise<Product | null> => {
    let result: ReturnType<typeof applyCount> | undefined;
    const saved = await change(d => {
      const audit = d.audits.find(a => a.id === expectedAuditId);
      if (!audit || d.activeAuditId !== expectedAuditId || audit.status !== 'in_progress') throw new Error('Abre una auditoría en curso para contar.');
      result = applyCount(audit.products, code, quantity, mode, zone);
      return { ...d, audits: d.audits.map(a => a.id === audit.id ? { ...a, products: result!.products, stats: calculateStats(result!.products) } : a) };
    });
    if (!saved || !result || !expectedAuditId) return null;
    undoRef.current = { auditId: expectedAuditId, entry: result.undo }; setCanUndo(true);
    return result.product;
  };
  const undoCount = async () => {
    const undo = undoRef.current;
    if (!undo) return false;
    const saved = await change(d => {
      const audit = d.audits.find(a => a.id === d.activeAuditId);
      if (!audit || audit.id !== undo.auditId || audit.status !== 'in_progress') throw new Error('No se puede deshacer en esta auditoría.');
      const products = revertCount(audit.products, undo.entry);
      return { ...d, audits: d.audits.map(a => a.id === audit.id ? { ...a, products, stats: calculateStats(products) } : a) };
    });
    if (saved) { undoRef.current = null; setCanUndo(false); }
    return saved;
  };
  const updateProduct = (code: string, patch: Partial<Pick<Product, 'department' | 'cost' | 'price'>>) => change(d => {
    const audit = d.audits.find(a => a.id === expectedAuditId);
    if (!audit || audit.id !== d.activeAuditId || audit.status !== 'in_progress') throw new Error('Abre una auditoría en curso.');
    if (!audit.products.some(p => p.code === code)) throw new Error('Producto no encontrado.');
    if (Object.keys(patch).some(k => !['department', 'cost', 'price'].includes(k))) throw new Error('Campo no editable.');
    if (patch.cost !== undefined || patch.price !== undefined) requireAdmin(roleRef.current);
    if (patch.department !== undefined && (!patch.department.trim() || patch.department.length > 200)) throw new Error('Departamento inválido (1 a 200 caracteres).');
    const products = audit.products.map(p => p.code === code ? { ...p, ...patch, department: patch.department?.trim() ?? p.department } : p);
    if (!validateProducts(products)) throw new Error('Precio o costo inválido.');
    return { ...d, audits: d.audits.map(a => a.id === audit.id ? { ...a, products, stats: calculateStats(products) } : a) };
  });
  const saveScannerPreferences = (preferences: ScannerPreferences) => change(d => {
    if (!validPreferences(preferences)) throw new Error('Preferencias inválidas.');
    return { ...d, scannerPreferences: preferences };
  });
  const authenticatePin = async (pin: string) => {
    if (locked.current || !state.current) throw new Error('Espera a que termine el guardado.');
    if (Date.now() < pinAttempts.current.until) throw new Error('Demasiados intentos. Espera 30 segundos.');
    const latest = await readWorkspace();
    if (latest.revision !== state.current.revision) throw new Error('Los datos cambiaron en otra pestaña. Recarga antes de continuar.');
    if (!validatePin(pin) || pin !== (latest.security?.adminPin ?? '1234')) {
      pinAttempts.current.count++;
      if (pinAttempts.current.count >= 5) { pinAttempts.current.until = Date.now() + 30000; pinAttempts.current.count = 0; }
      throw new Error('PIN incorrecto.');
    }
    pinAttempts.current = { count: 0, until: 0 };
  };
  const unlockAdmin = async (pin: string) => { await authenticatePin(pin); roleRef.current = 'admin'; setRole('admin'); };
  const lockAdmin = () => { roleRef.current = 'auditor'; setRole('auditor'); };
  const changePin = async (currentPin: string, newPin: string) => {
    requireAdmin(roleRef.current);
    if (!validatePin(newPin)) throw new Error('El PIN nuevo debe tener exactamente 4 dígitos.');
    await authenticatePin(currentPin);
    return change(d => { requireAdmin(roleRef.current); return { ...d, security: { adminPin: newPin } }; });
  };
  const activeAudit = data?.audits.find(a => a.id === data.activeAuditId);
  return { role, unlockAdmin, lockAdmin, changePin, recordCount, undoCount, canUndo, updateProduct, saveScannerPreferences, scannerPreferences: data?.scannerPreferences ?? DEFAULT_SCANNER, data, activeAudit, products: activeAudit?.products ?? [], productsRef, error, busy, commit, backup, backupDownload, saveCompany, createAudit, selectAudit, updateAudit, removeCompany, removeAudit, saveProfile, restore, recover, selectCompany };
}
export type AuditStore = ReturnType<typeof useAuditStore>;
