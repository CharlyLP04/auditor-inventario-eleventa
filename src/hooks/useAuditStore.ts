import { useEffect, useRef, useState } from 'react';
import type { Product } from '../types';
import { validateProducts } from '../services/auditState';
export const STORAGE_KEY = 'auditor_eleventa_products_v1';
function load() {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    const products: unknown = raw ? JSON.parse(raw) : [];
    if (!validateProducts(products)) throw new Error('Formato inválido');
    return { products, raw, error: '' };
  } catch {
    return { products: [] as Product[], raw, error: 'No se pudo leer el conteo guardado. No se sobrescribió. Descarga el respaldo antes de reemplazar el catálogo.' };
  }
}
export function useAuditStore() {
  const [initial] = useState(load);
  const [products, setProducts] = useState<Product[]>(initial.products);
  const [error, setError] = useState(initial.error);
  const state = useRef({ products: initial.products, raw: initial.raw, blocked: Boolean(initial.error), dirty: false });
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      if (state.current.dirty) { state.current.blocked = true; setError('Otra pestaña cambió el inventario. Exporta tu conteo antes de recargar.'); return; }
      const next = load();
      state.current = { ...next, blocked: Boolean(next.error), dirty: false };
      setProducts(next.products); setError(next.error);
    };
    const leaving = (event: BeforeUnloadEvent) => { if (state.current.dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('storage', changed);
    window.addEventListener('beforeunload', leaving);
    return () => { window.removeEventListener('storage', changed); window.removeEventListener('beforeunload', leaving); };
  }, []);
  const commit = (next: Product[], replace = false) => {
    if (!validateProducts(next)) { setError('El conteo contiene datos inválidos o supera el límite permitido.'); return false; }
    try {
      const actual = localStorage.getItem(STORAGE_KEY);
      if (!replace && (state.current.blocked || actual !== state.current.raw)) {
        state.current.blocked = true;
        setError('El conteo guardado cambió o no es válido. Descarga un respaldo y recarga antes de continuar.');
        return false;
      }
      if (replace && state.current.blocked && actual) localStorage.setItem(`${STORAGE_KEY}_recovery`, actual);
      const raw = JSON.stringify(next);
      localStorage.setItem(STORAGE_KEY, raw);
      state.current = { products: next, raw, blocked: false, dirty: false };
      setProducts(next); setError(''); return true;
    } catch {
      state.current.products = next; state.current.dirty = true;
      setProducts(next); setError('No se pudo guardar en este navegador. Tu conteo está en memoria: exporta un respaldo antes de cerrar.');
      return true;
    }
  };
  const backup = () => {
    let text = JSON.stringify(state.current.products, null, 2);
    if (state.current.blocked && !state.current.dirty && state.current.raw) text = state.current.raw;
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'Respaldo_Auditor.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return { products, productsRef: state, error, commit, backup };
}
