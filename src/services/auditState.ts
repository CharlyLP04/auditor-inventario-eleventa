import type { Product, AuditStats, ProductStatus, ImportReport } from '../types';
export const MAX_QUANTITY = 1_000_000_000;
export const isCounted = (p: Product) => p.counted ?? (p.physicalStock > 0 || Boolean(p.lastScannedAt));
export const isExcluded = (p: Product) => Boolean(p.excludedAt);
export const roundQuantity = (value: number) => Math.round(value * 1e6) / 1e6;
export const validQuantity = (value: number) => Number.isFinite(value) && value >= 0 && value <= MAX_QUANTITY;
export function productStatus(p: Product): ProductStatus {
  if (isExcluded(p)) return 'excluded';
  if (!isCounted(p)) return 'not_counted';
  if (p.isUnregistered) return 'unregistered';
  const diff = roundQuantity(p.physicalStock - p.theoreticalStock);
  return diff < 0 ? 'missing' : diff > 0 ? 'surplus' : 'match';
}
export function calculateStats(products: Product[]): AuditStats {
  const stats: AuditStats = { totalCatalog: 0, auditedCount: 0, totalPiecesTheoretical: 0, totalPiecesPhysical: 0, totalMissingPieces: 0, totalSurplusPieces: 0, missingSaleValue: 0, surplusSaleValue: 0, missingCostValue: 0, surplusCostValue: 0, matchCount: 0, missingCount: 0, surplusCount: 0, notCountedCount: 0, unregisteredCount: 0, excludedCount: 0 };
  for (const p of products) {
    // Un no encontrado excluido se conserva para el historial, pero no participa en ninguna cifra.
    if (isExcluded(p)) { stats.excludedCount++; continue; }
    stats.totalCatalog++;
    stats.totalPiecesTheoretical += p.theoreticalStock;
    stats.totalPiecesPhysical += p.physicalStock;
    if (p.isUnregistered) stats.unregisteredCount++;
    if (isCounted(p)) stats.auditedCount++; else stats.notCountedCount++;
    const state = productStatus(p);
    const diff = roundQuantity(p.physicalStock - p.theoreticalStock);
    if (state === 'match') stats.matchCount++;
    if (state === 'missing') { stats.missingCount++; stats.totalMissingPieces -= diff; stats.missingCostValue -= diff * p.cost; stats.missingSaleValue -= diff * p.price; }
    if (state === 'surplus') { stats.surplusCount++; stats.totalSurplusPieces += diff; stats.surplusCostValue += diff * p.cost; stats.surplusSaleValue += diff * p.price; }
  }
  for (const key of ['totalPiecesTheoretical', 'totalPiecesPhysical', 'totalMissingPieces', 'totalSurplusPieces', 'missingCostValue', 'surplusCostValue', 'missingSaleValue', 'surplusSaleValue'] as const) stats[key] = roundQuantity(stats[key]);
  return stats;
}
/** Cifras para comprobar que el catálogo se cargó completo y cuánto falta por contar. Solo usa precio de venta. */
export function catalogVerification(products: Product[], report?: Pick<ImportReport, 'fileRows' | 'imported' | 'issues'>) {
  const catalog = products.filter(p => !p.isUnregistered);
  const departments = new Map<string, boolean>();
  let found = 0, match = 0, missing = 0, surplus = 0, missingPrice = 0, expectedSaleValue = 0, countedSaleValue = 0, theoreticalPieces = 0, physicalPieces = 0;
  for (const p of catalog) {
    const counted = isCounted(p);
    departments.set(p.department, (departments.get(p.department) ?? true) && counted);
    if (p.price === 0) missingPrice++;
    expectedSaleValue += p.theoreticalStock * p.price;
    theoreticalPieces += p.theoreticalStock;
    if (!counted) continue;
    found++;
    countedSaleValue += p.physicalStock * p.price;
    physicalPieces += p.physicalStock;
    const state = productStatus(p);
    if (state === 'match') match++; else if (state === 'missing') missing++; else if (state === 'surplus') surplus++;
  }
  const unregistered = products.filter(p => p.isUnregistered && !isExcluded(p)).length;
  return {
    expected: catalog.length, fileRows: report?.fileRows ?? null, skipped: report?.issues.length ?? null,
    found, pending: catalog.length - found, match, missing, surplus, unregistered,
    excluded: products.filter(isExcluded).length, missingPrice,
    departmentsTotal: departments.size, departmentsDone: [...departments.values()].filter(Boolean).length,
    progress: catalog.length ? Math.round(found / catalog.length * 100) : 0,
    expectedSaleValue: roundQuantity(expectedSaleValue), countedSaleValue: roundQuantity(countedSaleValue),
    theoreticalPieces: roundQuantity(theoreticalPieces), physicalPieces: roundQuantity(physicalPieces),
  };
}
const optionalText = (value: unknown, max: number) => value === undefined || (typeof value === 'string' && value.length <= max);
const optionalDate = (value: unknown) => value === undefined || (typeof value === 'string' && Number.isFinite(Date.parse(value)));
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
      && (p.sourceDescription === undefined || typeof p.sourceDescription === 'string')
      && (p.unitType === undefined || p.unitType === 'unidad' || p.unitType === 'granel')
      && (p.wholesalePrice === undefined || validQuantity(p.wholesalePrice))
      && (p.minStock === undefined || validQuantity(p.minStock))
      && (p.lastScannedAt === undefined || typeof p.lastScannedAt === 'string')
      && optionalText(p.sku, 128) && optionalText(p.note, 1000) && optionalText(p.excludedReason, 1000) && optionalText(p.linkedTo, 128)
      && optionalDate(p.excludedAt);
  });
}
