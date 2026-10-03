import type { Product } from '../types';

export type SearchMatch = 'code' | 'sku' | 'partial_code' | 'description';
export interface SearchResult { product: Product; match: SearchMatch; excluded: boolean; }

export const normalizeText = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
// Singular aproximado: "chiles serranos" y "chile serrano" se tratan igual sin un diccionario.
const stem = (token: string) => token.length > 3 && token.endsWith('s') ? token.slice(0, -1) : token;
const tokenize = (value: string) => normalizeText(value).split(/[^a-z0-9ñ]+/).filter(Boolean).map(stem);
const withoutZeros = (code: string) => code.replace(/^0+/, '');

interface Entry { product: Product; code: string; sku: string; text: string; tokens: string[]; }
interface Index { entries: Entry[]; byCode: Map<string, Product>; }
// El índice se recalcula solo cuando cambia el arreglo de productos (cada guardado crea uno nuevo).
const indexes = new WeakMap<Product[], Index>();
function indexOf(products: Product[]) {
  let index = indexes.get(products);
  if (!index) {
    index = { entries: products.map(product => ({ product, code: product.code.toLowerCase(), sku: product.sku?.trim().toLowerCase() ?? '', text: normalizeText(product.description), tokens: tokenize(product.description) })), byCode: new Map(products.map(p => [p.code, p])) };
    indexes.set(products, index);
  }
  return index;
}

/** Busca por código de barras, clave interna y descripción (palabras en cualquier orden, sin acentos, por prefijo). */
export function searchProducts(products: Product[], query: string, { limit = 30 } = {}): SearchResult[] {
  const text = normalizeText(query);
  if (!text) return [];
  const code = query.trim().toLowerCase();
  const words = tokenize(query);
  const scored: { entry: Entry; score: number; match: SearchMatch; order: number }[] = [];
  indexOf(products).entries.forEach((entry, order) => {
    let score = -1, match: SearchMatch = 'description';
    if (entry.code === code) { score = 0; match = 'code'; }
    else if (entry.sku && entry.sku === code) { score = 1; match = 'sku'; }
    else if (code.length >= 3 && (entry.code.includes(code) || (entry.sku && entry.sku.includes(code)))) { score = 2; match = entry.code.includes(code) ? 'partial_code' : 'sku'; }
    else if (words.length && words.every(word => entry.tokens.some(token => token.startsWith(word)))) score = entry.text.startsWith(text) ? 3 : 4;
    if (score >= 0) scored.push({ entry, score, match, order });
  });
  scored.sort((a, b) => a.score - b.score || a.order - b.order);
  return scored.slice(0, limit).map(({ entry, match }) => ({ product: entry.product, match, excluded: Boolean(entry.product.excludedAt) }));
}

export interface ScanResolution { product?: Product; match?: 'exact' | 'leading_zeros'; suggestions: Product[]; }
/**
 * Resuelve una lectura del escáner. Un EAN-13 con cero inicial es el mismo producto que su UPC-A de 12 dígitos,
 * por eso los códigos numéricos largos coinciden sin ceros iniciales solo cuando hay un único candidato.
 */
export function resolveScannedCode(products: Product[], raw: string): ScanResolution {
  const code = raw.trim();
  const index = indexOf(products);
  const exact = index.byCode.get(code);
  if (exact) return { product: exact, match: 'exact', suggestions: [] };
  const numeric = /^\d{8,}$/.test(code);
  if (numeric) {
    const target = withoutZeros(code);
    const same = index.entries.filter(e => /^\d+$/.test(e.product.code) && withoutZeros(e.product.code) === target);
    if (same.length === 1) return { product: same[0].product, match: 'leading_zeros', suggestions: [] };
  }
  const suggestions = code.length >= 6
    ? index.entries.filter(e => e.product.code.length >= 6 && (e.product.code.includes(code) || code.includes(e.product.code) || (numeric && withoutZeros(e.product.code) === withoutZeros(code)))).slice(0, 5).map(e => e.product)
    : [];
  return { suggestions };
}
