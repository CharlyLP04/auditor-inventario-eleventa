import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { ArrowLeft, CloudOff, CloudUpload, CheckCircle2, Circle, Loader, LayoutGrid, ShieldCheck } from 'lucide-react';
import type { Product, CountMode, AuditRecord, AuditorProfile, Company, ScannerPreferences } from '../../types';
import type { CloudUser, CloudCompany } from '../../services/cloud/repository';
import { useCloudAudit } from '../../hooks/useCloudAudit';
import type { CloudMember, CloudAuditStore } from '../../hooks/useCloudAudit';
import { calculateStats, isCounted } from '../../services/auditState';
import { DEFAULT_SCANNER, validPreferences } from '../../services/scannerState';
import { readWorkspace } from '../../services/storageIndexedDB';
import { StoreIcon, TicketIcon, CardStockIcon } from '../CustomIcons';
import { InventoryTable } from '../InventoryTable';
import { AuditSummary } from '../AuditSummary';
import { AuditContext } from '../AuditContext';
import { CatalogVerification } from '../CatalogVerification';
import { DepartmentSummary } from '../DepartmentSummary';
import { BarcodeScanner } from '../BarcodeScanner';

const ExportModal = lazy(() => import('../ExportModal').then(m => ({ default: m.ExportModal })));
type Tab = 'departments' | 'scanner' | 'list' | 'stats';
const DepartmentsIcon = ({ size = 22 }: { size?: number; solid?: boolean }) => <LayoutGrid size={size} aria-hidden="true" />;
const tabs: { id: Tab; title: string; label?: string; icon: typeof StoreIcon }[] = [
  { id: 'departments', title: 'Deptos.', label: 'Departamentos', icon: DepartmentsIcon }, { id: 'scanner', title: 'Contar', icon: StoreIcon },
  { id: 'list', title: 'Auditoría', icon: TicketIcon }, { id: 'stats', title: 'Balance', icon: CardStockIcon },
];

