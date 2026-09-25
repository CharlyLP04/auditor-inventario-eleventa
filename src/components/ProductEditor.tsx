import { useEffect, useRef, useState } from 'react';
import type { Product } from '../types';
import { validQuantity } from '../services/auditState';
export function ProductEditor({ product, departments, isAdmin, onSave, onClose }: {
  product: Product; departments: string[]; isAdmin: boolean;
  onSave: (code: string, patch: Partial<Pick<Product, 'department' | 'cost' | 'price'>>) => Promise<boolean>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="pin-dialog" aria-labelledby="product-editor-title" onCancel={e => { e.preventDefault(); if (!submitting.current) onClose(); }}><form onSubmit={async e => {
    e.preventDefault(); if (submitting.current) return;
    const data = new FormData(e.currentTarget), department = String(data.get('department') ?? '').trim();
    const patch: Partial<Pick<Product, 'department' | 'cost' | 'price'>> = { department };
    if (isAdmin) { patch.cost = Number(data.get('cost')); patch.price = Number(data.get('price')); }
    if (!department || department.length > 200 || (isAdmin && (!validQuantity(patch.cost!) || !validQuantity(patch.price!)))) { setError('Revisa departamento, costo y precio.'); return; }
    submitting.current = true; setBusy(true);
    try { if (await onSave(product.code, patch)) onClose(); else setError('No se guardaron los cambios. Revisa el aviso de la auditoría.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar.'); }
    finally { submitting.current = false; setBusy(false); }
  }}><h2 id="product-editor-title">Editar producto</h2><p>{product.description} · {product.code}</p><fieldset className="workspace-fields pin-fields" disabled={busy}>
    <label>Departamento<input autoFocus name="department" required maxLength={200} defaultValue={product.department} list="product-departments" /></label><datalist id="product-departments">{departments.map(d => <option key={d} value={d} />)}</datalist>
    {isAdmin && <><label>Costo unitario<input name="cost" type="number" min="0" max="1000000000" step="any" required defaultValue={product.cost} /></label><label>Precio de venta<input name="price" type="number" min="0" max="1000000000" step="any" required defaultValue={product.price} /></label></>}
    {error && <p role="alert">{error}</p>}<button className="primary">Guardar producto</button><button type="button" className="secondary" onClick={onClose}>Cancelar</button>
  </fieldset></form></dialog>;
}
