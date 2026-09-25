import type { Product, UserRole, CountMode, ScannerPreferences } from '../types';
import { calculateStats, roundQuantity, validQuantity, validateProducts } from './auditState';
export const DEFAULT_SCANNER: ScannerPreferences = { highVisibility: false, speechEnabled: false, cooldownMs: 1800, scanMode: 'single', batchQuantity: 6 };
export const validatePin = (value: unknown): value is string => typeof value === 'string' && /^\d{4}$/.test(value);
export function requireAdmin(role: UserRole) { if (role !== 'admin') throw new Error('Esta acción requiere el PIN de administrador.'); }
export function validPreferences(value: unknown): value is ScannerPreferences {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.highVisibility === 'boolean' && typeof v.speechEnabled === 'boolean' && v.cooldownMs === 1800
    && ['single', 'batch', 'ask_quantity'].includes(String(v.scanMode)) && typeof v.batchQuantity === 'number'
    && validQuantity(v.batchQuantity) && v.batchQuantity > 0
    && (v.activeZoneDepartment === undefined || (typeof v.activeZoneDepartment === 'string' && v.activeZoneDepartment.length <= 200));
}
export interface CountUndo { code: string; before?: Product; after: Product; }
export function applyCount(products: Product[], rawCode: string, amount: number, mode: CountMode, zone?: string) {
  const code = rawCode.trim();
  if (!code || code.length > 128 || !validQuantity(amount) || (mode !== 'set' && mode !== 'add') || (mode === 'add' && amount === 0)) throw new Error('Revisa el código y la cantidad (entre 0 y 1,000,000,000).');
  const before = products.find(p => p.code === code);
  const quantity = roundQuantity(mode === 'set' ? amount : (before?.physicalStock ?? 0) + amount);
  if (!validQuantity(quantity)) throw new Error('La cantidad total supera el límite permitido.');
  const product: Product = { ...(before ?? { code, description: `Producto no registrado (${code})`, cost: 0, price: 0, department: zone?.trim() || 'Sin clasificar', theoreticalStock: 0, isUnregistered: true }), physicalStock: quantity, counted: true, lastScannedAt: new Date().toISOString() };
  const next = before ? products.map(p => p.code === code ? product : p) : [product, ...products];
  if (!validateProducts(next)) throw new Error('El catálogo supera el límite o contiene datos inválidos.');
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
  for (const p of products) { const group = groups.get(p.department) ?? []; group.push(p); groups.set(p.department, group); }
  return [...groups].map(([department, items]) => ({ department, stats: calculateStats(items) })).sort((a, b) => a.department.localeCompare(b.department, 'es'));
}
