import { useMemo, useState } from 'react';
import type { Product } from '../types';
import { departmentStats } from '../services/scannerState';
export function DepartmentSummary({ products }: { products: Product[] }) {
  const departments = useMemo(() => departmentStats(products), [products]);
  const [pendingOnly, setPendingOnly] = useState(false);
  const visible = departments.filter(item => !pendingOnly || item.stats.notCountedCount > 0);
  return <section className="workspace-card department-summary department-chart">
    <div className="department-chart-heading"><h3>Avance por departamento</h3><button className="secondary" aria-pressed={pendingOnly} onClick={() => setPendingOnly(value => !value)}>Solo pendientes</button></div>
    {!departments.length ? <p>Importa un catálogo para ver el avance por zonas.</p> : !visible.length ? <p>Todos los departamentos están contados.</p> : <div className="department-bars">{visible.map(({ department, stats }) => {
      const percent = stats.totalCatalog ? Math.min(100, Math.round(stats.auditedCount / stats.totalCatalog * 100)) : 0;
      return <article key={department}>
        <div className="department-bar-heading"><h4>{department || 'Sin departamento'}</h4><strong>{percent}%</strong></div>
        <progress aria-label={`Avance en ${department || 'Sin departamento'}`} max={stats.totalCatalog || 1} value={stats.auditedCount} />
        <div className="department-bar-meta"><span>{stats.auditedCount} / {stats.totalCatalog} contados</span><span>{stats.notCountedCount} pendientes</span></div>
        {(stats.missingCount > 0 || stats.surplusCount > 0 || stats.unregisteredCount > 0) && <div className="department-differences"><span>↓ {stats.missingCount} faltantes</span><span>↑ {stats.surplusCount} sobrantes</span><span>{stats.unregisteredCount} fuera del catálogo</span></div>}
      </article>;
    })}</div>}
  </section>;
}
