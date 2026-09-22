import { useMemo, useState } from 'react';
import type { Product, ProductFilter } from '../types';
import { productStatus, roundQuantity, validQuantity } from '../services/auditState';
const labels = { missing: '↓ Faltante', surplus: '↑ Sobrante', match: '✓ Cuadrado', not_counted: 'Pendiente', unregistered: '⚠ No registrado' };
const filters: { id: ProductFilter; title: string }[] = [{ id: 'all', title: 'Todos' }, { id: 'missing', title: '↓ Faltantes' }, { id: 'surplus', title: '↑ Sobrantes' }, { id: 'match', title: '✓ Cuadrados' }, { id: 'not_counted', title: 'Pendientes' }, { id: 'unregistered', title: '⚠ Nuevos' }];
const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
export function InventoryTable({ products, onUpdateQuantity }: { products: Product[]; onUpdateQuantity: (code: string, quantity: number) => void }) {
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [filter, setFilter] = useState<ProductFilter>('all');
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const departments = useMemo(() => [...new Set(products.map(p => p.department))].sort(), [products]);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es');
    return products.filter(p => (!query || `${p.code} ${p.description}`.toLocaleLowerCase('es').includes(query)) && (!department || p.department === department) && (filter === 'all' || (filter === 'unregistered' ? p.isUnregistered : productStatus(p) === filter)));
  }, [products, search, department, filter]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / 50));
  const currentPage = Math.min(page, totalPages - 1);
  const visible = filtered.slice(currentPage * 50, currentPage * 50 + 50);
  const changeFilter = (id: ProductFilter) => { setFilter(id); setPage(0); setEditing(null); };
  const save = (p: Product) => {
    const value = draft.trim() ? Number(draft) : NaN;
    if (!validQuantity(value)) { setError('Escribe una cantidad entre 0 y 1,000,000,000.'); return; }
    onUpdateQuantity(p.code, value); setEditing(null); setError('');
  };
  return <section aria-label="Productos del inventario">
    <div className="inventory-toolbar"><label>Buscar producto<input type="search" name="search" autoComplete="off" placeholder="Descripción o código…" value={search} onChange={e => { setSearch(e.target.value); setPage(0); setEditing(null); }} /></label><label>Departamento<select value={department} onChange={e => { setDepartment(e.target.value); setPage(0); setEditing(null); }}><option value="">Todos los departamentos</option>{departments.map(d => <option key={d}>{d}</option>)}</select></label></div>
    <div className="filter-bar" aria-label="Filtrar por estado">{filters.map(f => <button key={f.id} aria-pressed={filter === f.id} onClick={() => changeFilter(f.id)}>{f.title}</button>)}</div>
    <p role="status" className="result-count">{filtered.length} productos · Página {currentPage + 1} de {totalPages}</p>
    <div className="inventory-columns desktop-only" aria-hidden="true"><span>Producto</span><span>En eleventa</span><span>Costo</span><span>Estado / diferencia</span><span>Conteo físico</span></div>
    <div className="inventory-list">{visible.map(p => {
      const state = productStatus(p);
      const difference = roundQuantity(p.physicalStock - p.theoreticalStock);
      return <article key={p.code} className={`inventory-row status-${state}`} aria-label={p.description}>
        <div className="product-info"><code>{p.code}</code><h3>{p.description}</h3><span>{p.department}</span></div>
        <div className="stock-cell"><span className="mobile-only">En eleventa: </span><strong>{p.theoreticalStock}</strong></div>
        <div className="cost-cell"><span className="mobile-only">Costo: </span>{money.format(p.cost)}</div>
        <div className="status-cell"><span className="status-label">{labels[state]}</span>{(state === 'missing' || state === 'surplus') && <small>{difference > 0 ? '+' : ''}{difference} pzas · {money.format(difference * p.cost)}</small>}{p.isUnregistered && state === 'not_counted' && <small>⚠ No registrado</small>}</div>
        <div className="quantity-cell">{editing === p.code ? <form onSubmit={e => { e.preventDefault(); save(p); }} className="quantity-editor">
          <input aria-label={`Conteo físico de ${p.description}`} name="quantity" type="number" min="0" max="1000000000" step="any" inputMode="decimal" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditing(null); setError(''); } }} autoFocus />
          <button type="submit" className="primary" aria-label={`Guardar cantidad de ${p.description}`}>✓</button><button type="button" className="secondary" aria-label="Cancelar edición" onClick={() => { setEditing(null); setError(''); }}>✕</button>
          {error && <p role="alert">{error}</p>}
        </form> : <div className="quantity-controls"><button className="secondary" disabled={p.physicalStock <= 0} aria-label={`Restar una unidad de ${p.description}`} onClick={() => onUpdateQuantity(p.code, Math.max(0, roundQuantity(p.physicalStock - 1)))}>−</button><button className="quantity-value" aria-label={`Editar conteo de ${p.description}: ${p.physicalStock}`} onClick={() => { setEditing(p.code); setDraft(String(p.physicalStock)); setError(''); }}>{p.physicalStock}</button><button className="primary" disabled={p.physicalStock >= 1000000000} aria-label={`Sumar una unidad de ${p.description}`} onClick={() => onUpdateQuantity(p.code, roundQuantity(p.physicalStock + 1))}>+</button></div>}</div>
      </article>;
    })}</div>
    {!visible.length && <div className="empty-state"><h3>No hay productos para mostrar</h3><p>{products.length ? 'Prueba otro código, departamento o filtro.' : 'Carga un archivo para iniciar el conteo.'}</p></div>}
    {totalPages > 1 && <div className="pagination"><button className="secondary" disabled={currentPage === 0} onClick={() => { setPage(currentPage - 1); setEditing(null); }}>Anterior</button><span>{currentPage + 1} / {totalPages}</span><button className="secondary" disabled={currentPage + 1 >= totalPages} onClick={() => { setPage(currentPage + 1); setEditing(null); }}>Siguiente</button></div>}
  </section>;
}