// Preferencias del escáner en modo equipo: son de cada dispositivo, no se comparten.
const PREFS_KEY = 'auditor_cloud_scanner';
function useDevicePreferences(): [ScannerPreferences, (value: ScannerPreferences) => Promise<boolean>] {
  const [prefs, setPrefs] = useState<ScannerPreferences>(() => { try { const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null'); return validPreferences(saved) ? saved : { ...DEFAULT_SCANNER }; } catch { return { ...DEFAULT_SCANNER }; } });
  const save = async (value: ScannerPreferences) => { setPrefs(value); try { localStorage.setItem(PREFS_KEY, JSON.stringify(value)); } catch { /* Preferencia opcional. */ } return true; };
  return [prefs, save];
}

export function CloudAuditView({ db, user, auditId, companies, members, online, onBack, onPending }: {
  db: Firestore; user: CloudUser; auditId: string; companies: CloudCompany[]; members: CloudMember[]; online: boolean;
  onBack: () => void; onPending: (count: number) => void;
}) {
  const store = useCloudAudit(db, user, auditId);
  const [tab, setTab] = useState<Tab>('departments');
  const [prefs, savePrefs] = useDevicePreferences();
  const [lastScannedInfo, setLastScannedInfo] = useState<{ code: string; description: string; quantity: number; theoretical: number; isNew: boolean } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [profile, setProfile] = useState<AuditorProfile | undefined>();
  const authorized = useRef(new Set<string>());
  useEffect(() => { onPending(store.pending); }, [store.pending, onPending]);
  useEffect(() => { readWorkspace().then(data => setProfile(data.profile)).catch(() => setProfile(undefined)); }, []);
  const { audit, products } = store;
  const stats = useMemo(() => calculateStats(products), [products]);
  const isAdmin = user.role === 'admin';
  const company = companies.find(c => c.id === audit?.companyId);
  const readOnly = audit?.status !== 'in_progress';
  const mine = store.departments.filter(d => d.assignee === user.uid);

  if (!audit) return <div><p role="status" className="message">{store.error || 'Abriendo auditoría…'}</p><button className="secondary" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> Volver</button></div>;
  const record: AuditRecord = { id: audit.id, companyId: audit.companyId, title: audit.title, period: audit.period, status: audit.status, createdAt: audit.createdAt ?? '', completedAt: audit.completedAt ?? undefined, products, stats, notes: audit.notes };
  const companyRecord: Company | undefined = company ? { id: company.id, name: company.name, contactName: company.contactName, phone: company.phone, address: company.address, notes: company.notes, createdAt: '' } : undefined;

  /**
   * Antes de contar en un departamento ajeno o libre se pide una decisión explícita; así no se cuenta dos veces sin querer.
   * Devuelve si la captura queda marcada "fuera de asignación", o null si la persona decidió no contarlo.
   */
  const confirmDepartment = async (product: Product): Promise<boolean | null> => {
    if (product.isUnregistered) return false;
    const department = store.departments.find(d => d.name === product.department);
    if (!department || department.assignee === user.uid) return false;
    if (authorized.current.has(department.name)) return true;
    if (department.assignee) {
      if (!window.confirm(`${department.name} lo está contando ${department.assigneeName}. ¿Contar este producto de todos modos? Quedará marcado para revisión.`)) return null;
      authorized.current.add(department.name); return true;
    }
    if (online && window.confirm(`El departamento ${department.name} no tiene responsable. ¿Tomarlo para contarlo tú?`)) return await store.claim(department.name) ? false : null;
    if (!window.confirm(`${department.name} no tiene responsable${online ? '' : ' y sin conexión no se puede tomar'}. ¿Contar de todos modos? Quedará marcado para revisión.`)) return null;
    authorized.current.add(department.name); return true;
  };
  const handleScan = async (code: string, quantity = 1, mode: CountMode = 'add') => {
    if (readOnly) { store.setError('La auditoría no está en curso: no se pueden registrar conteos.'); return null; }
    const product = products.find(p => p.code === code);
    if (!product) throw new Error(`El código ${code} no está en esta auditoría.`);
    const outside = await confirmDepartment(product);
    if (outside === null) throw new Error(`No se contó: ${product.department} no es uno de tus departamentos. Tómalo en Departamentos o confirma para contarlo marcado.`);
    const saved = store.recordCount(code, quantity, mode, outside);
    setLastScannedInfo({ code: saved.code, description: saved.description, quantity: saved.physicalStock, theoretical: saved.theoreticalStock, isNew: Boolean(saved.isUnregistered) });
    return saved;
  };

  return <div className="cloud-audit">
    <div className="cloud-audit-bar">
      <button className="secondary" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> Auditorías</button>
      <SyncBadge online={online} pending={store.pending} />
    </div>
    <AuditContext key={audit.id} audit={record} companyName={company?.name} busy={false} pendingCount={stats.notCountedCount} canManage={isAdmin}
      updateAudit={async (_id, patch) => patch.status !== audit.status ? store.setAuditStatus(patch.status) : store.saveNotes(patch.notes ?? '')}
      onFinish={isAdmin ? () => setExporting(true) : undefined} />
    <p className="cloud-mine" role="status">{mine.length ? <>Tus departamentos: <strong>{mine.map(d => d.name).join(', ')}</strong></> : 'Aún no tomas ningún departamento. Elige uno en Departamentos para evitar contar lo mismo que otra persona.'}</p>
    {store.error && <p role="alert" className="message warning">{store.error} <button className="secondary" onClick={() => store.setError('')}>Entendido</button></p>}
    {store.loading && <p role="status" className="message">Cargando catálogo…</p>}

    <nav className="app-nav cloud-nav" aria-label="Secciones de la auditoría">
      {tabs.map(({ id, title, label, icon: Icon }) => <button key={id} aria-label={label} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}><Icon size={22} solid={tab === id} /><span>{title}</span></button>)}
    </nav>

    {tab === 'departments' && <DepartmentBoard store={store} user={user} members={members} online={online} products={products} readOnly={readOnly} />}
    {tab === 'scanner' && (readOnly
      ? <p className="message">La auditoría está {audit.status === 'completed' ? 'completada' : 'cerrada'}. Un administrador puede reabrirla.</p>
      : <div className="count-layout">
        <BarcodeScanner onScan={handleScan} lastScannedInfo={lastScannedInfo} products={products} preferences={prefs} onPreferencesChange={savePrefs} canUndo={store.canUndo}
          onUndo={async () => { const done = store.undo(); if (done) setLastScannedInfo(null); return done; }}
          onRegisterUnregistered={async input => { const saved = store.register(input); setLastScannedInfo({ code: saved.code, description: saved.description, quantity: saved.physicalStock, theoretical: 0, isNew: true }); return saved; }}
          onRestoreUnregistered={async code => store.restoreUnregistered(code)} />
        <aside className="desktop-only"><AuditSummary stats={stats} products={products} /></aside>
      </div>)}
    {tab === 'list' && <InventoryTable products={products} readOnly={readOnly} isAdmin={false}
      onUpdateQuantity={async (code, quantity) => { const product = products.find(p => p.code === code); if (!product) return false; const outside = await confirmDepartment(product); if (outside === null) return false; store.recordCount(code, quantity, 'set', outside); return true; }}
      unregisteredActions={{
        onEdit: async (code, patch) => store.editUnregistered(code, patch), onExclude: async (code, reason) => store.excludeUnregistered(code, reason),
        onRestore: async code => store.restoreUnregistered(code), onLink: async (code, target) => store.linkUnregistered(code, target),
      }} />}
    {tab === 'stats' && <>
      <CatalogVerification products={products} report={audit.catalog?.report} />
      <PeopleProgress contributors={store.contributors} members={members} products={products} />
      {isAdmin && <IntegrityCheck verify={store.verify} />}
      <DepartmentSummary products={products} />
      <AuditSummary stats={stats} products={products} />
    </>}
    {exporting && isAdmin && <Suspense fallback={<p role="status" className="message">Cargando dictamen…</p>}>
      <ExportModal isOpen onClose={() => setExporting(false)} products={products} stats={stats} company={companyRecord} audit={record} profile={profile} />
    </Suspense>}
  </div>;
}

function SyncBadge({ online, pending }: { online: boolean; pending: number }) {
  const state = !online ? 'offline' : pending ? 'syncing' : 'synced';
  return <span className={`sync-badge sync-${state}`} role="status" aria-live="polite">
    {state === 'offline' ? <CloudOff size={16} aria-hidden="true" /> : state === 'syncing' ? <CloudUpload size={16} aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
    {state === 'offline' ? `Sin conexión${pending ? ` · ${pending} por enviar` : ''}` : state === 'syncing' ? `Enviando ${pending}…` : 'Todo sincronizado'}
  </span>;
}

const statusText = { pending: 'Pendiente', in_progress: 'En curso', done: 'Completado' };
function DepartmentBoard({ store, user, members, online, products, readOnly }: { store: CloudAuditStore; user: CloudUser; members: CloudMember[]; online: boolean; products: Product[]; readOnly: boolean }) {
  const [busy, setBusy] = useState('');
  const progress = useMemo(() => {
    const map = new Map<string, { total: number; counted: number }>();
    for (const p of products) { if (p.isUnregistered) continue; const row = map.get(p.department) ?? { total: 0, counted: 0 }; row.total++; if (isCounted(p)) row.counted++; map.set(p.department, row); }
    return map;
  }, [products]);
  const act = async (name: string, action: () => Promise<boolean>) => { setBusy(name); await action(); setBusy(''); };
  const sorted = [...store.departments].sort((a, b) => Number(b.assignee === user.uid) - Number(a.assignee === user.uid) || a.name.localeCompare(b.name, 'es'));
  const done = store.departments.filter(d => d.status === 'done').length;
  return <section aria-labelledby="departments-title">
    <div className="page-heading"><div><p className="eyebrow">REPARTO DEL TRABAJO</p><h2 id="departments-title">Departamentos</h2></div><span className="count-badge">{done} / {store.departments.length} completados</span></div>
    {!online && <p className="message warning">Sin conexión no se pueden tomar ni soltar departamentos; puedes seguir contando en los tuyos.</p>}
    <ul className="department-board">{sorted.map(d => {
      const row = progress.get(d.name) ?? { total: 0, counted: 0 };
      const isMine = d.assignee === user.uid;
      const StatusIcon = d.status === 'done' ? CheckCircle2 : d.status === 'in_progress' ? Loader : Circle;
      return <li key={d.key} className={`department-row dept-${d.status} ${isMine ? 'is-mine' : ''}`}>
        <div className="department-main">
          <strong>{d.name}</strong>
          <small>{row.counted} de {row.total} productos contados</small>
          <progress max={row.total || 1} value={row.counted} aria-label={`Avance en ${d.name}`} />
        </div>
        <span className={`dept-status status-${d.status}`}><StatusIcon size={15} aria-hidden="true" /> {statusText[d.status]}</span>
        <span className="dept-owner">{isMine ? 'Tú' : d.assigneeName ?? 'Sin responsable'}</span>
        <div className="department-actions">
          {!readOnly && !d.assignee && <button className="primary" disabled={!online || busy === d.name} onClick={() => act(d.name, () => store.claim(d.name))}>Tomar</button>}
          {!readOnly && isMine && d.status !== 'done' && <button className="primary" disabled={!online || busy === d.name} onClick={() => {
            if (row.counted < row.total && !window.confirm(`Quedan ${row.total - row.counted} productos sin contar en ${d.name}. ¿Marcarlo como completado?`)) return;
            void act(d.name, () => store.setStatus(d.name, 'done'));
          }}>Marcar completado</button>}
          {!readOnly && isMine && d.status === 'done' && <button className="secondary" disabled={!online || busy === d.name} onClick={() => act(d.name, () => store.setStatus(d.name, 'in_progress'))}>Reabrir</button>}
          {!readOnly && isMine && <button className="secondary" disabled={!online || busy === d.name} onClick={() => act(d.name, () => store.release(d.name))}>Soltar</button>}
          {!readOnly && user.role === 'admin' && !isMine && <label className="dept-reassign">Reasignar<select disabled={!online || busy === d.name} value={d.assignee ?? ''} onChange={e => {
            const member = members.find(m => m.uid === e.target.value);
            if (!window.confirm(member ? `¿Asignar ${d.name} a ${member.name}?` : `¿Dejar ${d.name} sin responsable?`)) return;
            void act(d.name, () => store.reassign(d.name, member ? { uid: member.uid, name: member.name } : null));
          }}><option value="">Sin responsable</option>{members.filter(m => m.active).map(m => <option key={m.uid} value={m.uid}>{m.name}</option>)}</select></label>}
        </div>
      </li>;
    })}</ul>
  </section>;
}

function PeopleProgress({ contributors, members, products }: { contributors: Record<string, string[]>; members: CloudMember[]; products: Product[] }) {
  const name = (uid: string) => members.find(m => m.uid === uid)?.name ?? 'Persona sin acceso';
  const perPerson = new Map<string, number>();
  for (const people of Object.values(contributors)) for (const uid of people) perPerson.set(uid, (perPerson.get(uid) ?? 0) + 1);
  const shared = products.filter(p => (contributors[p.code]?.length ?? 0) > 1 && !p.excludedAt);
  return <section className="workspace-card people-progress" aria-labelledby="people-title">
    <h3 id="people-title">Avance por persona</h3>
    <ul>{[...perPerson].map(([uid, count]) => <li key={uid}><strong>{name(uid)}</strong> · {count} productos capturados</li>)}</ul>
    {shared.length > 0 && <div className="message warning" role="status">
      <p><strong>{shared.length} productos los capturaron dos o más personas.</strong> Revisa que no se hayan contado dos veces:</p>
      <ul>{shared.slice(0, 30).map(p => <li key={p.code}>{p.description} · {p.code} · {contributors[p.code].map(name).join(' y ')} · total {p.physicalStock}</li>)}</ul>
    </div>}
  </section>;
}

function IntegrityCheck({ verify }: { verify: () => Promise<{ code: string; captures: number; counters: number }[]> }) {
  const [state, setState] = useState<{ busy: boolean; result?: { code: string; captures: number; counters: number }[]; error?: string }>({ busy: false });
  return <section className="workspace-card" aria-labelledby="integrity-title">
    <h3 id="integrity-title"><ShieldCheck size={18} aria-hidden="true" /> Verificación de integridad</h3>
    <p>Recalcula cada total desde el historial de capturas y lo compara con los contadores compartidos. Lee todo el historial (consume lecturas).</p>
    <button className="secondary" disabled={state.busy} onClick={async () => {
      setState({ busy: true });
      try { setState({ busy: false, result: await verify() }); } catch (e) { setState({ busy: false, error: e instanceof Error ? e.message : 'No se pudo verificar.' }); }
    }}>{state.busy ? 'Verificando…' : 'Verificar ahora'}</button>
    {state.error && <p role="alert" className="message warning">{state.error}</p>}
    {state.result && (state.result.length
      ? <div role="alert" className="message warning"><p>{state.result.length} productos no coinciden con su historial:</p><ul>{state.result.slice(0, 30).map(r => <li key={r.code}>{r.code}: historial {r.captures}, contador {r.counters}</li>)}</ul></div>
      : <p role="status" className="verification-ok">✓ Todos los totales coinciden con el historial de capturas.</p>)}
  </section>;
}
