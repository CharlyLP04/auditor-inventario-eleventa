import { lazy, Suspense, useEffect, useState } from 'react';
import App from './App';
import { cloudConfig, readMode, saveMode } from './services/cloud/config';
import { localLogin, localLogout, rememberedUser, SESSION_KEY } from './services/localAuth';
import { selectWorkspaceUser } from './services/storageIndexedDB';
import { AccountForm } from './components/AccountForm';
import { InterfaceScale } from './components/InterfaceScale';
import { transition } from './services/transition';
const CloudApp = lazy(() => import('./components/cloud/CloudApp'));
export function Root() {
  const available = Boolean(cloudConfig());
  const [mode, setMode] = useState<'local' | 'cloud'>(() => available ? readMode() ?? 'cloud' : 'local');
  const [username, setUsername] = useState<string | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    rememberedUser().then(name => { if (active) { if (name) selectWorkspaceUser(name); setUsername(name); } }).catch(e => { if (active) setError(String(e)); }).finally(() => { if (active) setLoading(false); });
    const changed = (event: StorageEvent) => { if (event.key === SESSION_KEY) location.reload(); };
    window.addEventListener('storage', changed);
    return () => { active = false; window.removeEventListener('storage', changed); };
  }, []);
  const choose = (next: 'local' | 'cloud') => { saveMode(next); if (next === 'local' && username) selectWorkspaceUser(username); transition(() => setMode(next)); };
  if (loading) return <p role="status" className="message">Abriendo tu sesión…</p>;
  if (mode === 'cloud' && available) return <Suspense fallback={<p role="status" className="message">Cargando equipo…</p>}><CloudApp onUseLocal={() => choose('local')} /></Suspense>;
  if (!username) return <main className="app-main"><AccountForm onSubmit={async (name, password, register) => { const user = await localLogin(name, password, register); selectWorkspaceUser(user); transition(() => setUsername(user)); }}>
    <p>Tu cuenta y sus datos se guardan en este dispositivo, disponibles sin conexión.</p>{error && <p role="alert">{error}</p>}
    {available && <button className="secondary" onClick={() => choose('cloud')}>Entrar al equipo</button>}
  </AccountForm></main>;
  return <><div className="account-toolbar"><span>{username} · Local</span><InterfaceScale key={username} username={username} /><button className="secondary" onClick={async () => { await localLogout(); location.reload(); }}>Cerrar sesión</button></div><App key={username} onUseCloud={available ? () => choose('cloud') : undefined} /></>;
}
