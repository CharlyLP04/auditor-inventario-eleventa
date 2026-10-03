import { useEffect, useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { ArrowUpRight, Plus, UploadCloud, UserPlus } from 'lucide-react';
import type { Product, ImportReport, AuditRecord } from '../../types';
import type { CloudUser, CloudAudit, CloudCompany } from '../../services/cloud/repository';
import { createCompany, createCloudAudit, uploadLocalAudit, saveMember } from '../../services/cloud/repository';
import type { CloudMember } from '../../hooks/useCloudAudit';
import { authMessage } from '../../hooks/useCloudSession';
import { readWorkspace } from '../../services/storageIndexedDB';
import { ExcelUploader } from '../ExcelUploader';

const statusLabel = { in_progress: 'En curso', completed: 'Completada', closed: 'Cerrada' };
const month = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; };

export function CloudHome({ db, user, workspace, online, onOpen }: {
  db: Firestore; user: CloudUser; online: boolean; onOpen: (auditId: string) => void;
  workspace: { companies: CloudCompany[]; audits: CloudAudit[]; members: CloudMember[] };
}) {
  const { companies, audits, members } = workspace;
  const isAdmin = user.role === 'admin';
  const companyName = (id: string) => companies.find(c => c.id === id)?.name ?? 'Empresa';
  const open = audits.filter(a => a.status === 'in_progress');
  const history = audits.filter(a => a.status !== 'in_progress');
  return <div className="cloud-home">
    <section aria-labelledby="open-audits">
      <div className="page-heading"><div><p className="eyebrow">AUDITORÍAS EN EQUIPO</p><h2 id="open-audits">Elige la auditoría</h2></div></div>
      {!open.length && <p className="message">{isAdmin ? 'No hay auditorías abiertas. Crea una abajo con el catálogo de eleventa.' : 'No hay auditorías abiertas. Un administrador debe crearla.'}</p>}
      <div className="cloud-audit-list">{open.map(a => <AuditCard key={a.id} audit={a} company={companyName(a.companyId)} onOpen={() => onOpen(a.id)} />)}</div>
      {history.length > 0 && <details className="cloud-history"><summary>Historial ({history.length})</summary><div className="cloud-audit-list">{history.map(a => <AuditCard key={a.id} audit={a} company={companyName(a.companyId)} onOpen={() => onOpen(a.id)} />)}</div></details>}
    </section>
    {isAdmin && <NewAudit db={db} user={user} companies={companies} online={online} onCreated={onOpen} />}
    {isAdmin && <UploadLocal db={db} user={user} companies={companies} online={online} onCreated={onOpen} />}
    {isAdmin && <Members db={db} user={user} members={members} online={online} />}
  </div>;
}

function AuditCard({ audit, company, onOpen }: { audit: CloudAudit; company: string; onOpen: () => void }) {
  return <button className="workspace-card cloud-audit-card" onClick={onOpen}>
    <span><strong>{company}</strong><small>{audit.title} · {audit.catalog?.products.toLocaleString('es-MX') ?? 0} productos</small></span>
    <span className={`cloud-status status-${audit.status}`}>{statusLabel[audit.status]}</span>
    <ArrowUpRight size={20} aria-hidden="true" />
  </button>;
}

function CompanyPicker({ companies, value, onChange, newName, onNewName }: { companies: CloudCompany[]; value: string; onChange: (id: string) => void; newName: string; onNewName: (name: string) => void }) {
  return <>
    <label>Empresa<select value={value} onChange={e => onChange(e.target.value)}><option value="">— Nueva empresa —</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    {!value && <label>Nombre de la nueva empresa<input maxLength={200} value={newName} onChange={e => onNewName(e.target.value)} placeholder="Ej. Abarrotes Don Pepe" /></label>}
  </>;
}
async function resolveCompany(db: Firestore, user: CloudUser, companyId: string, newName: string) {
  if (companyId) return companyId;
  if (!newName.trim()) throw new Error('Escribe el nombre de la empresa o elige una existente.');
  return createCompany(db, user, { name: newName.trim() });
}

function NewAudit({ db, user, companies, online, onCreated }: { db: Firestore; user: CloudUser; companies: CloudCompany[]; online: boolean; onCreated: (id: string) => void }) {
  const [companyId, setCompanyId] = useState(''), [newName, setNewName] = useState(''), [period, setPeriod] = useState(month);
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const create = async (products: Product[], report?: ImportReport) => {
    if (!online) { setMessage('Crear una auditoría requiere conexión.'); return; }
    setBusy(true); setMessage('');
    try {
      const company = await resolveCompany(db, user, companyId, newName);
      onCreated(await createCloudAudit(db, user, { companyId: company, period, products, report }));
    } catch (e) { setMessage(authMessage(e)); } finally { setBusy(false); }
  };
  return <section className="workspace-card cloud-admin" aria-labelledby="new-audit-title">
    <h3 id="new-audit-title"><Plus size={18} aria-hidden="true" /> Nueva auditoría compartida</h3>
    <fieldset className="workspace-fields workspace-form" disabled={busy}>
      <CompanyPicker companies={companies} value={companyId} onChange={setCompanyId} newName={newName} onNewName={setNewName} />
      <label>Periodo<input type="month" required value={period} onChange={e => setPeriod(e.target.value)} /></label>
    </fieldset>
    {message && <p role="alert" className="message warning">{message}</p>}
    {busy ? <p role="status" className="message">Guardando catálogo en la nube…</p> : <ExcelUploader onProductsLoaded={create} currentCount={0} />}
  </section>;
}

