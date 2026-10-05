import { Search, X, ListFilter, Check } from 'lucide-react';
import { useViewPreference } from '../hooks/useViewPreference';
import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { ProductEditor } from './ProductEditor';
import { UnregisteredEditor } from './UnregisteredEditor';
import type { Product, ProductFilter } from '../types';
import { isCounted, isExcluded, productStatus, roundQuantity, validQuantity } from '../services/auditState';
import { searchProducts } from '../services/productSearch';

const labels = {
  missing: '↓ Faltante',
  surplus: '↑ Sobrante',
  match: '✓ Cuadrado',
  not_counted: 'Pendiente',
  unregistered: '✕ No encontrado',
  excluded: '⊘ Excluido',
};

const filters: { id: ProductFilter; title: string }[] = [
  { id: 'all', title: 'Todos' },
  { id: 'missing', title: '↓ Faltantes' },
  { id: 'surplus', title: '↑ Sobrantes' },
  { id: 'match', title: '✓ Cuadrados' },
  { id: 'not_counted', title: 'Pendientes' },
  { id: 'unregistered', title: '✕ No encontrados' },
  { id: 'excluded', title: '⊘ Excluidos' },
];

const matchesFilter = (p: Product, id: ProductFilter) => id === 'excluded'
  ? isExcluded(p)
  : !isExcluded(p) && (id === 'all' || (id === 'unregistered' ? Boolean(p.isUnregistered) : productStatus(p) === id));

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

