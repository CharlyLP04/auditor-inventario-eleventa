import { useMemo, useState } from 'react';
import { TrendingDown, TrendingUp, CheckCircle2, Clock3, PackageSearch } from 'lucide-react';
import type { AuditStats, Product } from '../types';
import { isCounted, isExcluded, productStatus, roundQuantity } from '../services/auditState';
const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const emptyProducts: Product[] = [];
export function AuditSummary({ stats, products = emptyProducts, compact = false }: { stats: AuditStats; products?: Product[]; compact?: boolean }) {
  const [mode, setMode] = useState<'sale' | 'cost'>('sale');
  const missing = mode === 'sale' ? stats.missingSaleValue : stats.missingCostValue;
  const surplus = mode === 'sale' ? stats.surplusSaleValue : stats.surplusCostValue;
  const net = roundQuantity(surplus - missing);
  const percentage = stats.totalCatalog ? Math.min(100, Math.round(stats.auditedCount / stats.totalCatalog * 100)) : 0;
  const values = useMemo(() => {
    let catalog = 0, expected = 0, physical = 0, zeroCost = 0;
    const losses: { code: string; description: string; pieces: number; value: number }[] = [];
    for (const p of products) {
      if (p.isUnregistered || isExcluded(p)) continue;
      const price = mode === 'sale' ? p.price : p.cost;
      catalog += p.theoreticalStock * price;
      if (p.cost === 0) zeroCost++;
      if (!isCounted(p)) continue;
      expected += p.theoreticalStock * price; physical += p.physicalStock * price;
      if (productStatus(p) === 'missing' && price > 0) losses.push({ code: p.code, description: p.description, pieces: roundQuantity(p.theoreticalStock - p.physicalStock), value: roundQuantity((p.theoreticalStock - p.physicalStock) * price) });
    }
    return { catalog, expected, physical, zeroCost, losses: losses.sort((a, b) => b.value - a.value).slice(0, 4) };
  }, [products, mode]);
  return <section className={`balance-panel ${compact ? 'balance-compact' : ''}`} aria-label="Balance de auditoría">
    <div className="balance-heading"><div><span className="terminal-label">{compact ? 'CONTEO / EN VIVO' : 'BALANCE / INVENTARIO'}</span><h3>{compact ? 'Tu avance' : 'Lo esperado y lo contado'}</h3></div>
      {!compact && <div className="segmented-control" role="group" aria-label="Valorar inventario"><button aria-pressed={mode === 'sale'} onClick={() => setMode('sale')}>A venta</button><button aria-pressed={mode === 'cost'} onClick={() => setMode('cost')}>Al costo</button></div>}
    </div>
    <div className="audit-progress"><div><span><strong>{stats.auditedCount.toLocaleString('es-MX')}</strong> de {stats.totalCatalog.toLocaleString('es-MX')} productos</span><strong>{percentage}%</strong></div><progress value={stats.auditedCount} max={stats.totalCatalog || 1} aria-label="Productos del catálogo auditados" /><small>{stats.notCountedCount} pendientes de contar · Los no encontrados se registran por separado.</small></div>
    {!compact && <>
      <div className="valuation-grid">
        <div><span>Teórico de lo auditado</span><strong>{money.format(values.expected)}</strong><small>Catálogo completo: {money.format(values.catalog)}</small></div>
        <div><span>Físico contado</span><strong>{money.format(values.physical)}</strong><small>Los mismos productos del catálogo</small></div>
        <div className={net < 0 ? 'tone-loss' : net > 0 ? 'tone-surplus' : 'tone-exact'}><span>Diferencia neta</span><strong>{net > 0 ? '+' : ''}{money.format(net)}</strong><small>{net < 0 ? '↓ Faltante neto' : net > 0 ? '↑ Sobrante neto' : '✓ Sin diferencia valorada'}</small></div>
      </div>
      {mode === 'cost' && values.zeroCost > 0 && <p className="message warning">{values.zeroCost} productos sin costo registrado. Su valor al costo no está incluido.</p>}
    </>}
    <div className="outcome-grid">
      <div className="tone-loss"><TrendingDown size={18} aria-hidden="true" /><span>Faltantes</span><strong>{compact ? stats.missingCount : money.format(missing)}</strong><small>{stats.missingCount} productos · {stats.totalMissingPieces} piezas</small></div>
      <div className="tone-surplus"><TrendingUp size={18} aria-hidden="true" /><span>Sobrantes</span><strong>{compact ? stats.surplusCount : money.format(surplus)}</strong><small>{stats.surplusCount} productos · {stats.totalSurplusPieces} piezas</small></div>
      <div className="tone-exact"><CheckCircle2 size={18} aria-hidden="true" /><span>Coinciden</span><strong>{stats.matchCount}</strong><small>Productos sin diferencias</small></div>
      <div><Clock3 size={18} aria-hidden="true" /><span>Pendientes</span><strong>{stats.notCountedCount}</strong><small>Aún sin conteo confirmado</small></div>
    </div>
    {stats.unregisteredCount > 0 && <p className="balance-note"><PackageSearch size={17} aria-hidden="true" />{stats.unregisteredCount} códigos no encontrados en el catálogo</p>}
    {!compact && values.losses.length > 0 && <div className="loss-review"><h4>Revisar primero <span>Mayor valor faltante</span></h4><ul>{values.losses.map(p => <li key={p.code}><div><code>{p.code}</code><strong>{p.description}</strong><small>↓ {p.pieces} piezas faltantes</small></div><span className="tone-loss">−{money.format(p.value)}</span></li>)}</ul></div>}
  </section>;
}
