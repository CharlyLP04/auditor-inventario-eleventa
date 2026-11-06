import { useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { downloadAuditBackup } from '../../services/cloud/backup';
import { authMessage } from '../../hooks/useCloudSession';
export function BackupPanel({ db, auditId, online }: { db: Firestore; auditId: string; online: boolean }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  return <section className="workspace-card"><h3>Respaldo completo de la auditoría</h3>
    <p>Guarda catálogo, conteos, capturas, departamentos, notas y bitácora en un archivo JSON con comprobación SHA-256. Se descarga a este dispositivo; no ocupa almacenamiento de pago. Esta acción lee el historial completo una vez.</p>
    <button className="primary" disabled={!online || busy} onClick={async () => { setBusy(true); setMessage(''); try {
      const differences = await downloadAuditBackup(db, auditId);
      setMessage(differences ? 'Descarga iniciada. Atención: el respaldo incluye ' + differences + ' diferencias entre capturas y contadores; revísalas antes de usar los resultados.' : 'Descarga iniciada. Comprueba que el archivo esté en Descargas y guárdalo en un lugar seguro.');
    } catch (e) { setMessage(authMessage(e)); } finally { setBusy(false); } }}>{busy ? 'Preparando respaldo…' : 'Descargar respaldo completo'}</button>
    {message && <p role="status">{message}</p>}
  </section>;
}
