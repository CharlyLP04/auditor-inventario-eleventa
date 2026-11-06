import { doc, runTransaction, waitForPendingWrites } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { CloudUser } from './repository';

let memoryId: string | undefined;
export function deviceId() {
  if (memoryId) return memoryId;
  if (typeof localStorage === 'undefined') return memoryId = crypto.randomUUID();
  const key = 'grid-counting-device-v1';
  let saved: string | null;
  try { saved = localStorage.getItem(key); } catch { throw new Error('Permite guardar datos en este navegador para identificar el dispositivo y conservar el conteo sin conexión.'); }
  memoryId = saved && /^[a-zA-Z0-9-]{1,64}$/.test(saved) ? saved : crypto.randomUUID();
  localStorage.setItem(key, memoryId);
  return memoryId;
}
export const deviceKey = (uid: string) => uid + '_' + deviceId();
export async function registerDevice(db: Firestore, user: CloudUser, auditId: string) {
  const ref = doc(db, 'audits', auditId), key = deviceKey(user.uid);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref), data = snap.data();
    if (!data || data.status !== 'in_progress' || data.deviceOwners?.[key]) return;
    if (Object.keys(data.deviceOwners ?? {}).length >= 100) throw new Error('Esta auditoría llegó a 100 dispositivos registrados.');
    tx.update(ref, { deviceOwners: { ...data.deviceOwners, [key]: user.uid }, lastDevice: key });
  });
}
export async function requestClosing(db: Firestore, auditId: string, cancel = false) {
  const ref = doc(db, 'audits', auditId);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (snap.data()?.status !== 'in_progress') throw new Error('La auditoría ya no está en curso.');
    if (!cancel && snap.data()?.closingToken) throw new Error('Ya hay una comprobación de cierre en curso.');
    tx.update(ref, { closingToken: cancel ? null : crypto.randomUUID(), deviceConfirmations: {} });
  });
}
export async function confirmDevice(db: Firestore, user: CloudUser, auditId: string, token: string) {
  await waitForPendingWrites(db);
  const ref = doc(db, 'audits', auditId), key = deviceKey(user.uid);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref), data = snap.data();
    if (data?.closingToken !== token || data.status !== 'in_progress') throw new Error('La comprobación cambió. Revisa el estado antes de confirmar.');
    if (data.deviceOwners?.[key] !== user.uid) throw new Error('Este dispositivo todavía no está registrado.');
    tx.update(ref, { deviceConfirmations: { ...data.deviceConfirmations, [key]: true }, lastDevice: key });
  });
}
export function allDevicesConfirmed(data: { closingToken?: string | null; deviceOwners?: Record<string, string>; deviceConfirmations?: Record<string, boolean> }) {
  const ids = Object.keys(data.deviceOwners ?? {});
  return Boolean(data.closingToken) && ids.length > 0 && ids.every(id => data.deviceConfirmations?.[id] === true);
}
