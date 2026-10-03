import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut, sendPasswordResetEmail } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
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
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].includes(code)) return 'Correo o contraseña incorrectos.';
  if (code === 'auth/too-many-requests') return 'Demasiados intentos. Espera unos minutos o restablece tu contraseña.';
  if (code === 'auth/network-request-failed') return 'Sin conexión. Necesitas internet para iniciar sesión la primera vez en este dispositivo.';
  if (code === 'auth/user-disabled') return 'Esta cuenta está desactivada. Habla con un administrador.';
  if (code === 'permission-denied') return 'Tu cuenta no tiene permiso para esta acción.';
  if (code === 'unavailable') return 'Sin conexión con el servidor. Lo que capturaste se guardó en este dispositivo y se enviará al volver la señal.';
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado. Intenta de nuevo.';
}

export function useCloudSession() {
  const [session, setSession] = useState<CloudSession>({ status: 'loading' });
  useEffect(() => {
    const { auth, db } = getCloud();
    let stopMember: (() => void) | undefined;
    const stopAuth = onAuthStateChanged(auth, account => {
      stopMember?.(); stopMember = undefined;
      if (!account) { setSession({ status: 'signedOut' }); return; }
      const email = account.email ?? '';
      // La membresía se lee del servidor (o de la caché sin conexión); el rol nunca se decide en el cliente.
      stopMember = onSnapshot(doc(db, 'members', account.uid), snapshot => {
        const data = snapshot.data();
        if (!snapshot.exists() || !data) setSession({ status: 'noAccess', uid: account.uid, email, reason: 'missing' });
        else if (data.active !== true) setSession({ status: 'noAccess', uid: account.uid, email, reason: 'inactive' });
        else setSession({ status: 'ready', email, user: { uid: account.uid, name: String(data.name ?? email), role: data.role === 'admin' ? 'admin' : 'auditor' } });
      }, () => setSession({ status: 'noAccess', uid: account.uid, email, reason: 'error' }));
    });
    return () => { stopMember?.(); stopAuth(); };
  }, []);
  const signIn = (email: string, password: string) => signInWithEmailAndPassword(getCloud().auth, email.trim(), password).then(() => undefined);
  const signOut = () => firebaseSignOut(getCloud().auth);
  const resetPassword = (email: string) => sendPasswordResetEmail(getCloud().auth, email.trim());
  return { session, signIn, signOut, resetPassword };
}
