import type { Product, AuditStats } from '../types';
export const MAX_QUANTITY = 1_000_000_000;
export const isCounted = (p: Product) => p.counted ?? (p.physicalStock > 0 || Boolean(p.lastScannedAt));
export const roundQuantity = (value: number) => Math.round(value * 1e6) / 1e6;
export const validQuantity = (value: number) => Number.isFinite(value) && value >= 0 && value <= MAX_QUANTITY;
export function productStatus(p: Product) {
  if (!isCounted(p)) return 'not_counted';
  if (p.isUnregistered) return 'unregistered';
  const diff = roundQuantity(p.physicalStock - p.theoreticalStock);
  return diff < 0 ? 'missing' : diff > 0 ? 'surplus' : 'match';
}
export function calculateStats(products: Product[]): AuditStats {
  const stats: AuditStats = { totalCatalog: products.length, auditedCount: 0, totalPiecesTheoretical: 0, totalPiecesPhysical: 0, totalMissingPieces: 0, totalSurplusPieces: 0, missingCostValue: 0, surplusCostValue: 0, matchCount: 0, missingCount: 0, surplusCount: 0, notCountedCount: 0, unregisteredCount: 0 };
  for (const p of products) {
    stats.totalPiecesTheoretical += p.theoreticalStock;
    stats.totalPiecesPhysical += p.physicalStock;
    if (p.isUnregistered) stats.unregisteredCount++;
    if (isCounted(p)) stats.auditedCount++; else stats.notCountedCount++;
    const state = productStatus(p);
    const diff = roundQuantity(p.physicalStock - p.theoreticalStock);
    if (state === 'match') stats.matchCount++;
    if (state === 'missing') { stats.missingCount++; stats.totalMissingPieces -= diff; stats.missingCostValue -= diff * p.cost; }
    if (state === 'surplus') { stats.surplusCount++; stats.totalSurplusPieces += diff; stats.surplusCostValue += diff * p.cost; }
  }
  for (const key of ['totalPiecesTheoretical', 'totalPiecesPhysical', 'totalMissingPieces', 'totalSurplusPieces', 'missingCostValue', 'surplusCostValue'] as const) stats[key] = roundQuantity(stats[key]);
  return stats;
}
export function validateProducts(value: unknown): value is Product[] {
  if (!Array.isArray(value) || value.length > 20000) return false;
  const codes = new Set<string>();
  return value.every(p => {
    if (!p || typeof p !== 'object' || typeof p.code !== 'string' || !p.code.trim() || p.code !== p.code.trim() || p.code.length > 128 || codes.has(p.code)) return false;
    codes.add(p.code);
    return typeof p.description === 'string' && typeof p.department === 'string'
      && validQuantity(p.physicalStock) && validQuantity(p.cost) && validQuantity(p.price)
      && Number.isFinite(p.theoreticalStock) && Math.abs(p.theoreticalStock) <= MAX_QUANTITY
      && (p.counted === undefined || typeof p.counted === 'boolean')
      && (p.isUnregistered === undefined || typeof p.isUnregistered === 'boolean')
      && (p.lastScannedAt === undefined || typeof p.lastScannedAt === 'string');
  });
}
