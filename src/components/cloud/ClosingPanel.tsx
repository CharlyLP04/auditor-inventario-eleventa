import { useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import type { CloudAudit, CloudUser } from '../../services/cloud/repository';
import type { CloudMember } from '../../hooks/useCloudAudit';
import { allDevicesConfirmed, confirmDevice, deviceKey, requestClosing } from '../../services/cloud/closing';
import { authMessage } from '../../hooks/useCloudSession';
export function ClosingPanel({ db, audit, user, members, synced, online }: { db: Firestore; audit: CloudAudit; user: CloudUser; members: CloudMember[]; synced: boolean; online: boolean }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  if (audit.status !== 'in_progress') return null;
  const run = async (action: () => Promise<unknown>) => { setBusy(true); setError(''); try { await action(); } catch (e) { setError(authMessage(e)); } finally { setBusy(false); } };
  const mine = deviceKey(user.uid), confirmed = audit.deviceConfirmations?.[mine] === true;
  return <section className="workspace-card closing-panel" aria-label="Comprobación de dispositivos">
    <h3>Antes de cerrar</h3>
    {!audit.closingToken ? <><p>Al solicitar el cierre se pausa el conteo. Cada dispositivo debe conectarse y confirmar que terminó de enviar sus cambios. No hacemos consultas periódicas.</p>
      {user.role === 'admin' && <button className="secondary" disabled={!synced || !online || busy} onClick={() => {
        if (window.confirm('Antes de continuar, pide que todos abran la versión actual en cada navegador usado para contar, incluidos los que estaban sin señal. No borren datos pendientes. ¿Solicitar confirmación de cierre?')) void run(() => requestClosing(db, audit.id));
      }}>Solicitar cierre al equipo</button>}</> : <>
      <p role="status">Conteo pausado. {allDevicesConfirmed(audit) ? 'Todos los dispositivos registrados confirmaron; ya puedes cambiar el estado a Completada o Cerrada.' : 'Faltan confirmaciones. Un dispositivo desconectado o cerrado se considera sin confirmar.'}</p>
      <ul>{Object.entries(audit.deviceOwners ?? {}).map(([id, uid]) => <li key={id}>{members.find(m => m.uid === uid)?.name ?? (uid === user.uid ? user.name : 'Compañero')} · {id === mine ? 'este dispositivo' : id.slice(-6)}: <strong>{audit.deviceConfirmations?.[id] ? 'Confirmado, sin pendientes' : 'Sin confirmar'}</strong></li>)}</ul>
      <button className="primary" disabled={busy || !online || !synced || confirmed || !audit.deviceOwners?.[mine]} onClick={() => void run(() => confirmDevice(db, user, audit.id, audit.closingToken!))}>{confirmed ? 'Este dispositivo ya confirmó' : 'Terminé: confirmar este dispositivo'}</button>
      {user.role === 'admin' && <button className="secondary" disabled={busy || !online} onClick={() => void run(() => requestClosing(db, audit.id, true))}>Cancelar cierre y seguir contando</button>}
    </>}{error && <p role="alert">{error}</p>}
  </section>;
}
