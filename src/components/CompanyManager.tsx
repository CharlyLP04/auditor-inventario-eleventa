import { useState } from 'react';
import { Building2, Plus, ArrowUpRight, ArrowRight, Download, Upload, ShieldCheck, Search, CalendarDays, FileCheck2, Fingerprint, ImagePlus, Save, MapPin, Phone, Pencil, Trash2, X } from 'lucide-react';
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
  const [search, setSearch] = useState('');
  const addCompany = () => setEditing({ id: createId(), name: '', createdAt: new Date().toISOString() });
  if (!store.data) return <div><p role="status">{store.error ? "No se pudo abrir el directorio local." : "Abriendo directorio local…"}</p>{store.error && <button className="secondary" onClick={store.recover}>Abrir directorio conservando el respaldo anterior</button>}</div>;
  const data = store.data;
  const company = data.companies.find(c => c.id === selected);
  const history = data.audits.filter(a => a.companyId === selected).sort((a, b) => b.period.localeCompare(a.period));
  const visibleCompanies = data.companies.filter(c => `${c.name} ${c.contactName ?? ''}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')));
  const ongoing = data.audits.filter(a => a.status === 'in_progress').length;
  return <div className="company-manager clients-studio">
    <section className="clients-hero">
      <div className="clients-hero-copy">
        <span className="studio-kicker"><span /> TU CARTERA. BAJO CONTROL.</span>
        <h2>Grandes relaciones.<br /><em>Cuentas claras.</em></h2>
        <p>Cada negocio, su historia. Un solo lugar para gestionar tus clientes y dar seguimiento a cada auditoría.</p>
        <button className="primary studio-create" disabled={store.busy} onClick={addCompany}><Plus size={18} aria-hidden="true" /> Agregar empresa <ArrowUpRight size={18} aria-hidden="true" /></button>
      </div>
      <div className="clients-orbit" aria-hidden="true"><div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" /><div className="orbit-ring ring-three" /><div className="orbit-core"><Building2 size={44} strokeWidth={1.3} /></div><span className="orbit-tag tag-one"><ShieldCheck size={15} /> Control local</span><span className="orbit-tag tag-two"><FileCheck2 size={15} /> Cada mes cuenta</span><span className="orbit-dot" /></div>
      <div className="clients-metrics">
        <div><Building2 size={18} aria-hidden="true" /><strong>{String(data.companies.length).padStart(2, '0')}</strong><span>Empresas en cartera</span></div>
        <div><CalendarDays size={18} aria-hidden="true" /><strong>{String(ongoing).padStart(2, '0')}</strong><span>Auditorías en curso</span></div>
        <div><FileCheck2 size={18} aria-hidden="true" /><strong>{String(data.audits.length - ongoing).padStart(2, '0')}</strong><span>Auditorías finalizadas</span></div>
      </div>
    </section>

    {message && <p role="status" className="message">{message}</p>}
    <fieldset disabled={store.busy} className="workspace-fields">
      <div className="clients-section-heading"><div><span className="studio-kicker">01 / DIRECTORIO</span><h3>Tus empresas <span className="studio-count">{data.companies.length}</span></h3></div>
        <label className="clients-search"><Search size={18} aria-hidden="true" /><input type="search" aria-label="Buscar empresa o contacto" placeholder="Buscar empresa o contacto…" value={search} onChange={e => setSearch(e.target.value)} /></label>
      </div>
      {editing && <form key={editing.id} className="workspace-card workspace-form company-edit-form" onSubmit={async e => {
        e.preventDefault(); const fields = new FormData(e.currentTarget);
        const value = (key: string) => String(fields.get(key) ?? '').trim();
        if (!value('name')) return;
        const next = { ...editing, name: value('name'), contactName: value('contactName'), phone: value('phone'), address: value('address'), notes: value('notes') };
        if (await store.saveCompany(next)) { setSelected(next.id); setEditing(null); setMessage('Empresa guardada.'); }
      }}>
        <div className="studio-form-heading"><div><span className="studio-kicker">DATOS DEL CLIENTE</span><h3>{data.companies.some(c => c.id === editing.id) ? 'Editar empresa' : 'Una nueva relación.'}</h3></div><button type="button" className="studio-icon-button" aria-label="Cerrar formulario" onClick={() => setEditing(null)}><X size={20} /></button></div>
        <label>Nombre de la empresa<input placeholder="Ej. Abarrotes Don Pepe" autoFocus name="name" defaultValue={editing.name} required maxLength={200} /></label>
        <label>Persona de contacto<input placeholder="Nombre y apellido" name="contactName" defaultValue={editing.contactName} maxLength={200} /></label>
        <label>Teléfono<input placeholder="Número de contacto" name="phone" type="tel" defaultValue={editing.phone} maxLength={80} /></label>
        <label>Dirección<input placeholder="Calle, colonia y ciudad" name="address" defaultValue={editing.address} maxLength={1000} /></label>
        <label className="studio-full">Notas<textarea placeholder="Lo que necesitas recordar de este cliente…" name="notes" defaultValue={editing.notes} maxLength={10000} /></label>
        <div className="workspace-actions"><button className="primary"><Save size={16} aria-hidden="true" /> Guardar empresa</button><button type="button" className="secondary" onClick={() => setEditing(null)}>Cancelar</button></div>
      </form>}
      <div className="company-grid">
        {visibleCompanies.map((c, index) => {
          const latest = data.audits.filter(a => a.companyId === c.id).sort((a, b) => b.period.localeCompare(a.period))[0];
          return <button className={`workspace-card company-card company-tone-${index % 3}`} key={c.id} aria-pressed={selected === c.id} onClick={() => setSelected(c.id)}>
            <span className="company-card-top"><span className="company-monogram">{c.name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase()}</span><ArrowUpRight size={21} aria-hidden="true" /></span>
            <strong>{c.name}</strong><span className="company-contact">{c.contactName || 'Contacto por completar'}</span>
            <span className="company-card-bottom"><small className={`company-status ${latest?.status ?? 'new'}`}><span />{latest ? statusLabel[latest.status] : 'Lista para comenzar'}</small><small>{latest?.period ?? 'Nueva'}</small></span>
          </button>;
        })}
      </div>
      {!data.companies.length && <div className="clients-empty">
        <div className="empty-company-art" aria-hidden="true"><div className="empty-paper paper-back" /><div className="empty-paper paper-front"><Building2 size={30} /><span /><span /><i><Plus size={18} /></i></div></div>
        <div><span className="studio-kicker">EL PRIMER PASO DE MUCHOS</span><h3>Tu próximo cliente<br />empieza aquí.</h3><p>Agrega una empresa, abre su auditoría mensual y convierte cada conteo en información valiosa.</p><button className="primary" onClick={addCompany}>Crear mi primera empresa <ArrowRight size={17} aria-hidden="true" /></button></div>
      </div>}
      {data.companies.length > 0 && !visibleCompanies.length && <p className="message">No encontramos empresas con esa búsqueda.</p>}
      {company && <section className="workspace-card company-detail">
        <span className="studio-kicker">EXPEDIENTE DEL CLIENTE</span><h3>{company.name}</h3><div className="company-detail-contact">{company.address && <span><MapPin size={15} />{company.address}</span>}{company.phone && <span><Phone size={15} />{company.phone}</span>}</div><p className="preserve-lines">{company.notes}</p>
        <div className="workspace-actions"><button className="secondary" onClick={() => setEditing(company)}><Pencil size={15} aria-hidden="true" /> Editar datos</button><button className="secondary" onClick={async () => {
          if (window.confirm(`¿Eliminar ${company.name} y todas sus auditorías? Esta acción es permanente. Conserva un respaldo maestro antes de continuar.`) && await store.removeCompany(company.id)) setSelected('');
        }}><Trash2 size={15} aria-hidden="true" /> Eliminar empresa</button></div>
        <form className="workspace-actions monthly-create" onSubmit={async e => { e.preventDefault(); if (await store.createAudit(company.id, period)) onOpen(); }}>
          <label>Periodo<input type="month" required value={period} onChange={e => setPeriod(e.target.value)} /></label><button className="primary"><Plus size={16} aria-hidden="true" /> Nueva auditoría mensual</button>
        </form>
        <h4 className="history-title"><CalendarDays size={18} aria-hidden="true" /> Historial mensual <span className="studio-count">{history.length}</span></h4>{!history.length && <p className="history-empty">Su historia está por comenzar. Abre la primera auditoría arriba.</p>}
        {history.map(a => <article className="history-row" key={a.id}>
          <div><strong>{a.title}</strong><p>{statusLabel[a.status]} · {a.stats.auditedCount}/{a.stats.totalCatalog} productos · {a.stats.totalPiecesPhysical} piezas contadas</p><small>Merma PVP {money.format(a.stats.missingSaleValue)} · Costo {money.format(a.stats.missingCostValue)}</small></div>
          <div className="workspace-actions"><button className="secondary" onClick={async () => { if (await store.selectAudit(a.id)) onOpen(); }}>Abrir <ArrowUpRight size={15} aria-hidden="true" /></button><button className="secondary" onClick={() => { if (window.confirm(`¿Eliminar ${a.title}? Guarda un respaldo antes de continuar.`)) void store.removeAudit(a.id); }}>Eliminar</button></div>
        </article>)}
      </section>}
    </fieldset>
    <ProfileEditor key={JSON.stringify(data.profile)} profile={data.profile} disabled={store.busy} save={store.saveProfile} />
    <section className="clients-vault"><span className="vault-icon"><ShieldCheck size={25} aria-hidden="true" /></span><div><h3>Tu trabajo, contigo.</h3><p>Guardado en este navegador. Exporta una copia para proteger tu historial o llevarlo a otro dispositivo.</p></div><div className="vault-actions"><button className="secondary" disabled={store.busy} onClick={store.backup}><Download size={16} aria-hidden="true" /> Respaldo maestro</button><label className={`secondary studio-file-button ${store.busy ? 'is-disabled' : ''}`}><Upload size={16} aria-hidden="true" /> Restaurar copia<input className="sr-only" disabled={store.busy} type="file" accept=".json,application/json" onChange={async e => { const file = e.target.files?.[0]; e.target.value = ''; if (file && await store.restore(file)) { setSelected(''); setEditing(null); setMessage('Respaldo restaurado.'); } }} /></label></div></section>
  </div>;
}
function ProfileEditor({ profile, save, disabled }: { profile: AuditorProfile; save: (p: AuditorProfile) => Promise<boolean>; disabled: boolean }) {
  const [logo, setLogo] = useState(profile.logo);
  const [name, setName] = useState(profile.serviceName);
  const [auditor, setAuditor] = useState(profile.auditorName);
  const [letterhead, setLetterhead] = useState(profile.letterhead);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  return <section className="identity-studio">
    <div className="clients-section-heading"><div><span className="studio-kicker">02 / TU IDENTIDAD</span><h3>Que tu trabajo lleve tu sello.</h3><p>Personaliza el membrete de tus dictámenes y reportes.</p></div><span className="identity-badge"><Fingerprint size={18} aria-hidden="true" /> Marca propia</span></div>
    <div className="identity-layout">
      <form className="identity-form" onSubmit={async e => {
        e.preventDefault();
        if (await save({ serviceName: name.trim(), auditorName: auditor.trim(), letterhead: letterhead.trim(), logo })) setError('Membrete guardado.');
      }}><fieldset disabled={disabled || reading} className="workspace-fields workspace-form">
        <label>Nombre del servicio<input name="serviceName" required maxLength={200} value={name} onChange={e => setName(e.target.value)} placeholder="El nombre de tu marca" /></label>
        <label>Nombre del auditor<input name="auditorName" maxLength={200} value={auditor} onChange={e => setAuditor(e.target.value)} placeholder="¿Quién firma el dictamen?" /></label>
        <label>Dirección y contacto<textarea name="letterhead" maxLength={1000} value={letterhead} onChange={e => setLetterhead(e.target.value)} placeholder="Teléfono, correo y dirección de tu servicio" /></label>
        <label className="identity-upload"><span className="upload-mark">{logo ? <img src={logo} alt="Logotipo seleccionado" /> : <ImagePlus size={23} aria-hidden="true" />}</span><span><strong>{reading ? 'Preparando imagen…' : logo ? 'Cambiar logotipo' : 'Dale rostro a tu marca'}</strong><small>PNG, JPEG o WebP · Hasta 1 MB</small></span><Upload size={18} aria-hidden="true" /><input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Seleccionar logotipo" onChange={e => {
          const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
          if (file.size > 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setError('Usa una imagen PNG, JPEG o WebP de hasta 1 MB.'); return; }
          setReading(true);
          const reader = new FileReader(); reader.onload = () => { setLogo(String(reader.result)); setError(''); setReading(false); }; reader.onerror = () => { setError('No se pudo leer el logotipo.'); setReading(false); }; reader.readAsDataURL(file);
        }} /></label>
        {logo && <button type="button" className="identity-remove" onClick={() => setLogo(undefined)}>Quitar logotipo</button>}
        <button className="primary identity-save"><Save size={17} aria-hidden="true" /> Guardar identidad <ArrowRight size={17} aria-hidden="true" /></button>
        {error && <p role="status" className="identity-feedback">{error}</p>}
      </fieldset></form>
      <aside className="identity-preview" aria-label="Vista previa del membrete">
        <div className="preview-caption"><span className="preview-live-dot" /> VISTA PREVIA <span>Tu próximo dictamen</span></div>
        <div className="identity-paper">
          <div className="paper-letterhead"><div>{logo ? <img src={logo} alt="Logotipo en el membrete" /> : <span className="paper-brand-placeholder"><Fingerprint size={28} /></span>}<strong>{name.trim() || 'Tu servicio de auditoría'}</strong></div><span>AUDITORÍA<br />DE INVENTARIOS</span></div>
          <p className="paper-contact">{letterhead.trim() || 'Tu dirección y datos de contacto'}</p>
          <div className="paper-rule" /><span className="paper-eyebrow">CONTROL · PRECISIÓN · CONFIANZA</span>
          <h4>Dictamen<br />de inventario.</h4><p className="paper-description">Una visión clara del negocio.<br />Un respaldo para cada decisión.</p>
          <div className="paper-skeleton" aria-hidden="true"><span /><span /><span /></div>
          <div className="paper-signature"><span /> <strong>{auditor.trim() || 'Nombre del auditor'}</strong><small>Responsable de auditoría</small></div>
          <div className="paper-footer"><span>DOCUMENTO DE EJEMPLO</span><span>01 / 01</span></div>
        </div>
        <p className="preview-note">Vista orientativa · Tu marca y datos acompañan cada dictamen.</p>
      </aside>
    </div>
  </section>;
}
