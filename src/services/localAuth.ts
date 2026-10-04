export interface LocalAccount { username: string; salt: number[]; hash: number[]; iterations: number; }
export const SESSION_KEY = 'grid_session_v1';
const ITERATIONS = 600000;
export function normalizeUsername(value: string) {
  const name = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{2,31}$/.test(name)) throw new Error('Usa de 3 a 32 letras, números, guiones o guiones bajos.');
  return name;
}
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('GridAccounts', 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('accounts', { keyPath: 'username' }); request.result.createObjectStore('sessions'); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function hash(password: string, salt: number[], iterations: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return Array.from(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new Uint8Array(salt), iterations, hash: 'SHA-256' }, key, 256)));
}
async function read<T>(store: string, key: string): Promise<T | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly'), request = tx.objectStore(store).get(key);
    tx.oncomplete = () => { db.close(); resolve(request.result); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}
async function write(store: string, value: unknown, key?: string, add = false) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    if (add) tx.objectStore(store).add(value); else tx.objectStore(store).put(value, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(new Error('No se pudo guardar; el nombre puede estar registrado.')); };
  });
}
export async function localLogin(name: string, password: string, register: boolean) {
  const username = normalizeUsername(name);
  if (password.length < 8 || password.length > 256) throw new Error('La contraseña debe tener entre 8 y 256 caracteres.');
  if (register) {
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)));
    await write('accounts', { username, salt, hash: await hash(password, salt, ITERATIONS), iterations: ITERATIONS } satisfies LocalAccount, undefined, true);
  } else {
    const account = await read<LocalAccount>('accounts', username);
    const derived = await hash(password, account?.salt ?? Array(16).fill(0), account?.iterations ?? ITERATIONS);
    let difference = account ? 0 : 1;
    derived.forEach((byte, index) => { difference |= byte ^ (account?.hash[index] ?? 0); });
    if (difference) throw new Error('Nombre o contraseña incorrectos.');
  }
  const token = crypto.randomUUID();
  await write('sessions', username, token);
  localStorage.setItem(SESSION_KEY, token);
  return username;
}
export async function rememberedUser() {
  const token = localStorage.getItem(SESSION_KEY);
  return token ? (await read<string>('sessions', token)) ?? null : null;
}
export async function localLogout() {
  const token = localStorage.getItem(SESSION_KEY);
  if (token) {
    const db = await database();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('sessions', 'readwrite'); tx.objectStore('sessions').delete(token);
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = () => { db.close(); reject(tx.error); };
    });
  }
  localStorage.removeItem(SESSION_KEY);
}
