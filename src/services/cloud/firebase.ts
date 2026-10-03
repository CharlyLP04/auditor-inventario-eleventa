import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { cloudConfig } from './config';

let instance: { auth: Auth; db: Firestore } | null = null;
/**
 * Firebase con caché persistente: se puede contar sin señal; las capturas quedan en cola en el dispositivo
 * y se envían en orden al recuperar la conexión. La sesión también persiste en el dispositivo.
 */
export function getCloud() {
  if (instance) return instance;
  const config = cloudConfig();
  if (!config) throw new Error('La nube no está configurada en esta versión.');
  const app = initializeApp({ apiKey: config.apiKey, authDomain: config.authDomain, projectId: config.projectId, appId: config.appId });
  const auth = getAuth(app);
  const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  if (config.emulator) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  instance = { auth, db };
  return instance;
}
