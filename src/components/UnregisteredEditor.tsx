import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { Product } from '../types';
import { searchProducts } from '../services/productSearch';

/** Edición de un producto no encontrado: nombre y nota, vincularlo al catálogo o excluirlo del conteo (reversible). */
export function UnregisteredEditor({ product, products, onClose, onEdit, onExclude, onRestore, onLink }: {
  product: Product; products: Product[]; onClose: () => void;
  onEdit: (code: string, patch: { name?: string; note?: string }) => Promise<boolean>;
  onExclude: (code: string, reason: string) => Promise<boolean>;
  onRestore: (code: string) => Promise<boolean>;
  onLink: (code: string, target: string) => Promise<boolean>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(product.description), [note, setNote] = useState(product.note ?? '');
  const [reason, setReason] = useState(''), [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);
  const catalog = useMemo(() => products.filter(p => !p.isUnregistered), [products]);
  const matches = useMemo(() => query.trim().length >= 2 ? searchProducts(catalog, query, { limit: 6 }) : [], [catalog, query]);
  const run = async (action: () => Promise<boolean>, failure: string) => {
    if (busy) return;
    setBusy(true); setError('');
    try { if (await action()) onClose(); else setError(failure); }
    catch (cause) { setError(cause instanceof Error ? cause.message : failure); }
    finally { setBusy(false); }
  };
  const excluded = Boolean(product.excludedAt);
  return <dialog ref={dialog} className="pin-dialog unregistered-dialog" aria-labelledby="unregistered-title" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
    <div className="modal-heading"><h2 id="unregistered-title">Producto no encontrado</h2><button type="button" className="secondary" disabled={busy} aria-label="Cerrar" onClick={onClose}><X size={20} /></button></div>
    <p><code>{product.code}</code> · {product.physicalStock} piezas contadas{product.department ? ` · ${product.department}` : ''}</p>
    {excluded && <p className="message warning">Excluido del conteo{product.excludedReason ? `: ${product.excludedReason}` : ''}. Sus piezas no suman en el balance.</p>}
    {error && <p role="alert" className="message warning">{error}</p>}
    <fieldset className="workspace-fields pin-fields" disabled={busy}>
      {!excluded && <form className="pin-fields" onSubmit={e => { e.preventDefault(); void run(() => onEdit(product.code, { name, note }), 'No se guardaron los cambios.'); }}>
        <label>Nombre o descripción<input name="name" required maxLength={200} value={name} onChange={e => setName(e.target.value)} /></label>
        <label>Observación<input name="note" maxLength={1000} value={note} onChange={e => setNote(e.target.value)} placeholder="Ej. Anaquel 4, sin precio" /></label>
        <button className="primary">Guardar nombre y nota</button>
      </form>}
      {!excluded && <section className="unregistered-section" aria-labelledby="link-title">
        <h3 id="link-title">¿Ya sabes qué producto es?</h3>
        <p>Sus piezas se suman al producto del catálogo y este registro queda como traza.</p>
        <label>Buscar en el catálogo<input type="search" name="linkSearch" value={query} onChange={e => setQuery(e.target.value)} placeholder="Código o descripción" /></label>
        {matches.map(({ product: target }) => <button type="button" key={target.code} className="secondary link-option" onClick={() => {
          if (window.confirm(`¿Sumar ${product.physicalStock} piezas a “${target.description}” (${target.code})?`)) void run(() => onLink(product.code, target.code), 'No se pudo vincular.');
        }}><strong>{target.description}</strong><code>{target.code}</code></button>)}
      </section>}
      {excluded
        ? !product.linkedTo && <button type="button" className="primary" onClick={() => void run(() => onRestore(product.code), 'No se pudo reincorporar.')}>Reincorporar al conteo</button>
        : <form className="unregistered-section" onSubmit={e => { e.preventDefault(); void run(() => onExclude(product.code, reason), 'No se pudo excluir.'); }}>
          <h3>Excluir del conteo</h3>
          <p>No se borra: queda en el historial y puedes reincorporarlo.</p>
          <label>Motivo<input name="reason" required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} placeholder="Ej. Pertenece a otra tienda, lectura equivocada" /></label>
          <button className="secondary danger-outline">Excluir del conteo</button>
        </form>}
    </fieldset>
  </dialog>;
}
