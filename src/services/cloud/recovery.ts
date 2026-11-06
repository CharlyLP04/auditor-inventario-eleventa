import { EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail, verifyBeforeUpdateEmail } from 'firebase/auth';
import type { Auth } from 'firebase/auth';
export function recoveryAddress(email: string) {
  const address = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || address.length > 320 || address.endsWith('@auth.grid.mx')) throw new Error('Escribe un correo real válido, no un usuario interno.');
  return address;
}
export async function linkRecoveryEmail(auth: Auth, email: string, password: string) {
  const address = recoveryAddress(email), user = auth.currentUser;
  if (!user?.email) throw new Error('Vuelve a iniciar sesión.');
  auth.languageCode = 'es';
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  await verifyBeforeUpdateEmail(user, address);
}
export async function requestPasswordRecovery(auth: Auth, email: string) {
  const address = recoveryAddress(email); auth.languageCode = 'es';
  try { await sendPasswordResetEmail(auth, address); } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'auth/user-not-found')) throw error;
  }
}
