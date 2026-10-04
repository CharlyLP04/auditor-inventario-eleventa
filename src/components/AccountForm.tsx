import { useState } from 'react';
import { BrandLogo } from './BrandLogo';
import { transition } from '../services/transition';
export function AccountForm({ onSubmit, children }: { onSubmit: (name: string, password: string, register: boolean) => Promise<unknown>; children?: React.ReactNode }) {
  const [register, setRegister] = useState(false), [name, setName] = useState(''), [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <section className="workspace-card cloud-login grid-login">
    <BrandLogo size={72} /><h1>Auditorías Grid<span className="grid-accent">.mx</span></h1>
    <p>Pensamos en código. Creamos soluciones.</p>
    <h2>{register ? 'Crear cuenta' : 'Iniciar sesión'}</h2>
    <form onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError('');
      try { await onSubmit(name, password, register); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo abrir la cuenta.'); } finally { setBusy(false); }
    }}><fieldset disabled={busy} className="workspace-fields workspace-form">
      <label>Nombre de usuario<input required autoComplete="username" autoCapitalize="none" spellCheck={false} pattern="[a-zA-Z0-9][a-zA-Z0-9_\-]{2,31}" minLength={3} maxLength={32} value={name} onChange={e => setName(e.target.value)} /></label>
      <label>Contraseña<input required type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={8} maxLength={256} value={password} onChange={e => setPassword(e.target.value)} /></label>
      {error && <p role="alert" className="message warning">{error}</p>}
      <button className="primary">{busy ? 'Abriendo cuenta…' : register ? 'Crear cuenta' : 'Entrar'}</button>
      <button type="button" className="secondary" onClick={() => transition(() => { setRegister(!register); setError(''); setPassword(''); })}>{register ? 'Ya tengo cuenta' : 'Crear una cuenta nueva'}</button>
    </fieldset></form>{children}
  </section>;
}
