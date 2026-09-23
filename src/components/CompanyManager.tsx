import { useState } from 'react';
import type { Company, AuditorProfile } from '../types';
import { createId } from '../services/storageIndexedDB';
import type { AuditStore } from '../hooks/useAuditStore';
const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const statusLabel = { in_progress: 'En curso', completed: 'Completada', closed: 'Cerrada' };
const month = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; };
export function CompanyManager({ store, onOpen }: { store: AuditStore; onOpen: () => void }) {
  const [editing, setEditing] = useState<Company | null>(null);
  const [selected, setSelected] = useState(store.data?.activeCompanyId ?? '');
  const [period, setPeriod] = useState(month);
  const [message, setMessage] = useState('');
  if (!store.data) return <div><p role="status">{store.error ? "No se pudo abrir el directorio local." : "Abriendo directorio local…"}</p>{store.error && <button className="secondary" onClick={store.recover}>Abrir directorio conservando el respaldo anterior</button>}</div>;
  const data = store.data;
  const company = data.companies.find(c => c.id === selected);
  const history = data.audits.filter(a => a.companyId === selected).sort((a, b) => b.period.localeCompare(a.period));
  return <div className="company-manager">
    <p className="message">Los datos se guardan en este navegador y dispositivo. Descarga el respaldo maestro para trasladarlos o conservar una copia fuera del equipo.</p>
    {message && <p role="status" className="message">{message}</p>}
    <fieldset disabled={store.busy} className="workspace-fields">
      <div className="workspace-actions">
        <button className="primary" onClick={() => setEditing({ id: createId(), name: '', createdAt: new Date().toISOString() })}>Nueva empresa</button>
        <button className="secondary" onClick={store.backup}>Respaldo maestro</button>
        <label className="secondary file-label">Restaurar respaldo maestro<input type="file" accept=".json,application/json" onChange={async e => { const file = e.target.files?.[0]; e.target.value = ''; if (file && await store.restore(file)) { setSelected(''); setEditing(null); setMessage('Respaldo restaurado.'); } }} /></label>
      </div>
      {editing && <form key={editing.id} className="workspace-card workspace-form" onSubmit={async e => {
        e.preventDefault(); const fields = new FormData(e.currentTarget);
        const value = (key: string) => String(fields.get(key) ?? '').trim();
        if (!value('name')) return;
        const next = { ...editing, name: value('name'), contactName: value('contactName'), phone: value('phone'), address: value('address'), notes: value('notes') };
        if (await store.saveCompany(next)) { setSelected(next.id); setEditing(null); setMessage('Empresa guardada.'); }
      }}>
        <h3>{data.companies.some(c => c.id === editing.id) ? 'Editar empresa' : 'Nueva empresa'}</h3>
        <label>Nombre<input name="name" defaultValue={editing.name} required maxLength={200} /></label>
        <label>Contacto<input name="contactName" defaultValue={editing.contactName} maxLength={200} /></label>
        <label>Teléfono<input name="phone" type="tel" defaultValue={editing.phone} maxLength={80} /></label>
        <label>Dirección<input name="address" defaultValue={editing.address} maxLength={1000} /></label>
        <label>Notas<textarea name="notes" defaultValue={editing.notes} maxLength={10000} /></label>
        <div className="workspace-actions"><button className="primary">Guardar empresa</button><button type="button" className="secondary" onClick={() => setEditing(null)}>Cancelar</button></div>
      </form>}
      <div className="company-grid">
        {data.companies.map(c => {
          const latest = data.audits.filter(a => a.companyId === c.id).sort((a, b) => b.period.localeCompare(a.period))[0];
          return <button className="workspace-card company-card" key={c.id} aria-pressed={selected === c.id} onClick={() => setSelected(c.id)}>
            <strong>{c.name}</strong><span>{c.contactName || 'Sin contacto'} · {c.phone || 'Sin teléfono'}</span>
            <small>{latest ? `${latest.period} · ${statusLabel[latest.status]}` : 'Sin auditorías'}</small>
          </button>;
        })}
      </div>
      {!data.companies.length && <p className="message">Crea tu primera empresa y abre una auditoría mensual para importar su catálogo.</p>}
      {company && <section className="workspace-card">
        <h3>{company.name}</h3><p>{company.address}</p><p className="preserve-lines">{company.notes}</p>
        <div className="workspace-actions"><button className="secondary" onClick={() => setEditing(company)}>Editar datos</button><button className="secondary" onClick={async () => {
          if (window.confirm(`¿Eliminar ${company.name} y todas sus auditorías? Esta acción es permanente. Conserva un respaldo maestro antes de continuar.`) && await store.removeCompany(company.id)) setSelected('');
        }}>Eliminar empresa</button></div>
        <form className="workspace-actions" onSubmit={async e => { e.preventDefault(); if (await store.createAudit(company.id, period)) onOpen(); }}>
          <label>Periodo<input type="month" required value={period} onChange={e => setPeriod(e.target.value)} /></label><button className="primary">Nueva auditoría mensual</button>
        </form>
        <h4>Historial mensual</h4>
        {history.map(a => <article className="history-row" key={a.id}>
          <div><strong>{a.title}</strong><p>{statusLabel[a.status]} · {a.stats.auditedCount}/{a.stats.totalCatalog} productos · {a.stats.totalPiecesPhysical} piezas contadas</p><small>Merma PVP {money.format(a.stats.missingSaleValue)} · Costo {money.format(a.stats.missingCostValue)}</small></div>
          <div className="workspace-actions"><button className="secondary" onClick={async () => { if (await store.selectAudit(a.id)) onOpen(); }}>Abrir</button><button className="secondary" onClick={() => { if (window.confirm(`¿Eliminar ${a.title}? Guarda un respaldo antes de continuar.`)) void store.removeAudit(a.id); }}>Eliminar</button></div>
        </article>)}
      </section>}
    </fieldset>
    <ProfileEditor key={data.revision} profile={data.profile} disabled={store.busy} save={store.saveProfile} />
  </div>;
}
function ProfileEditor({ profile, save, disabled }: { profile: AuditorProfile; save: (p: AuditorProfile) => Promise<boolean>; disabled: boolean }) {
  const [logo, setLogo] = useState(profile.logo);
  const [error, setError] = useState('');
  return <form className="workspace-card workspace-form" onSubmit={async e => {
    e.preventDefault(); const fields = new FormData(e.currentTarget);
    if (await save({ serviceName: String(fields.get('serviceName')).trim(), auditorName: String(fields.get('auditorName')).trim(), letterhead: String(fields.get('letterhead')).trim(), logo })) setError('Membrete guardado.');
  }}><fieldset disabled={disabled} className="workspace-fields workspace-form">
    <h3>Membrete del servicio de auditoría</h3>
    <label>Nombre del servicio<input name="serviceName" required maxLength={200} defaultValue={profile.serviceName} /></label>
    <label>Nombre del auditor<input name="auditorName" maxLength={200} defaultValue={profile.auditorName} /></label>
    <label>Dirección y datos de contacto<textarea name="letterhead" maxLength={1000} defaultValue={profile.letterhead} /></label>
    <label>Logotipo (PNG, JPEG o WebP, máximo 1 MB)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => {
      const file = e.target.files?.[0]; if (!file) return;
      if (file.size > 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setError('Usa una imagen PNG, JPEG o WebP de hasta 1 MB.'); return; }
      const reader = new FileReader(); reader.onload = () => { setLogo(String(reader.result)); setError(''); }; reader.onerror = () => setError('No se pudo leer el logotipo.'); reader.readAsDataURL(file);
    }} /></label>
    {logo && <><img src={logo} alt="Logotipo del servicio" className="report-logo" /><button type="button" className="secondary" onClick={() => setLogo(undefined)}>Quitar logotipo</button></>}
    <button className="primary">Guardar membrete</button>{error && <p role="status">{error}</p>}
  </fieldset></form>;
}
