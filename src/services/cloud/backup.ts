import { getDocFromServer, getDocsFromServer, doc, collection } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { prepareDownload, releaseDownload, startDownload } from '../fileDownload';
import { verifyIntegrity } from './model';
import { toBucket } from './repository';

export const BACKUP_COLLECTIONS = ['catalog', 'counts', 'captures', 'departments', 'unregistered', 'events'] as const;
export async function createAuditBackup(db: Firestore, auditId: string) {
  const ref = doc(db, 'audits', auditId), before = await getDocFromServer(ref);
  if (!before.exists() || !['completed', 'closed'].includes(before.data().status) || before.metadata.hasPendingWrites) throw new Error('Finaliza la auditoría y espera la sincronización antes de descargar el respaldo.');
  const company = await getDocFromServer(doc(db, 'companies', before.data().companyId));
  const snapshots = await Promise.all(BACKUP_COLLECTIONS.map(name => getDocsFromServer(collection(ref, name))));
  if (snapshots.some(s => s.metadata.hasPendingWrites)) throw new Error('Todavía hay cambios pendientes. Vuelve a intentarlo.');
  const after = await getDocFromServer(ref);
  if (JSON.stringify(before.data()) !== JSON.stringify(after.data()) || after.metadata.hasPendingWrites) throw new Error('La auditoría cambió durante el respaldo. Vuelve a intentarlo.');
  const captures = snapshots[2].docs.map(d => ({ code: String(d.data().code), delta: Number(d.data().delta) }));
  const differences = verifyIntegrity(captures, snapshots[1].docs.map(d => toBucket(d.data())));
  // Las diferencias se conservan y se informan: un respaldo nunca debe ocultar evidencia.
  const payload = JSON.stringify({ format: 'grid-audit-backup', version: 1, exportedAt: new Date().toISOString(), audit: { id: auditId, data: before.data() }, company: company.exists() ? { id: company.id, data: company.data() } : null,
    collections: Object.fromEntries(BACKUP_COLLECTIONS.map((name, index) => [name, snapshots[index].docs.map(d => ({ id: d.id, data: d.data() }))])), integrityDifferences: differences });
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  const sha256 = Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, '0')).join('');
  return { format: 'grid-audit-envelope', version: 1, sha256, payload };
}
export async function downloadAuditBackup(db: Firestore, auditId: string) {
  const envelope = await createAuditBackup(db, auditId);
  const file = prepareDownload(new Blob([JSON.stringify(envelope)], { type: 'application/json' }), 'respaldo-' + auditId.replace(/[^a-zA-Z0-9_-]/g, '_') + '.json');
  startDownload(file); releaseDownload(file);
  return (JSON.parse(envelope.payload).integrityDifferences as unknown[]).length;
}
