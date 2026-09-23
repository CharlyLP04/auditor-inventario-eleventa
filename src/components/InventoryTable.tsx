import { useMemo, useState } from 'react';
import type { Product, ProductFilter } from '../types';
import { productStatus, roundQuantity, validQuantity } from '../services/auditState';

const labels = {
  missing: '↓ Faltante',
  surplus: '↑ Sobrante',
  match: '✓ Cuadrado',
  not_counted: 'Pendiente',
  unregistered: '⚠ No registrado',
};

const filters: { id: ProductFilter; title: string }[] = [
  { id: 'all', title: 'Todos' },
  { id: 'missing', title: '↓ Faltantes' },
  { id: 'surplus', title: '↑ Sobrantes' },
  { id: 'match', title: '✓ Cuadrados' },
  { id: 'not_counted', title: 'Pendientes' },
  { id: 'unregistered', title: '⚠ Nuevos' },
];

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

export function InventoryTable({
  products,
  onUpdateQuantity,
  readOnly = false,
}: {
  products: Product[];
  readOnly?: boolean;
  onUpdateQuantity: (code: string, quantity: number) => void;
}) {
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
    return products.filter(p => 
      (!query || `${p.code} ${p.description}`.toLocaleLowerCase('es').includes(query)) &&
      (!department || p.department === department) &&
      (filter === 'all' || (filter === 'unregistered' ? p.isUnregistered : productStatus(p) === filter))
    );
  }, [products, search, department, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / 50));
  const currentPage = Math.min(page, totalPages - 1);
  const visible = filtered.slice(currentPage * 50, currentPage * 50 + 50);

  const changeFilter = (id: ProductFilter) => {
    setFilter(id);
    setPage(0);
    setEditing(null);
  };

  const save = (p: Product) => {
    const value = draft.trim() ? Number(draft) : NaN;
    if (!validQuantity(value)) {
      setError('Escribe una cantidad entre 0 y 1,000,000,000.');
      return;
    }
    onUpdateQuantity(p.code, value);
    setEditing(null);
    setError('');
  };

  return (
    <section aria-label="Productos del inventario">
      {/* Barra de Búsqueda y Filtros con estilo Swatch */}
      <div className="inventory-toolbar">
        <label>
          Buscar producto
          <input
            type="search"
            name="search"
            autoComplete="off"
            placeholder="Descripción o código de barras…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); setEditing(null); }}
          />
        </label>
        <label>
          Departamento
          <select
            value={department}
            onChange={e => { setDepartment(e.target.value); setPage(0); setEditing(null); }}
          >
            <option value="">Todos los departamentos</option>
            {departments.map(d => <option key={d}>{d}</option>)}
          </select>
        </label>
      </div>

      {/* Píldoras de Filtro Redondeadas */}
      <div className="filter-bar" aria-label="Filtrar por estado">
        {filters.map(f => (
          <button
            key={f.id}
            aria-pressed={filter === f.id}
            onClick={() => changeFilter(f.id)}
            className="cursor-pointer"
          >
            {f.title}
          </button>
        ))}
      </div>

      <p role="status" className="result-count">
        {filtered.length} productos coincidentes · Página {currentPage + 1} de {totalPages}
      </p>

      <div className="inventory-columns desktop-only" aria-hidden="true">
        <span>Producto</span>
        <span>En eleventa</span>
        <span>Precio venta</span>
        <span>Costo</span>
        <span>Estado / Diferencia</span>
        <span>Conteo Físico</span>
      </div>

      {/* Lista de Tarjetas de Producto */}
      <div className="inventory-list">
        {visible.map(p => {
          const state = productStatus(p);
          const difference = roundQuantity(p.physicalStock - p.theoreticalStock);

          return (
            <article
              key={p.code}
              className={`inventory-row status-${state} animate-card-pop`}
              aria-label={p.description}
            >
              <div className="product-info">
                <code>{p.code}</code>
                <h3>{p.description}</h3>
                <span>{p.department}</span>
              </div>

              <div className="stock-cell">
                <span className="mobile-only text-[#B38F6F] font-bold">En eleventa: </span>
                <strong>{p.theoreticalStock}</strong><small>Mínimo: {p.minStock ?? "Sin dato"}</small>
              </div>

              <div className="price-cell"><span>Precio venta: </span><strong>{money.format(p.price)}</strong><small>Mayoreo: {p.wholesalePrice === undefined ? "Sin dato" : money.format(p.wholesalePrice)}</small></div>
              <div className="cost-cell">
                <span className="mobile-only text-[#B38F6F] font-bold">Costo: </span>
                {p.cost === 0 ? "Sin costo" : money.format(p.cost)}
              </div>

              <div className="status-cell">
                <span className="status-label">{labels[state]}</span>
                {(state === 'missing' || state === 'surplus') && (
                  <small className="font-bold">
                    {difference > 0 ? '+' : ''}{difference} pzas · {money.format(difference * (p.cost || p.price))} {p.cost === 0 ? "(a precio venta)" : "(al costo)"}
                  </small>
                )}
                {p.isUnregistered && state === 'not_counted' && (
                  <small className="text-[#FF6E42]">⚠ No registrado</small>
                )}
              </div>

              <fieldset className="quantity-cell workspace-fields" disabled={readOnly}>
                {editing === p.code ? (
                  <form
                    onSubmit={e => { e.preventDefault(); save(p); }}
                    className="quantity-editor"
                  >
                    <input
                      aria-label={`Conteo físico de ${p.description}`}
                      name="quantity"
                      type="number"
                      min="0"
                      max="1000000000"
                      step="any"
                      inputMode="decimal"
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Escape') { setEditing(null); setError(''); } }}
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="primary"
                      aria-label={`Guardar cantidad de ${p.description}`}
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      aria-label="Cancelar edición"
                      onClick={() => { setEditing(null); setError(''); }}
                    >
                      ✕
                    </button>
                    {error && <p role="alert">{error}</p>}
                  </form>
                ) : (
                  <div className="quantity-controls">
                    <button
                      className="round-btn"
                      disabled={p.physicalStock <= 0}
                      aria-label={`Restar una unidad de ${p.description}`}
                      onClick={() => onUpdateQuantity(p.code, Math.max(0, roundQuantity(p.physicalStock - 1)))}
                    >
                      −
                    </button>
                    <button
                      className="quantity-value hover:border-[#FF6E42] transition-colors"
                      aria-label={`Editar conteo de ${p.description}: ${p.physicalStock}`}
                      onClick={() => { setEditing(p.code); setDraft(String(p.physicalStock)); setError(''); }}
                      title="Toca para editar cantidad directamente"
                    >
                      {p.physicalStock}
                    </button>
                    <button
                      className="round-btn round-btn-plus"
                      disabled={p.physicalStock >= 1000000000}
                      aria-label={`Sumar una unidad de ${p.description}`}
                      onClick={() => onUpdateQuantity(p.code, roundQuantity(p.physicalStock + 1))}
                    >
                      +
                    </button>
                  </div>
                )}
              </fieldset>
            </article>
          );
        })}
      </div>

      {!visible.length && (
        <div className="empty-state max-w-md mx-auto my-8 p-8 border border-white/10 rounded-[28px] bg-[#202020] text-center shadow-xl">
          <div className="w-16 h-16 rounded-full bg-[#B38F6F]/20 text-[#B38F6F] flex items-center justify-center mx-auto mb-4 border border-[#B38F6F]/30">
            <span className="text-2xl">📋</span>
          </div>
          <h3 className="text-lg font-black text-[#F2F1ED]">No hay productos en esta vista</h3>
          <p className="text-xs text-[#888888] mt-2 leading-relaxed">
            {products.length
              ? 'No se encontraron coincidencias con la búsqueda o filtro actual.'
              : 'Para comenzar a auditar, carga tu catálogo exportado desde eleventa en la sección "eleventa".'}
          </p>
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="secondary"
            disabled={currentPage === 0}
            onClick={() => { setPage(currentPage - 1); setEditing(null); }}
          >
            Anterior
          </button>
          <span className="font-bold text-[#F2F1ED]">{currentPage + 1} / {totalPages}</span>
          <button
            className="secondary"
            disabled={currentPage + 1 >= totalPages}
            onClick={() => { setPage(currentPage + 1); setEditing(null); }}
          >
            Siguiente
          </button>
        </div>
      )}
    </section>
  );
}
