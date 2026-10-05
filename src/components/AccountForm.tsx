import { useState } from 'react';
import { BrandLogo } from './BrandLogo';
import { transition } from '../services/transition';
export function AccountForm({ onSubmit, children }: { onSubmit: (name: string, password: string, register: boolean) => Promise<unknown>; children?: React.ReactNode }) {
  const [register, setRegister] = useState(false), [name, setName] = useState(''), [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <section className="workspace-card cloud-login grid-login">
    <div className="grid-login-header">
      <div className="grid-login-brand">
        <BrandLogo size={52} />
        <div>
          <span className="grid-login-kicker">CONTROL DE INVENTARIO · ELEVENTA</span>
          <h1>Auditorías Grid<span className="grid-accent">.mx</span></h1>
        </div>
      </div>
      <p className="grid-login-tagline">Pensamos en código. Creamos soluciones.</p>
    </div>
    <div className="grid-login-heading">
      <h2>{register ? 'Crear cuenta de trabajo' : 'Iniciar sesión'}</h2>
      <span>{register ? 'Registra un usuario para aislar tus empresas y conteos' : 'Ingresa con tu usuario para abrir tus auditorías'}</span>
    </div>
    <form onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError('');
      try { await onSubmit(name, password, register); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo abrir la cuenta.'); } finally { setBusy(false); }
    }}><fieldset disabled={busy} className="workspace-fields workspace-form grid-login-fields">
      <label><span>Nombre de usuario</span><input required autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="ej. admin_tienda" pattern="[a-zA-Z0-9][a-zA-Z0-9_\-]{2,31}" minLength={3} maxLength={32} value={name} onChange={e => setName(e.target.value)} /></label>
      <label><span>Contraseña</span><input required type="password" autoComplete={register ? 'new-password' : 'current-password'} placeholder="Mínimo 8 caracteres" minLength={8} maxLength={256} value={password} onChange={e => setPassword(e.target.value)} /></label>
      {error && <p role="alert" className="message warning">{error}</p>}
      <div className="grid-login-actions">
        <button className="primary">{busy ? 'Abriendo cuenta…' : register ? 'Crear cuenta' : 'Entrar'}</button>
        <button type="button" className="secondary" onClick={() => transition(() => { setRegister(!register); setError(''); setPassword(''); })}>{register ? 'Ya tengo cuenta' : 'Crear una cuenta nueva'}</button>
      </div>
    </fieldset></form>
    <div className="grid-login-footer">{children}</div>
  </section>;
}