function UploadLocal({ db, user, companies, online, onCreated }: { db: Firestore; user: CloudUser; companies: CloudCompany[]; online: boolean; onCreated: (id: string) => void }) {
  const [local, setLocal] = useState<AuditRecord[] | null>(null);
  const [selected, setSelected] = useState(''), [companyId, setCompanyId] = useState(''), [newName, setNewName] = useState('');
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { readWorkspace().then(data => setLocal(data.audits.filter(a => a.products.length))).catch(() => setLocal([])); }, []);
  if (!local?.length) return null;
  const audit = local.find(a => a.id === selected);
  return <section className="workspace-card cloud-admin" aria-labelledby="upload-title">
    <h3 id="upload-title"><UploadCloud size={18} aria-hidden="true" /> Subir una auditoría de este dispositivo</h3>
    <p>Copia catálogo y conteos a la nube para seguir contando en equipo. Los datos de este dispositivo no se modifican.</p>
    <fieldset className="workspace-fields workspace-form" disabled={busy}>
      <label>Auditoría local<select value={selected} onChange={e => setSelected(e.target.value)}><option value="">Elige una auditoría</option>{local.map(a => <option key={a.id} value={a.id}>{a.title} · {a.stats.auditedCount}/{a.stats.totalCatalog} contados</option>)}</select></label>
      <CompanyPicker companies={companies} value={companyId} onChange={setCompanyId} newName={newName} onNewName={setNewName} />
      <button className="primary" disabled={!audit || !online} onClick={async () => {
        if (!audit) return;
        setBusy(true); setMessage('');
        try {
          const company = await resolveCompany(db, user, companyId, newName);
          const result = await uploadLocalAudit(db, user, { companyId: company, period: audit.period, products: audit.products, report: audit.importReport });
          setMessage(`Se subieron ${result.migrated} productos contados${result.skippedExcluded ? `; ${result.skippedExcluded} excluidos se quedan solo en este dispositivo` : ''}.`);
          onCreated(result.auditId);
        } catch (e) { setMessage(authMessage(e)); } finally { setBusy(false); }
      }}>{online ? 'Subir a la nube' : 'Requiere conexión'}</button>
    </fieldset>
    {message && <p role="status" className="message">{message}</p>}
  </section>;
}

function Members({ db, user, members, online }: { db: Firestore; user: CloudUser; members: CloudMember[]; online: boolean }) {
  const [uid, setUid] = useState(''), [name, setName] = useState(''), [email, setEmail] = useState(''), [role, setRole] = useState<'admin' | 'auditor'>('auditor');
  const [message, setMessage] = useState('');
  const save = async (target: string, data: Omit<CloudMember, 'uid'>) => {
    try { await saveMember(db, user, target, data); setMessage('Acceso actualizado.'); return true; } catch (e) { setMessage(authMessage(e)); return false; }
  };
  return <section className="workspace-card cloud-admin" aria-labelledby="members-title">
    <h3 id="members-title"><UserPlus size={18} aria-hidden="true" /> Personas con acceso</h3>
    <ul className="cloud-members">{members.map(m => <li key={m.uid}>
      <span><strong>{m.name}</strong><small>{m.email || m.uid} · {m.role === 'admin' ? 'Administrador' : 'Auditor'} · {m.active ? 'Activo' : 'Sin acceso'}</small></span>
      {m.uid !== user.uid && <button className="secondary" disabled={!online} onClick={() => { void save(m.uid, { name: m.name, email: m.email, role: m.role, active: !m.active }); }}>{m.active ? 'Quitar acceso' : 'Dar acceso'}</button>}
    </li>)}</ul>
    <form className="workspace-form" onSubmit={async e => { e.preventDefault(); if (await save(uid, { name, email, role, active: true })) { setUid(''); setName(''); setEmail(''); } }}>
      <p>Crea la cuenta en la consola de Firebase (Authentication → Agregar usuario). Al entrar, la app le muestra su identificador; pégalo aquí.</p>
      <fieldset className="workspace-fields workspace-form" disabled={!online}>
        <label>Identificador (UID)<input required maxLength={128} value={uid} onChange={e => setUid(e.target.value)} /></label>
        <label>Nombre<input required maxLength={200} value={name} onChange={e => setName(e.target.value)} /></label>
        <label>Correo<input type="email" maxLength={320} value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>Rol<select value={role} onChange={e => setRole(e.target.value as 'admin' | 'auditor')}><option value="auditor">Auditor</option><option value="admin">Administrador</option></select></label>
        <button className="primary">Dar acceso</button>
      </fieldset>
    </form>
    {message && <p role="status" className="message">{message}</p>}
  </section>;
}
