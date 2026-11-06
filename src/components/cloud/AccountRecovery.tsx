import { useState } from 'react';
import { linkRecoveryEmail, requestPasswordRecovery } from '../../services/cloud/recovery';
import { getCloud } from '../../services/cloud/firebase';
import { authMessage } from '../../hooks/useCloudSession';

export function AccountRecovery({ signedIn = false }: { signedIn?: boolean }) {
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  return <details className="workspace-card account-recovery"><summary>{signedIn ? 'Mi cuenta · correo de recuperación' : 'Olvidé mi contraseña'}</summary>
    <p>{signedIn ? 'Vincula un correo real. Conservas tu nombre, permisos y conteos. Después de verificarlo, entrarás con ese correo y tu contraseña actual; el usuario anterior deja de servir para iniciar sesión.' : 'Escribe el correo que verificaste en Mi cuenta. Si todavía usas solo un nombre de usuario, pide al administrador ayuda para recuperar el acceso.'}</p>
    <form onSubmit={async e => {
      e.preventDefault(); if (busy) return; setBusy(true); setMessage('');
      try {
        const { auth } = getCloud(); auth.languageCode = 'es';
        if (signedIn) {
          await linkRecoveryEmail(auth, email, password);
          setPassword(''); setMessage('Enlace enviado. Abre tu correo y verifica el cambio. Después cierra sesión y entra con el correo nuevo. Hasta verificarlo, tu acceso actual sigue funcionando.');
        } else {
          await requestPasswordRecovery(auth, email);
          setMessage('Si el correo corresponde a una cuenta, recibirás un enlace para restablecer la contraseña. Revisa también spam.');
        }
      } catch (error) { setMessage(authMessage(error)); } finally { setBusy(false); }
    }}><fieldset className="workspace-fields workspace-form" disabled={busy}>
      <label>Correo real<input type="email" required maxLength={320} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
      {signedIn && <label>Contraseña actual<input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>}
      <button className="primary" type="submit">{busy ? 'Enviando…' : signedIn ? 'Verificar y vincular correo' : 'Enviar enlace de recuperación'}</button>
    </fieldset></form>
    {message && <p role="status">{message}</p>}
  </details>;
}
