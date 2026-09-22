import { useEffect, useRef, useState } from 'react';
import type { Product } from '../types';
import { validateProducts } from '../services/auditState';
export function ExcelUploader({ onProductsLoaded, currentCount }: { onProductsLoaded: (products: Product[]) => void; currentCount: number }) {
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const workerRef = useRef<Worker | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; cancelRef.current?.(); workerRef.current?.terminate(); }; }, []);
  const load = async (file: File) => {
    setErrors([]);
    if (file.size > 10 * 1024 * 1024) { setErrors(['El archivo supera 10 MB. Divide el catálogo antes de cargarlo.']); return; }
    setBusy(true);
    try {
      let products: Product[];
      if (/\.json$/i.test(file.name)) {
        const saved: unknown = JSON.parse(await file.text());
        if (!validateProducts(saved) || !saved.length) throw new Error('El respaldo no contiene un inventario válido.');
        products = saved;
      } else {
        const buffer = await file.arrayBuffer();
        if (!mounted.current) return;
        const result = await new Promise<{ products: Product[]; errors: string[] }>((resolve, reject) => {
          const worker = new Worker(new URL('../services/importWorker.ts', import.meta.url), { type: 'module' });
          workerRef.current = worker;
          const cleanup = () => { clearTimeout(timeout); worker.terminate(); workerRef.current = null; cancelRef.current = null; };
          const timeout = setTimeout(() => { cleanup(); reject(new Error('La lectura tardó más de 30 segundos. Divide el archivo e intenta de nuevo.')); }, 30000);
          cancelRef.current = () => { cleanup(); reject(new Error('Lectura cancelada.')); };
          worker.onmessage = event => { cleanup(); resolve(event.data); };
          worker.onerror = () => { cleanup(); reject(new Error('No se pudo leer el archivo. Revisa su formato.')); };
          worker.postMessage(buffer, [buffer]);
        });
        if (result.errors.length) { if (mounted.current) setErrors(result.errors); return; }
        products = result.products;
      }
      if (!mounted.current) return;
      if (currentCount && !window.confirm('¿Reemplazar el catálogo y los conteos actuales? Descarga un respaldo antes si necesitas conservarlos.')) return;
      onProductsLoaded(products);
    } catch (error) { if (mounted.current) setErrors([error instanceof Error ? error.message : 'Archivo inválido.']); }
    finally { if (mounted.current) setBusy(false); }
  };
  return <section className="upload-panel">
    <h3>Tu inventario, en este dispositivo</h3><p>Importa el Excel de eleventa para comenzar, o restaura un respaldo JSON para continuar un conteo.</p>
    <label className="upload-target"><span>{busy ? 'Leyendo archivo…' : 'Seleccionar archivo'}</span><input aria-label="Seleccionar archivo de inventario" type="file" accept=".xlsx,.xls,.csv,.json" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void load(file); }} /><small>Excel, CSV o respaldo JSON · Máximo 10 MB / 20,000 productos</small></label>
    {busy && <p role="status">Procesando en segundo plano…</p>}
    {!!errors.length && <div className="message warning" role="alert"><p>No se reemplazó tu inventario:</p><ul>{errors.map((error, i) => <li key={i}>{error}</li>)}</ul></div>}
    <div className="message"><strong>Antes de importar</strong><p>El archivo debe incluir Código, Descripción y Existencia. Guarda códigos largos o con ceros iniciales como texto. Revisa las existencias exportadas desde eleventa.</p></div>
    <button className="secondary" disabled={busy} onClick={async () => {
      if (currentCount && !window.confirm('¿Reemplazar el conteo actual con datos de demostración?')) return;
      const { getDemoEleventaProducts } = await import('../services/eleventaParser');
      if (mounted.current) onProductsLoaded(getDemoEleventaProducts());
    }}>Cargar catálogo de demostración</button>
  </section>;
}