export function InventoryTable({
  products,
  viewKey = 'inventory',
  onUpdateQuantity,
  readOnly = false,
  isAdmin = false,
  onUpdateProduct,
  unregisteredActions,
}: {
  products: Product[];
  viewKey?: string;
  readOnly?: boolean;
  isAdmin?: boolean;
  onUpdateProduct?: (code: string, patch: Partial<Pick<Product, 'department' | 'cost' | 'price'>>) => Promise<boolean>;
  onUpdateQuantity: (code: string, quantity: number) => void | Promise<boolean>;
  unregisteredActions?: {
    onEdit: (code: string, patch: { name?: string; note?: string }) => Promise<boolean>;
    onExclude: (code: string, reason: string) => Promise<boolean>;
    onRestore: (code: string) => Promise<boolean>;
    onLink: (code: string, target: string) => Promise<boolean>;
  };
}) {
  const [metadataProduct, setMetadataProduct] = useState<Product | null>(null);
  const [unregisteredCode, setUnregisteredCode] = useState<string | null>(null);
  const unregisteredProduct = products.find(p => p.code === unregisteredCode);
  const [search, setSearch] = useViewPreference(`${viewKey}:search`, '', (v): v is string => typeof v === 'string');
  const [department, setDepartment] = useViewPreference(`${viewKey}:department`, '', (v): v is string => typeof v === 'string');
  const [filter, setFilter] = useViewPreference<ProductFilter>(`${viewKey}:filter`, 'all', (v): v is ProductFilter => filters.some(f => f.id === v));
  const [page, setPage] = useViewPreference(`${viewKey}:page`, 0, (v): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [savedCode, setSavedCode] = useState<string | null>(null);
  const saving = useRef(false);
  const deferredSearch = useDeferredValue(search);

  const departments = useMemo(() => [...new Set(products.map(p => p.department))].sort(), [products]);

  // Los contadores respetan la misma búsqueda y departamento que la lista.
  const scopedProducts = useMemo(() => {
    const base = deferredSearch.trim() ? searchProducts(products, deferredSearch, { limit: Infinity }).map(r => r.product) : products;
    return base.filter(p => !department || p.department === department);
  }, [products, deferredSearch, department]);
  const filterCounts = useMemo(() => {
    const counts: Record<ProductFilter, number> = { all: 0, missing: 0, surplus: 0, match: 0, not_counted: 0, unregistered: 0, excluded: 0 };
    for (const product of scopedProducts) {
      if (isExcluded(product)) { counts.excluded++; continue; }
      counts.all++;
      const status = productStatus(product);
      if (product.isUnregistered) counts.unregistered++;
      if (status !== 'unregistered') counts[status]++;
    }
    return counts;
  }, [scopedProducts]);
  const filtered = useMemo(() => scopedProducts.filter(p => matchesFilter(p, filter)), [scopedProducts, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / 50));
  const currentPage = Math.min(page, totalPages - 1);
  const visible = filtered.slice(currentPage * 50, currentPage * 50 + 50);

  const changeFilter = (id: ProductFilter) => {
    setFilter(id);
    setPage(0);
    setEditing(null);
  };

  const updateQuantity = async (p: Product, value: number) => {
    if (saving.current || readOnly || isExcluded(p)) return;
    if (!validQuantity(value)) { setError('Escribe una cantidad entre 0 y 1,000,000,000.'); return; }
    saving.current = true; setSavingCode(p.code); setError(''); setSavedCode(null);
    try {
      if (await onUpdateQuantity(p.code, value) === false) { setError('No se guardó el conteo. Revisa el aviso e intenta de nuevo.'); return; }
      setEditing(null); setSavedCode(p.code);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar la cantidad.'); }
    finally { saving.current = false; setSavingCode(null); }
  };
  const save = (p: Product) => updateQuantity(p, draft.trim() ? Number(draft) : NaN);
  const clearFilters = () => { setSearch(''); setDepartment(''); setFilter('all'); setPage(0); setEditing(null); };

  return (
    <section className="inventory-workspace" aria-label="Productos del inventario">
      {unregisteredProduct && unregisteredActions && <UnregisteredEditor product={unregisteredProduct} products={products} onClose={() => setUnregisteredCode(null)} {...unregisteredActions} />}
      {metadataProduct && onUpdateProduct && <ProductEditor product={metadataProduct} departments={departments} isAdmin={isAdmin} onSave={onUpdateProduct} onClose={() => setMetadataProduct(null)} />}
      {/* Barra de Búsqueda y Filtros con estilo Swatch */}
      <div className="inventory-toolbar">
        <label>
          <span><Search size={15} aria-hidden="true" /> Buscar producto</span>
          <input
            type="search"
            name="search"
            autoComplete="off"
            placeholder="Descripción, código o clave…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); setEditing(null); }}
          />
        </label>
        <label>
          <span><ListFilter size={15} aria-hidden="true" /> Departamento</span>
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
            className={`filter-${f.id}`}
          >
            {f.title}<span className="filter-count">{filterCounts[f.id].toLocaleString('es-MX')}</span>
          </button>
        ))}
      </div>

      <div className="inventory-results">
        <p role="status" className="result-count">{deferredSearch !== search ? 'Buscando…' : `${filtered.length.toLocaleString('es-MX')} productos · Página ${currentPage + 1} de ${totalPages}`}</p>
        {(search || department || filter !== 'all') && <button className="text-button" onClick={clearFilters}><X size={14} aria-hidden="true" /> Limpiar filtros</button>}
        <span className="inventory-save" role="status">{savingCode ? 'Guardando conteo…' : savedCode ? <><Check size={14} aria-hidden="true" /> {savedCode} guardado</> : 'Toca una cantidad para corregirla'}</span>
      </div>
      {error && <p role="alert" className="message warning">{error}</p>}

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
              className={`inventory-row status-${state}${savingCode === p.code ? ' is-saving' : ''}${savedCode === p.code ? ' is-updated' : ''}`}
              aria-label={p.description}
            >
              <div className="product-info">
                <code>{p.code}</code>
                <h3>{p.description}</h3>
                <span>{p.department}{p.sku ? ` · Clave ${p.sku}` : ''}</span>
                {p.isUnregistered && p.note && <small className="product-note">Nota: {p.note}</small>}
                {p.excludedAt && <small className="product-note">Excluido: {p.excludedReason}</small>}
                {p.isUnregistered
                  ? unregisteredActions && <button disabled={readOnly} className="product-edit-button" onClick={() => setUnregisteredCode(p.code)}>{p.excludedAt ? 'Ver o reincorporar' : 'Gestionar no encontrado'}</button>
                  : onUpdateProduct && <button disabled={readOnly} className="product-edit-button" onClick={() => setMetadataProduct(p)}>{isAdmin ? "Editar producto" : "Cambiar departamento"}</button>}
              </div>

              <div className="stock-cell">
                <span className="mobile-only text-[var(--app-muted)] font-bold">En eleventa: </span>
                <strong>{p.theoreticalStock}</strong><small>Mínimo: {p.minStock ?? "Sin dato"}</small>
              </div>

              <div className="price-cell"><span>Precio venta: </span><strong>{money.format(p.price)}</strong><small>Mayoreo: {p.wholesalePrice === undefined ? "Sin dato" : money.format(p.wholesalePrice)}</small></div>
              <div className="cost-cell">
                <span className="mobile-only text-[var(--app-muted)] font-bold">Costo: </span>
                {p.cost === 0 ? "Sin costo" : money.format(p.cost)}
              </div>

              <div className="status-cell">
                <span className="status-label">{labels[state]}</span>
                {(state === 'missing' || state === 'surplus') && (
                  <small className="font-bold">
                    {difference > 0 ? '+' : ''}{difference} pzas · {money.format(difference * p.price)} a precio de venta
                  </small>
                )}

              </div>

              <fieldset className="quantity-cell workspace-fields" disabled={readOnly || isExcluded(p) || savingCode !== null}>
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
                      onClick={() => { void updateQuantity(p, Math.max(0, roundQuantity(p.physicalStock - 1))); }}
                    >
                      −
                    </button>
                    <button
                      className="quantity-value hover:border-[var(--app-accent)] transition-colors"
                      aria-label={`Editar conteo de ${p.description}: ${p.physicalStock}`}
                      onClick={() => { setEditing(p.code); setDraft(String(p.physicalStock)); setError(''); }}
                      title="Toca para editar cantidad directamente"
                    >
                      {isExcluded(p) ? '—' : !isCounted(p) ? '—' : p.physicalStock}
                    </button>
                    <button
                      className="round-btn round-btn-plus"
                      disabled={p.physicalStock >= 1000000000}
                      aria-label={`Sumar una unidad de ${p.description}`}
                      onClick={() => { void updateQuantity(p, roundQuantity(p.physicalStock + 1)); }}
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
        <div className="empty-state max-w-md mx-auto my-8 p-8 border border-white/10 rounded-[28px] bg-[var(--app-surface)] text-center shadow-xl">
          <div className="w-16 h-16 rounded-full bg-[var(--app-muted)]/20 text-[var(--app-muted)] flex items-center justify-center mx-auto mb-4 border border-[var(--app-muted)]/30">
            <Search size={24} aria-hidden="true" />
          </div>
          <h3 className="text-lg font-black text-[var(--app-pearl)]">No hay productos en esta vista</h3>
          <p className="text-xs text-[var(--app-muted)] mt-2 leading-relaxed">
            {products.length
              ? 'No se encontraron coincidencias con la búsqueda o filtro actual.'
              : 'Para comenzar a auditar, carga tu catálogo exportado desde eleventa en la sección "Importar".'}
          </p>
        </div>
      )}

      {totalPages > 1 && (
        <nav className="pagination" aria-label="Páginas del inventario">
          <button
            className="secondary"
            disabled={currentPage === 0}
            onClick={() => { setPage(currentPage - 1); setEditing(null); }}
          >
            Anterior
          </button>
          <span className="font-bold text-[var(--app-pearl)]">{currentPage + 1} / {totalPages}</span>
          <button
            className="secondary"
            disabled={currentPage + 1 >= totalPages}
            onClick={() => { setPage(currentPage + 1); setEditing(null); }}
          >
            Siguiente
          </button>
        </nav>
      )}
    </section>
  );
}
