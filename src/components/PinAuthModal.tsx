import { useEffect, useRef, useState } from 'react';
import { LockKeyhole, X } from 'lucide-react';
export function PinAuthModal({ mode, onClose, unlock, changePin }: {
  mode: 'unlock' | 'change'; onClose: () => void;
  unlock: (pin: string) => Promise<void>; changePin: (oldPin: string, newPin: string) => Promise<boolean>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pin, setPin] = useState(''), [next, setNext] = useState(''), [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const submitting = useRef(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="pin-dialog" aria-labelledby="pin-title" onCancel={e => { e.preventDefault(); if (!submitting.current) onClose(); }}>
    <form onSubmit={async e => {
      e.preventDefault(); if (submitting.current) return;
      if (mode === 'change' && next !== confirmation) { setError('Los PIN nuevos no coinciden.'); return; }
      submitting.current = true; setBusy(true); setError('');
      try { if (mode === 'unlock') await unlock(pin); else if (!await changePin(pin, next)) throw new Error('No se pudo guardar el PIN. Revisa el aviso de guardado.'); onClose(); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo verificar el PIN.'); setPin(''); }
      finally { submitting.current = false; setBusy(false); }
    }}>
      <div className="modal-heading"><LockKeyhole size={24} aria-hidden="true" /><h2 id="pin-title">{mode === 'unlock' ? 'Acceso de administrador' : 'Cambiar PIN'}</h2><button type="button" disabled={busy} className="secondary" aria-label="Cerrar acceso" onClick={onClose}><X size={20} /></button></div>
      <p>Introduce tu PIN de cuatro dígitos. El PIN inicial es 1234; cámbialo al configurar este equipo.</p>
      <fieldset disabled={busy} className="workspace-fields pin-fields">
        <label>{mode === 'unlock' ? 'PIN de administrador' : 'PIN actual'}<input autoFocus type="password" inputMode="numeric" autoComplete="off" required pattern="[0-9]{4}" maxLength={4} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} /></label>
        {mode === 'change' && <><label>Nuevo PIN<input type="password" inputMode="numeric" autoComplete="new-password" required pattern="[0-9]{4}" maxLength={4} value={next} onChange={e => setNext(e.target.value.replace(/\D/g, ''))} /></label><label>Confirmar nuevo PIN<input type="password" inputMode="numeric" autoComplete="new-password" required pattern="[0-9]{4}" maxLength={4} value={confirmation} onChange={e => setConfirmation(e.target.value.replace(/\D/g, ''))} /></label></>}
        {error && <p role="alert" className="message warning">{error}</p>}
        <button className="primary">{busy ? 'Verificando…' : mode === 'unlock' ? 'Entrar como administrador' : 'Guardar PIN'}</button>
      </fieldset>
    </form>
  </dialog>;
}
