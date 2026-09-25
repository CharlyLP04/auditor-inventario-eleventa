import { useMemo } from 'react';
import type { Product } from '../types';
import { departmentStats } from '../services/scannerState';
export function DepartmentSummary({ products }: { products: Product[] }) {
  const departments = useMemo(() => departmentStats(products), [products]);
  return <section className="workspace-card department-summary"><h3>Avance por departamento</h3>
    {!departments.length ? <p>Importa un catálogo para ver el avance por zonas.</p> : <div className="department-grid">{departments.map(({ department, stats }) => <article key={department}><h4>{department}</h4><strong>{stats.auditedCount} / {stats.totalCatalog} contados</strong><progress aria-label={`Avance en ${department}`} max={stats.totalCatalog || 1} value={stats.auditedCount} /><p>↓ {stats.missingCount} productos faltantes · ↑ {stats.surplusCount} sobrantes</p><small>{stats.notCountedCount} pendientes · {stats.unregisteredCount} no registrados</small></article>)}</div>}
  </section>;
}
