import type { Product, UserRole, CountMode, ScannerPreferences } from '../types';
import { calculateStats, roundQuantity, validQuantity } from './auditState';
export const DEFAULT_SCANNER: ScannerPreferences = { highVisibility: false, speechEnabled: false, scanMode: 'single', batchQuantity: 6 };
export const validatePin = (value: unknown): value is string => typeof value === 'string' && /^\d{4}$/.test(value);
export function requireAdmin(role: UserRole) { if (role !== 'admin') throw new Error('Esta acción requiere el PIN de administrador.'); }
export function validPreferences(value: unknown): value is ScannerPreferences {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.highVisibility === 'boolean' && typeof v.speechEnabled === 'boolean'
    // cooldownMs existió en versiones anteriores con un valor fijo; se acepta para no rechazar respaldos viejos.
    && (v.cooldownMs === undefined || v.cooldownMs === 1800)
    && ['single', 'batch', 'ask_quantity'].includes(String(v.scanMode)) && typeof v.batchQuantity === 'number'
    && validQuantity(v.batchQuantity) && v.batchQuantity > 0
    && (v.activeZoneDepartment === undefined || (typeof v.activeZoneDepartment === 'string' && v.activeZoneDepartment.length <= 200));
}
export interface CountUndo { code: string; before?: Product; after: Product; }
/** Error de conteo con un código estable para que la interfaz ofrezca la acción correcta. */
export class CountError extends Error {
  readonly code: 'not_found' | 'excluded' | 'invalid';
  constructor(message: string, code: CountError['code']) { super(message); this.code = code; }
}
export function applyCount(products: Product[], rawCode: string, amount: number, mode: CountMode) {
  const code = rawCode.trim();
  if (!code || code.length > 128 || !validQuantity(amount) || (mode !== 'set' && mode !== 'add') || (mode === 'add' && amount === 0)) throw new CountError('Revisa el código y la cantidad (entre 0 y 1,000,000,000).', 'invalid');
  const before = products.find(p => p.code === code);
  // Un código desconocido nunca se cuenta en automático: se registra como no encontrado con confirmación.
  if (!before) throw new CountError(`El código ${code} no está en esta auditoría.`, 'not_found');
  if (before.excludedAt) throw new CountError(`El código ${code} fue excluido del conteo. Reincorpóralo para volver a contarlo.`, 'excluded');
  const quantity = roundQuantity(mode === 'set' ? amount : before.physicalStock + amount);
  if (!validQuantity(quantity)) throw new CountError('La cantidad total supera el límite permitido.', 'invalid');
  const product: Product = { ...before, physicalStock: quantity, counted: true, lastScannedAt: new Date().toISOString() };
  const next = products.map(p => p.code === code ? product : p);
  return { products: next, product, undo: { code, before, after: product } satisfies CountUndo };
}
export function revertCount(products: Product[], undo: CountUndo) {
  const current = products.find(p => p.code === undo.code);
  if (JSON.stringify(current) !== JSON.stringify(undo.after)) throw new Error('El producto cambió después del conteo. Corrige su cantidad directamente.');
  return undo.before ? products.map(p => p.code === undo.code ? undo.before! : p) : products.filter(p => p.code !== undo.code);
}
export class ScanCooldown {
  private reads = new Map<string, number>();
  accept(code: string, now = Date.now()) {
    const last = this.reads.get(code);
    if (last !== undefined && now - last < 1800) return false;
    for (const [key, time] of this.reads) if (now - time >= 1800) this.reads.delete(key);
    this.reads.set(code, now); return true;
  }
  release(code: string) { this.reads.delete(code); }
}
export function departmentStats(products: Product[]) {
  const groups = new Map<string, Product[]>();
  for (const p of products) { if (p.excludedAt || p.linkedTo) continue; const group = groups.get(p.department) ?? []; group.push(p); groups.set(p.department, group); }
  return [...groups].map(([department, items]) => ({ department, stats: calculateStats(items) })).sort((a, b) => a.department.localeCompare(b.department, 'es'));
}
