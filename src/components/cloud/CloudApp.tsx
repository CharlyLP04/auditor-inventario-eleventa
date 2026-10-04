import { useState } from 'react';
import { LogOut, HardDrive, Users } from 'lucide-react';
import { AccountForm } from '../AccountForm';
import { InterfaceScale } from '../InterfaceScale';
import { transition } from '../../services/transition';
import { BrandLogo } from '../BrandLogo';
import { useCloudSession, authMessage } from '../../hooks/useCloudSession';
import { useCloudWorkspace, useOnline } from '../../hooks/useCloudAudit';
import { getCloud } from '../../services/cloud/firebase';
import type { CloudUser } from '../../services/cloud/repository';
import { CloudHome } from './CloudHome';
import { CloudAuditView } from './CloudAuditView';

const AUDIT_KEY = 'auditor_cloud_audit';
const readSelected = (uid: string) => { try { return localStorage.getItem(`${AUDIT_KEY}::${uid}`); } catch { return null; } };
const saveSelected = (uid: string, id: string | null) => { try { if (id) localStorage.setItem(`${AUDIT_KEY}::${uid}`, id); else localStorage.removeItem(`${AUDIT_KEY}::${uid}`); } catch { /* Preferencia opcional. */ } };

/** Modo equipo: cada persona entra con su cuenta y cuenta la misma auditoría desde su teléfono. */
export default function CloudApp({ onUseLocal }: { onUseLocal: () => void }) {
  const { session, signIn, signOut, signUp } = useCloudSession();
  const [pending, setPending] = useState(0);
  const leave = async () => {
    if (pending > 0 && !window.confirm(`Hay ${pending} capturas que aún no llegan al servidor. Quedarán guardadas en este dispositivo y se enviarán cuando esta misma cuenta vuelva a entrar aquí. ¿Cerrar sesión?`)) return;
    await signOut();
  };
  return <div className="app-shell cloud-shell">
    <a className="skip-link" href="#contenido">Saltar al contenido</a>
    <header className="app-header">
      <div className="brand"><BrandLogo size={44} /><div><h1>Auditorías Grid<span className="grid-accent">.mx</span></h1><p><Users size={13} aria-hidden="true" /> Equipo · auditoría compartida</p></div></div>
      <div className="header-actions">
        {session.status === 'ready' && <InterfaceScale key={session.user.uid} username={`cloud_${session.user.uid}`} />}
        {session.status === 'ready' && <span className="cloud-user" aria-label="Sesión activa"><strong>{session.user.name}</strong><small>{session.user.role === 'admin' ? 'Administrador' : 'Auditor'}</small></span>}
        <button className="secondary" onClick={onUseLocal} title="Usar los datos guardados solo en este dispositivo"><HardDrive size={16} aria-hidden="true" /> Modo local</button>
        {session.status !== 'signedOut' && session.status !== 'loading' && <button className="secondary" onClick={() => { void leave(); }}><LogOut size={16} aria-hidden="true" /> Cerrar sesión</button>}
      </div>
    </header>
    <main id="contenido" className="app-main" tabIndex={-1}>
      {session.status === 'loading' && <p role="status" className="message">Abriendo tu sesión…</p>}
      {session.status === 'signedOut' && <AccountForm onSubmit={async (name, password, register) => { try { await (register ? signUp(name, password) : signIn(name, password)); } catch (e) { throw new Error(authMessage(e)); } }}><p>La primera cuenta administra el equipo. Las siguientes solicitan acceso y un administrador las activa por nombre.</p></AccountForm>}
      {session.status === 'noAccess' && <NoAccess reason={session.reason} />}
      {session.status === 'ready' && <Workspace key={session.user.uid} user={session.user} onPending={setPending} />}
    </main>
  </div>;
}

function Workspace({ user, onPending }: { user: CloudUser; onPending: (count: number) => void }) {
  const { db } = getCloud();
  const workspace = useCloudWorkspace(db, user);
  const online = useOnline();
  const [auditId, setAuditId] = useState<string | null>(() => readSelected(user.uid));
  const open = (id: string | null) => { transition(() => setAuditId(id)); saveSelected(user.uid, id); };
  return <>
    {!online && <p role="status" className="message warning cloud-offline">Sin conexión: puedes seguir contando; las capturas se guardan en este teléfono y se envían al volver la señal. Corregir totales, deshacer, vincular, tomar departamentos e importar requieren conexión.</p>}
    {workspace.error && <p role="alert" className="message warning">{workspace.error}</p>}
    {auditId
      ? <CloudAuditView key={auditId} db={db} user={user} auditId={auditId} companies={workspace.companies} members={workspace.members} online={online} onBack={() => open(null)} onPending={onPending} />
      : <CloudHome db={db} user={user} workspace={workspace} online={online} onOpen={open} />}
  </>;
}

function NoAccess({ reason }: { reason: 'missing' | 'inactive' | 'error' }) {
  return <section className="workspace-card cloud-login"><h2>{reason === 'error' ? 'No se pudo comprobar el acceso' : 'Solicitud de acceso al equipo'}</h2>
    <p>{reason === 'error' ? 'Revisa tu conexión e intenta de nuevo.' : 'Un administrador puede activar tu cuenta por nombre desde Personas con acceso. La pantalla se actualizará automáticamente.'}</p>
  </section>;
}
