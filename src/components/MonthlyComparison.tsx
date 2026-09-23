import type { AuditRecord } from '../types';
import { productStatus, roundQuantity } from '../services/auditState';
const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
export function MonthlyComparison({ current, audits }: { current: AuditRecord; audits: AuditRecord[] }) {
  const [year, month] = current.period.split('-').map(Number);
  const previousPeriod = `${month === 1 ? year - 1 : year}-${String(month === 1 ? 12 : month - 1).padStart(2, '0')}`;
  const previous = audits.find(a => a.companyId === current.companyId && a.period === previousPeriod);
  if (!previous) return <section className="workspace-card"><h3>Comparativa mensual</h3><p>No hay auditoría de {previousPeriod} para esta empresa.</p></section>;
  const delta = roundQuantity(current.stats.missingSaleValue - previous.stats.missingSaleValue);
  const percent = previous.stats.missingSaleValue > 0 ? Math.abs(delta / previous.stats.missingSaleValue * 100).toFixed(1) : null;
  const oldMissing = new Set(previous.products.filter(p => productStatus(p) === 'missing').map(p => p.code));
  const recurring = current.products.filter(p => productStatus(p) === 'missing' && oldMissing.has(p.code));
  const provisional = [previous, current].some(a => a.status === 'in_progress' || a.stats.notCountedCount > 0);
  const max = Math.max(previous.stats.missingSaleValue, current.stats.missingSaleValue, 1);
  return <section className="workspace-card"><h3>Comparativa mensual · Precio de venta</h3>
    <p>{delta === 0 ? 'Merma sin variación' : `Merma ${delta < 0 ? 'reducida' : 'incrementada'}${percent === null ? '' : ` en ${percent}%`}`} respecto a {previous.period}: {delta > 0 ? '+' : ''}{money.format(delta)}.</p>
    {percent === null && <p>El mes anterior no registró merma valorada; no se calcula porcentaje.</p>}
    {provisional && <p className="message warning">Comparación provisional: hay una auditoría en curso o productos pendientes de contar.</p>}
    <p>La comparación utiliza los catálogos y precios de cada mes; sus cambios pueden afectar los importes.</p>
    {[previous, current].map(a => <div className="comparison-bar" key={a.id}><span>{a.period} · {money.format(a.stats.missingSaleValue)}</span><meter min={0} max={max} value={a.stats.missingSaleValue} aria-label={`Merma PVP ${a.period}`} /></div>)}
    <h4>Mermas recurrentes ({recurring.length})</h4>
    <ul>{recurring.slice(0, 20).map(p => <li key={p.code}>{p.description} · {p.code} · {roundQuantity(p.theoreticalStock - p.physicalStock)} piezas faltantes este mes</li>)}</ul>
    {recurring.length > 20 && <p>Se muestran los primeros 20 productos.</p>}
  </section>;
}
