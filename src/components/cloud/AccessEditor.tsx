import { useState } from 'react';
import { collection, getDocs, limit, orderBy, query, startAfter } from 'firebase/firestore';
import type { Firestore, QueryDocumentSnapshot } from 'firebase/firestore';
import type { CloudMember } from '../../hooks/useCloudAudit';
import type { CloudCompany } from '../../services/cloud/repository';
import type { AccessScope } from '../../services/cloud/access';
import { authMessage } from '../../hooks/useCloudSession';

export function AccessEditor({ db, member, companies, online, onSave }: { db: Firestore; member: CloudMember; companies: CloudCompany[]; online: boolean; onSave: (scope: AccessScope) => Promise<boolean> }) {
  const [all, setAll] = useState(member.allAccess !== false), [companyIds, setCompanies] = useState(member.companyIds ?? []), [auditIds, setAudits] = useState(member.auditIds ?? []);
  const [options, setOptions] = useState<{ id: string; label: string }[]>([]), [cursor, setCursor] = useState<QueryDocumentSnapshot>(), [more, setMore] = useState(true);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const toggle = (ids: string[], id: string) => ids.includes(id) ? ids.filter(v => v !== id) : [...ids, id];
  return <details><summary>Empresas y auditorías permitidas</summary>
    <fieldset className="workspace-fields access-options" disabled={!online || busy}>
      <label><input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} /> Acceso a todo el equipo</label>
      {!all && <><p>Elige hasta 10 permisos. Una empresa incluye todas sus auditorías; una auditoría solo permite ese trabajo.</p>
        {companies.map(c => <label key={c.id}><input type="checkbox" checked={companyIds.includes(c.id)} onChange={() => setCompanies(toggle(companyIds, c.id))} /> Empresa: {c.name}</label>)}
        {auditIds.filter(id => !options.some(o => o.id === id)).map(id => <label key={id}><input type="checkbox" checked onChange={() => setAudits(toggle(auditIds, id))} /> Auditoría: {id}</label>)}
        {options.map(a => <label key={a.id}><input type="checkbox" checked={auditIds.includes(a.id)} onChange={() => setAudits(toggle(auditIds, a.id))} /> {a.label}</label>)}
        {more && <button type="button" className="secondary" onClick={async () => {
          setBusy(true); setError(''); try {
            const page = await getDocs(query(collection(db, 'audits'), orderBy('__name__'), ...(cursor ? [startAfter(cursor)] : []), limit(30)));
            setOptions(old => [...old, ...page.docs.map(d => ({ id: d.id, label: (companies.find(c => c.id === d.data().companyId)?.name ?? 'Empresa') + ' · ' + d.data().period }))]);
            setCursor(page.docs.at(-1)); setMore(page.size === 30);
          } catch (e) { setError(authMessage(e)); } finally { setBusy(false); }
        }}>Cargar {options.length ? 'más auditorías' : 'auditorías específicas'}</button>}
      </>}
      <button type="button" className="primary" onClick={async () => { setBusy(true); try { await onSave({ allAccess: all, companyIds, auditIds }); } finally { setBusy(false); } }}>Guardar permisos</button>
    </fieldset>{error && <p role="alert">{error}</p>}
  </details>;
}
