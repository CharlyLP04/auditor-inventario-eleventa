import { useEffect, useRef, useState } from 'react';
import { Check, X, Delete } from 'lucide-react';
import type { Product, CountMode } from '../types';
import { roundQuantity, validQuantity } from '../services/auditState';
const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
export function QuantityKeypadModal({ code, product, initialMode = 'set', initialValue = '', onClose, onSave }: {
  code: string; product?: Product; initialMode?: CountMode; initialValue?: string;
  onClose: () => void; onSave: (quantity: number, mode: CountMode) => Promise<boolean>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<CountMode>(initialMode);
  const [value, setValue] = useState(initialValue), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const quantity = value.trim() ? Number(value) : NaN;
  const total = roundQuantity(mode === 'set' ? quantity : (product?.physicalStock ?? 0) + quantity);
  const valid = validQuantity(quantity) && validQuantity(total) && (mode === 'set' || quantity > 0);
  return <dialog ref={dialog} className="quantity-dialog" aria-labelledby="quantity-title" onCancel={e => { e.preventDefault(); if (!submitting.current) onClose(); }}>
    <form onSubmit={async e => {
      e.preventDefault(); if (submitting.current) return;
      if (!valid) { setError('Ingresa una cantidad válida. Para confirmar cero utiliza Fijar total.'); return; }
      submitting.current = true; setBusy(true); setError('');
      try { if (await onSave(quantity, mode)) onClose(); else setError('No se guardó. Tu cantidad permanece aquí; revisa el aviso y vuelve a intentar.'); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar.'); }
      finally { submitting.current = false; setBusy(false); }
    }}>
      <div className="modal-heading"><div><span className="eyebrow">CONTEO ASISTIDO</span><h2 id="quantity-title">¿Cuántos encontraste?</h2></div><button className="secondary" type="button" disabled={busy} aria-label="Cancelar cantidad" onClick={onClose}><X size={20} /></button></div>
      <div className="quantity-product"><strong>{product?.description ?? 'Producto no registrado en eleventa'}</strong><code>{code}</code><p>Venta: {money.format(product?.price ?? 0)} · eleventa: {product?.theoreticalStock ?? 0} · Contado: {product?.physicalStock ?? 0}</p></div>
      <fieldset className="workspace-fields" disabled={busy}>
        <div className="quantity-modes"><button type="button" aria-pressed={mode === 'set'} onClick={() => setMode('set')}>Fijar total físico</button><button type="button" aria-pressed={mode === 'add'} onClick={() => setMode('add')}>Sumar al conteo</button></div>
        <label className="keypad-value">{mode === 'set' ? 'Total físico' : 'Piezas a sumar'}<input aria-label="Cantidad encontrada" type="text" inputMode="decimal" autoFocus autoComplete="off" maxLength={20} value={value} onChange={e => { if (/^\d*(?:[.,]\d{0,6})?$/.test(e.target.value)) setValue(e.target.value.replace(',', '.')); }} /></label>
        <div className="pack-shortcuts">{[1,6,12,24,50].map(n => <button type="button" key={n} onClick={() => setValue(String(roundQuantity((Number(value) || 0) + n)))}>+{n}</button>)}</div>
        <div className="quantity-keypad">{['1','2','3','4','5','6','7','8','9','C','0','⌫'].map(key => <button type="button" key={key} aria-label={key === 'C' ? 'Borrar cantidad' : key === '⌫' ? 'Borrar último dígito' : key} onClick={() => setValue(current => key === 'C' ? '' : key === '⌫' ? current.slice(0,-1) : current.length < 20 ? current + key : current)}>{key === '⌫' ? <Delete size={25} aria-hidden="true" /> : key}</button>)}</div>
        <button type="button" className="decimal-key" onClick={() => setValue(current => current.includes('.') ? current : `${current || '0'}.`)}>Punto decimal ·</button>
        <p className="quantity-preview">{valid ? `Quedarán ${total.toLocaleString('es-MX', { maximumFractionDigits: 6 })} piezas contadas` : 'Escribe la cantidad física'}</p>
        {error && <p role="alert" className="message warning">{error}</p>}
        <button className="primary keypad-save" disabled={busy || !valid}><Check size={23} aria-hidden="true" />{busy ? 'Guardando…' : 'Guardar conteo'}</button>
      </fieldset>
    </form>
  </dialog>;
}
