import type { Product } from '../types';
import { roundQuantity, validQuantity } from './auditState';
import type { CountUndo } from './scannerState';

/** Productos escaneados que no existen en el catálogo de la auditoría. Nunca se borran: se excluyen y se pueden reincorporar. */
export interface UnregisteredInput { code: string; name?: string; note?: string; quantity: number; department?: string; }

const clean = (value: string | undefined, max: number) => (value ?? '').trim().slice(0, max);
function find(products: Product[], code: string) {
  const product = products.find(p => p.code === code);
  if (!product?.isUnregistered) throw new Error(`El código ${code} no es un producto no encontrado.`);
  return product;
}
const replace = (products: Product[], next: Product) => products.map(p => p.code === next.code ? next : p);

export function addUnregistered(products: Product[], input: UnregisteredInput, at = new Date().toISOString()) {
  const code = input.code.trim();
  if (!code || code.length > 128) throw new Error('El código debe tener entre 1 y 128 caracteres.');
  if (!validQuantity(input.quantity) || input.quantity <= 0) throw new Error('Escribe una cantidad mayor que cero.');
  const existing = products.find(p => p.code === code);
  if (existing && !existing.isUnregistered) throw new Error(`El código ${code} ya existe en el catálogo; cuéntalo de forma normal.`);
  if (existing?.excludedAt) throw new Error(`El código ${code} fue excluido del conteo. Reincorpóralo antes de sumar piezas.`);
  if (existing) {
    // Otro escaneo o dispositivo ya lo registró: se suma a ese registro en lugar de duplicarlo.
    const product: Product = { ...existing, physicalStock: roundQuantity(existing.physicalStock + input.quantity), counted: true, lastScannedAt: at };
    return { products: replace(products, product), product, undo: { code, before: existing, after: product } satisfies CountUndo };
  }
  if (products.length >= 20000) throw new Error('La auditoría alcanzó el límite de 20,000 productos.');
  const product: Product = {
    code, description: clean(input.name, 200) || `No encontrado ${code}`, note: clean(input.note, 1000) || undefined,
    cost: 0, price: 0, department: clean(input.department, 200) || 'Sin clasificar', theoreticalStock: 0,
    physicalStock: roundQuantity(input.quantity), counted: true, isUnregistered: true, lastScannedAt: at,
  };
  return { products: [product, ...products], product, undo: { code, after: product } satisfies CountUndo };
}

export function editUnregistered(products: Product[], code: string, patch: { name?: string; note?: string }) {
  const product = find(products, code);
  const name = patch.name === undefined ? product.description : clean(patch.name, 200);
  if (!name) throw new Error('El nombre no puede quedar vacío.');
  return replace(products, { ...product, description: name, note: patch.note === undefined ? product.note : clean(patch.note, 1000) || undefined });
}

export function excludeUnregistered(products: Product[], code: string, reason: string, at = new Date().toISOString()) {
  const product = find(products, code);
  if (product.excludedAt) return products;
  return replace(products, { ...product, excludedAt: at, excludedReason: clean(reason, 1000) || 'Sin motivo registrado' });
}

export function restoreUnregistered(products: Product[], code: string) {
  const product = find(products, code);
  if (product.linkedTo) throw new Error(`Sus piezas ya se sumaron a ${product.linkedTo}. Corrige ese producto en lugar de reincorporar este.`);
  const restored = { ...product };
  delete restored.excludedAt; delete restored.excludedReason;
  return replace(products, restored);
}

/** Cuando se identifica el producto real, sus piezas pasan al producto del catálogo y el registro original queda excluido como traza. */
export function linkUnregistered(products: Product[], code: string, targetCode: string, at = new Date().toISOString()) {
  const source = find(products, code);
  if (source.excludedAt) throw new Error('Este producto ya fue excluido o vinculado.');
  const target = products.find(p => p.code === targetCode.trim());
  if (!target || target.isUnregistered || target.excludedAt) throw new Error('Elige un producto del catálogo.');
  const quantity = roundQuantity(target.physicalStock + source.physicalStock);
  if (!validQuantity(quantity)) throw new Error('La cantidad total supera el límite permitido.');
  const updated: Product = { ...target, physicalStock: quantity, counted: true, lastScannedAt: at };
  const traced: Product = { ...source, linkedTo: target.code, excludedAt: at, excludedReason: `Identificado como ${target.code} · ${target.description}` };
  return products.map(p => p.code === target.code ? updated : p.code === source.code ? traced : p);
}
