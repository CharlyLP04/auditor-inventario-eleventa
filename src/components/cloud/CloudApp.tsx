import { useState } from 'react';
import type { FormEvent } from 'react';
import { LogOut, HardDrive, Copy, Users, KeyRound } from 'lucide-react';
import { BrandLogo } from '../BrandLogo';
import { useCloudSession, authMessage } from '../../hooks/useCloudSession';
import { useCloudWorkspace, useOnline } from '../../hooks/useCloudAudit';
import { getCloud } from '../../services/cloud/firebase';
import type { CloudUser } from '../../services/cloud/repository';
import { CloudHome } from './CloudHome';
import { CloudAuditView } from './CloudAuditView';

const AUDIT_KEY = 'auditor_cloud_audit';
const readSelected = () => { try { return localStorage.getItem(AUDIT_KEY); } catch { return null; } };
const saveSelected = (id: string | null) => { try { if (id) localStorage.setItem(AUDIT_KEY, id); else localStorage.removeItem(AUDIT_KEY); } catch { /* Preferencia opcional. */ } };

/** Modo equipo: cada persona entra con su cuenta y cuenta la misma auditoría desde su teléfono. */
export default function CloudApp({ onUseLocal }: { onUseLocal: () => void }) {
  const { session, signIn, signOut, resetPassword } = useCloudSession();
  const [pending, setPending] = useState(0);
  const leave = async () => {
    if (pending > 0 && !window.confirm(`Hay ${pending} capturas que aún no llegan al servidor. Quedarán guardadas en este dispositivo y se enviarán cuando esta misma cuenta vuelva a entrar aquí. ¿Cerrar sesión?`)) return;
    await signOut();
  };
  return <div className="app-shell cloud-shell">
    <a className="skip-link" href="#contenido">Saltar al contenido</a>
    <header className="app-header">
      <div className="brand"><BrandLogo size={44} /><div><h1>Auditor eleventa</h1><p><Users size={13} aria-hidden="true" /> Equipo · auditoría compartida</p></div></div>
      <div className="header-actions">
        {session.status === 'ready' && <span className="cloud-user" aria-label="Sesión activa"><strong>{session.user.name}</strong><small>{session.user.role === 'admin' ? 'Administrador' : 'Auditor'} · {session.email}</small></span>}
        <button className="secondary" onClick={onUseLocal} title="Usar los datos guardados solo en este dispositivo"><HardDrive size={16} aria-hidden="true" /> Modo local</button>
        {session.status !== 'signedOut' && session.status !== 'loading' && <button className="secondary" onClick={() => { void leave(); }}><LogOut size={16} aria-hidden="true" /> Cerrar sesión</button>}
      </div>
    </header>
    <main id="contenido" className="app-main" tabIndex={-1}>
      {session.status === 'loading' && <p role="status" className="message">Abriendo tu sesión…</p>}
      {session.status === 'signedOut' && <LoginScreen signIn={signIn} resetPassword={resetPassword} onUseLocal={onUseLocal} />}
      {session.status === 'noAccess' && <NoAccess uid={session.uid} email={session.email} reason={session.reason} />}
      {session.status === 'ready' && <Workspace user={session.user} onPending={setPending} />}
    </main>
  </div>;
}

function Workspace({ user, onPending }: { user: CloudUser; onPending: (count: number) => void }) {
  const { db } = getCloud();
  const workspace = useCloudWorkspace(db, user);
  const online = useOnline();
  const [auditId, setAuditId] = useState<string | null>(readSelected);
  const open = (id: string | null) => { setAuditId(id); saveSelected(id); };
  return <>
    {!online && <p role="status" className="message warning cloud-offline">Sin conexión: puedes seguir contando; las capturas se guardan en este teléfono y se envían al volver la señal. Tomar departamentos e importar requieren conexión.</p>}
    {workspace.error && <p role="alert" className="message warning">{workspace.error}</p>}
    {auditId
      ? <CloudAuditView key={auditId} db={db} user={user} auditId={auditId} companies={workspace.companies} members={workspace.members} online={online} onBack={() => open(null)} onPending={onPending} />
      : <CloudHome db={db} user={user} workspace={workspace} online={online} onOpen={open} />}
  </>;
}

function LoginScreen({ signIn, resetPassword, onUseLocal }: { signIn: (email: string, password: string) => Promise<void>; resetPassword: (email: string) => Promise<void>; onUseLocal: () => void }) {
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try { await signIn(email, password); } catch (e) { setError(authMessage(e)); } finally { setBusy(false); }
  };
  return <section className="workspace-card cloud-login" aria-labelledby="login-title">
    <span className="studio-kicker">AUDITORÍA EN EQUIPO</span>
    <h2 id="login-title">Entra con tu cuenta</h2>
    <p>Cada persona tiene su propia cuenta. Un administrador la crea; no hay registro abierto.</p>
    <form onSubmit={submit}><fieldset className="workspace-fields pin-fields" disabled={busy}>
      <label>Correo<input type="email" name="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label>Contraseña<input type="password" name="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
      {error && <p role="alert" className="message warning">{error}</p>}
      {message && <p role="status" className="message">{message}</p>}
      <button className="primary"><KeyRound size={16} aria-hidden="true" /> {busy ? 'Entrando…' : 'Entrar'}</button>
      <button type="button" className="secondary" onClick={async () => {
        if (!email.trim()) { setError('Escribe tu correo para enviarte el enlace.'); return; }
        try { await resetPassword(email); setMessage('Si la cuenta existe, te enviamos un correo para restablecer la contraseña.'); setError(''); } catch (e) { setError(authMessage(e)); }
      }}>Olvidé mi contraseña</button>
    </fieldset></form>
    <button type="button" className="secondary cloud-local-link" onClick={onUseLocal}><HardDrive size={16} aria-hidden="true" /> Usar solo en este dispositivo (modo local)</button>
  </section>;
}

function NoAccess({ uid, email, reason }: { uid: string; email: string; reason: 'missing' | 'inactive' | 'error' }) {
  const [copied, setCopied] = useState(false);
  return <section className="workspace-card cloud-login" aria-labelledby="no-access-title">
    <h2 id="no-access-title">{reason === 'inactive' ? 'Tu acceso está desactivado' : reason === 'error' ? 'No se pudo comprobar tu acceso' : 'Tu cuenta aún no tiene acceso'}</h2>
    <p>{reason === 'error' ? 'Revisa tu conexión e intenta de nuevo.' : `Iniciaste sesión como ${email}. Pide a un administrador que te dé acceso con este identificador:`}</p>
    {reason !== 'error' && <div className="cloud-uid"><code>{uid}</code><button type="button" className="secondary" onClick={async () => { try { await navigator.clipboard.writeText(uid); setCopied(true); } catch { setCopied(false); } }}><Copy size={15} aria-hidden="true" /> {copied ? 'Copiado' : 'Copiar'}</button></div>}
  </section>;
}
