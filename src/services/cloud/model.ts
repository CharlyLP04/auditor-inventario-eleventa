import type { Product, CountMode } from '../../types';
import { roundQuantity, validQuantity } from '../auditState';

/**
 * Modelo de la auditoría compartida (ver docs/diseno/colaboracion-multidispositivo.md).
 * Funciones puras: no dependen de Firebase y se prueban sin emulador.
 */
export const BUCKETS = 16;
export interface BucketData {
  q: Record<string, number>;                  // total contado por código (se modifica solo con increment)
  n: Record<string, number>;                  // número de capturas por código
  u: Record<string, Record<string, number>>;  // capturas por código y persona
}
export interface UnregisteredDoc {
  code: string; name?: string; note?: string; department?: string;
  labels?: Record<string, { name?: string; note?: string }>; // propuesta de cada persona: nadie sobrescribe a otra
  excluded?: boolean; excludedAt?: string; reason?: string; linkedTo?: string;
}

/** FNV-1a de 32 bits: reparte los códigos en cubetas de forma estable entre dispositivos. */
export function bucketOf(code: string) {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(code)) { hash ^= byte; hash = Math.imul(hash, 0x01000193) >>> 0; }
  return hash % BUCKETS;
}
// Los IDs de documento no admiten "/" ni ser "." o ".."; el prefijo evita además los nombres reservados __x__.
export const codeKey = (code: string) => `c_${encodeURIComponent(code)}`;
export const keyCode = (key: string) => decodeURIComponent(key.slice(2));
export const departmentKey = (name: string) => `d_${encodeURIComponent(name)}`;

/** El catálogo se guarda sin conteos, en bloques que caben en un documento de Firestore (1 MiB). */
export function splitCatalog(products: Product[], size = 500): Product[][] {
  const chunks: Product[][] = [];
  for (let i = 0; i < products.length; i += size) chunks.push(products.slice(i, i + size).map(p => ({ ...p, physicalStock: 0, counted: false, lastScannedAt: undefined })));
  return chunks;
}

/**
 * Una captura siempre es un incremento. "Fijar total" se guarda como la diferencia con lo que el dispositivo veía:
 * si otra persona sumó al mismo tiempo, su captura se conserva en lugar de sobrescribirse.
 */
export function planCapture(product: Pick<Product, 'physicalStock'>, quantity: number, mode: CountMode) {
  if (!validQuantity(quantity) || (mode === 'add' && quantity === 0)) throw new Error('Revisa la cantidad (entre 0 y 1,000,000,000).');
  const observed = product.physicalStock;
  const total = roundQuantity(mode === 'set' ? quantity : observed + quantity);
  if (!validQuantity(total)) throw new Error('La cantidad total supera el límite permitido.');
  return { delta: roundQuantity(total - observed), observed, total };
}

export function mergeBuckets(buckets: BucketData[]): BucketData {
  const merged: BucketData = { q: {}, n: {}, u: {} };
  for (const bucket of buckets) { Object.assign(merged.q, bucket.q); Object.assign(merged.n, bucket.n); Object.assign(merged.u, bucket.u); }
  return merged;
}
export const contributorsOf = (buckets: BucketData[], code: string) => Object.keys(mergeBuckets(buckets).u[code] ?? {});

/** Productos para la interfaz: catálogo + contadores compartidos + no encontrados (uno por código). */
export function assembleProducts(catalogChunks: Product[][], buckets: BucketData[], unregistered: UnregisteredDoc[]): Product[] {
  const { q, n } = mergeBuckets(buckets);
  const known = new Set<string>();
  const counted = (code: string) => ({ physicalStock: Math.max(0, roundQuantity(q[code] ?? 0)), counted: (n[code] ?? 0) > 0 });
  const catalog = catalogChunks.flat().map(p => { known.add(p.code); return { ...p, ...counted(p.code) }; });
  const extra: Product[] = unregistered.map(doc => {
    known.add(doc.code);
    const labels = Object.values(doc.labels ?? {});
    const notes = [...new Set([doc.note, ...labels.map(l => l.note)].filter((note): note is string => Boolean(note?.trim())))];
    return {
      code: doc.code, description: doc.name?.trim() || labels.find(l => l.name?.trim())?.name?.trim() || `No encontrado ${doc.code}`,
      note: notes.join(' · ') || undefined, cost: 0, price: 0, department: doc.department || 'Sin clasificar', theoreticalStock: 0,
      isUnregistered: true, ...counted(doc.code),
      ...(doc.excluded ? { excludedAt: doc.excludedAt || new Date(0).toISOString(), excludedReason: doc.reason } : {}),
      ...(doc.linkedTo ? { linkedTo: doc.linkedTo } : {}),
    };
  });
  // Un contador sin producto ni registro (por ejemplo, un registro que no llegó a sincronizar) nunca se oculta.
  const orphans: Product[] = Object.keys(q).filter(code => !known.has(code)).map(code => ({
    code, description: `No encontrado ${code}`, cost: 0, price: 0, department: 'Sin clasificar', theoreticalStock: 0, isUnregistered: true, ...counted(code),
  }));
  return [...extra, ...orphans, ...catalog];
}

/** Recalcula los totales desde las capturas y los compara con los contadores. Una diferencia indica una escritura parcial. */
export function verifyIntegrity(captures: { code: string; delta: number }[], buckets: BucketData[]) {
  const sums = new Map<string, number>();
  for (const capture of captures) sums.set(capture.code, roundQuantity((sums.get(capture.code) ?? 0) + capture.delta));
  const { q } = mergeBuckets(buckets);
  const codes = [...new Set([...sums.keys(), ...Object.keys(q)])].sort();
  return codes.map(code => ({ code, captures: sums.get(code) ?? 0, counters: roundQuantity(q[code] ?? 0) })).filter(row => Math.abs(row.captures - row.counters) > 1e-6);
}
