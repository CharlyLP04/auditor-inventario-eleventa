import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { transition } from '../services/transition';
import { normalizeUsername } from '../services/localAuth';
import { selectWorkspaceUser, currentWorkspaceUser } from '../services/storageIndexedDB';
import { getCloud } from '../services/cloud/firebase';
import type { CloudUser } from '../services/cloud/repository';

export type CloudSession =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'noAccess'; uid: string; email: string; reason: 'missing' | 'inactive' | 'error' }
  | { status: 'ready'; user: CloudUser; email: string };

/** Traduce los errores de Firebase a mensajes accionables sin exponer detalles internos. */
export function authMessage(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code: unknown }).code) : '';
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].includes(code)) return 'Nombre o contraseña incorrectos.';
  if (code === 'auth/too-many-requests') return 'Demasiados intentos. Espera unos minutos antes de intentar de nuevo.';
  if (code === 'auth/network-request-failed') return 'Sin conexión. Necesitas internet para iniciar sesión la primera vez en este dispositivo.';
  if (code === 'auth/user-disabled') return 'Esta cuenta está desactivada. Habla con un administrador.';
  if (code === 'permission-denied') return 'Tu cuenta no tiene permiso para esta acción.';
  if (code === 'unavailable') return 'No se pudo completar la operación con el servidor. Las correcciones y vinculaciones requieren conexión; vuelve a intentarlo.';
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado. Intenta de nuevo.';
}

export function useCloudSession() {
  const [session, setSession] = useState<CloudSession>({ status: 'loading' });
  useEffect(() => {
    const { auth, db } = getCloud();
    let stopMember: (() => void) | undefined;
    const stopAuth = onAuthStateChanged(auth, account => {
      stopMember?.(); stopMember = undefined;
      if (!account) { transition(() => setSession({ status: 'signedOut' })); return; }
      const email = account.email ?? '';
      if (!currentWorkspaceUser() || currentWorkspaceUser().startsWith('cloud_')) selectWorkspaceUser(`cloud_${account.uid}`);
      // La membresía se lee del servidor (o de la caché sin conexión); el rol nunca se decide en el cliente.
      stopMember = onSnapshot(doc(db, 'members', account.uid), snapshot => {
        const data = snapshot.data();
        if (!snapshot.exists() || !data) setSession({ status: 'noAccess', uid: account.uid, email, reason: 'missing' });
        else if (data.active !== true) setSession({ status: 'noAccess', uid: account.uid, email, reason: 'inactive' });
        else transition(() => setSession({ status: 'ready', email, user: { uid: account.uid, name: String(data.name ?? email), role: data.role === 'admin' ? 'admin' : 'auditor' } }));
      }, () => setSession({ status: 'noAccess', uid: account.uid, email, reason: 'error' }));
    });
    return () => { stopMember?.(); stopAuth(); };
  }, []);
  const ensureMember = async (uid: string, username: string) => {
    const { db } = getCloud();
    await runTransaction(db, async tx => {
      const member = doc(db, 'members', uid), bootstrap = doc(db, 'bootstrap', 'team');
      const [existing, team] = await Promise.all([tx.get(member), tx.get(bootstrap)]);
      if (existing.exists()) return;
      const first = !team.exists();
      if (first) tx.set(bootstrap, { owner: uid });
      tx.set(member, { name: username, email: `${username}@auth.grid.mx`, role: first ? 'admin' : 'auditor', active: first, updatedBy: uid, updatedAt: serverTimestamp() });
    });
  };
  const signIn = async (name: string, password: string) => {
    const username = normalizeUsername(name);
    const account = await signInWithEmailAndPassword(getCloud().auth, `${username}@auth.grid.mx`, password);
    try { await ensureMember(account.user.uid, username); } catch (error) { await firebaseSignOut(getCloud().auth); throw error; }
  };
  const signUp = async (name: string, password: string) => {
    const username = normalizeUsername(name);
    if (password.length < 8) throw new Error('Usa al menos 8 caracteres en la contraseña.');
    const account = await createUserWithEmailAndPassword(getCloud().auth, `${username}@auth.grid.mx`, password);
    try { await ensureMember(account.user.uid, username); } catch (error) { await firebaseSignOut(getCloud().auth); throw error; }
  };
  const signOut = () => firebaseSignOut(getCloud().auth);
  return { session, signIn, signUp, signOut };
}
