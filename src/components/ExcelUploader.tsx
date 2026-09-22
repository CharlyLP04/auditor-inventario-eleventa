import { useEffect, useRef, useState } from 'react';
import type { Product } from '../types';
import { validateProducts } from '../services/auditState';
import { Sparkles, FileSpreadsheet, Upload } from 'lucide-react';

export function ExcelUploader({
  onProductsLoaded,
  currentCount,
}: {
  onProductsLoaded: (products: Product[]) => void;
  currentCount: number;
}) {
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const workerRef = useRef<Worker | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelRef.current?.();
      workerRef.current?.terminate();
    };
  }, []);

  const load = async (file: File) => {
    setErrors([]);
    if (file.size > 10 * 1024 * 1024) {
      setErrors(['El archivo supera 10 MB. Divide el catálogo antes de cargarlo.']);
      return;
    }
    setBusy(true);
    try {
      let products: Product[];
      if (/\.json$/i.test(file.name)) {
        const saved: unknown = JSON.parse(await file.text());
        if (!validateProducts(saved) || !saved.length) {
          throw new Error('El respaldo no contiene un inventario válido.');
        }
        products = saved;
      } else {
        const buffer = await file.arrayBuffer();
        if (!mounted.current) return;
        const result = await new Promise<{ products: Product[]; errors: string[] }>((resolve, reject) => {
          const worker = new Worker(new URL('../services/importWorker.ts', import.meta.url), { type: 'module' });
          workerRef.current = worker;
          const cleanup = () => {
            clearTimeout(timeout);
            worker.terminate();
            workerRef.current = null;
            cancelRef.current = null;
          };
          const timeout = setTimeout(() => {
            cleanup();
            reject(new Error('La lectura tardó más de 30 segundos. Divide el archivo e intenta de nuevo.'));
          }, 30000);
          cancelRef.current = () => {
            cleanup();
            reject(new Error('Lectura cancelada.'));
          };
          worker.onmessage = event => {
            cleanup();
            resolve(event.data);
          };
          worker.onerror = () => {
            cleanup();
            reject(new Error('No se pudo leer el archivo. Revisa su formato.'));
          };
          worker.postMessage(buffer, [buffer]);
        });
        if (result.errors.length) {
          if (mounted.current) setErrors(result.errors);
          return;
        }
        products = result.products;
      }
      if (!mounted.current) return;
      if (currentCount && !window.confirm('¿Reemplazar el catálogo y los conteos actuales? Descarga un respaldo antes si necesitas conservarlos.')) return;
      onProductsLoaded(products);
    } catch (error) {
      if (mounted.current) setErrors([error instanceof Error ? error.message : 'Archivo inválido.']);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <section className="upload-panel animate-card-pop">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-2xl bg-[#B38F6F]/20 text-[#B38F6F] flex items-center justify-center border border-[#B38F6F]/30">
          <FileSpreadsheet size={22} />
        </div>
        <div>
          <h3>Catálogo eleventa POS</h3>
          <p className="text-xs text-[#888888] font-semibold m-0">Importación local de Excel o respaldo JSON</p>
        </div>
      </div>

      <p className="text-sm text-[#CCCCCC] mt-3">
        Importa el archivo exportado desde <strong>F3 Productos</strong> o <strong>F4 Inventario</strong> de eleventa para iniciar el conteo físico en tus pasillos.
      </p>

      {/* Zona de Arrastre / Carga con estilo Swatch */}
      <label className="upload-target group cursor-pointer hover:border-[#FF6E42] transition-colors">
        <div className="w-14 h-14 rounded-full bg-[#161616] text-[#B38F6F] group-hover:text-[#FF6E42] flex items-center justify-center mx-auto border border-white/10 shadow-lg transition-transform group-hover:scale-105">
          <Upload size={26} strokeWidth={2.4} />
        </div>
        <span className="text-[#F2F1ED] font-black text-base group-hover:text-[#FF6E42] transition-colors">
          {busy ? 'Analizando catálogo…' : 'Seleccionar archivo de eleventa'}
        </span>
        <input
          aria-label="Seleccionar archivo de inventario"
          type="file"
          accept=".xlsx,.xls,.csv,.json"
          disabled={busy}
          className="sr-only"
          onChange={event => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void load(file);
          }}
        />
        <small className="text-[#888888] font-bold">
          Archivos compatibles: .xlsx, .xls, .csv o respaldo .json · Máx 10 MB
        </small>
      </label>

      {busy && (
        <div role="status" className="p-4 bg-[#262626] rounded-2xl border border-white/10 text-center text-sm font-bold text-[#FF6E42] animate-pulse">
          Procesando catálogo en segundo plano…
        </div>
      )}

      {!!errors.length && (
        <div className="message warning" role="alert">
          <p className="font-bold text-[#FF6E42]">No se pudo cargar el archivo:</p>
          <ul className="mt-2 space-y-1">
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="message bg-[#161616] border border-white/10 p-4 rounded-2xl mt-4">
        <strong className="text-[#B38F6F] block text-xs font-black uppercase tracking-wider mb-1">
          Instrucciones de eleventa:
        </strong>
        <p className="text-xs text-[#888888] leading-relaxed">
          1. En tu computadora con eleventa ve a <strong>F3 Productos &gt; Exportar</strong>.<br />
          2. Sube ese archivo aquí. El sistema detecta automáticamente las columnas de Código, Descripción y Existencias.
        </p>
      </div>

      <div className="pt-4 border-t border-white/10 mt-6 flex justify-center">
        <button
          className="secondary px-6 py-3 rounded-full flex items-center gap-2 cursor-pointer font-bold"
          disabled={busy}
          onClick={async () => {
            if (currentCount && !window.confirm('¿Reemplazar el conteo actual con datos de demostración?')) return;
            const { getDemoEleventaProducts } = await import('../services/eleventaParser');
            if (mounted.current) onProductsLoaded(getDemoEleventaProducts());
          }}
        >
          <Sparkles size={16} className="text-[#FF6E42]" />
          <span>Cargar Catálogo de Prueba (Demo)</span>
        </button>
      </div>
    </section>
  );
}
