/**
 * Configuración pública de Firebase (no es secreta: la protección está en las reglas de Firestore).
 * Sin VITE_FIREBASE_PROJECT_ID la app funciona solo en modo local y no descarga el SDK de Firebase.
 */
export interface CloudConfig { apiKey: string; authDomain: string; projectId: string; appId?: string; emulator: boolean; }
export function cloudConfig(env: Record<string, string | undefined> = import.meta.env): CloudConfig | null {
  const projectId = env.VITE_FIREBASE_PROJECT_ID?.trim();
  if (!projectId) return null;
  const emulator = env.VITE_FIREBASE_EMULATOR === 'true';
  const apiKey = env.VITE_FIREBASE_API_KEY?.trim() || (emulator ? 'demo-key' : '');
  if (!apiKey) return null;
  return { apiKey, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN?.trim() || `${projectId}.firebaseapp.com`, projectId, appId: env.VITE_FIREBASE_APP_ID?.trim() || undefined, emulator };
}
const MODE_KEY = 'auditor_mode';
export function readMode(): 'local' | 'cloud' | null {
  try { const value = localStorage.getItem(MODE_KEY); return value === 'local' || value === 'cloud' ? value : null; } catch { return null; }
}
export function saveMode(mode: 'local' | 'cloud') { try { localStorage.setItem(MODE_KEY, mode); } catch { /* Preferencia opcional. */ } }
