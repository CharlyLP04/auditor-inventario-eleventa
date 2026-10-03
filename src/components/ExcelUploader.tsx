import { useEffect, useRef, useState } from 'react';
import type { Product, ImportResult, ImportReport, ColumnMapping, ImportField } from '../types';
import { validateProducts } from '../services/auditState';
import { FIELD_LABELS, REQUIRED_FIELDS } from '../services/eleventaParser';
import { FileSpreadsheet, Upload, AlertTriangle, CheckCircle2 } from 'lucide-react';

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const FIELD_ORDER: ImportField[] = ['code', 'description', 'stock', 'price', 'cost', 'department', 'sku', 'wholesale', 'minimum', 'unit'];

export function ExcelUploader({
  onProductsLoaded,
  currentCount,
}: {
  onProductsLoaded: (products: Product[], report?: ImportReport) => void | Promise<void>;
  currentCount: number;
}) {
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [acceptIssues, setAcceptIssues] = useState(false);
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

  const parse = (buffer: ArrayBuffer, mapping?: Partial<ColumnMapping>) => new Promise<ImportResult>((resolve, reject) => {
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
    worker.postMessage({ buffer, mapping }, [buffer]);
  });

  const analyze = async (selected: File, mapping?: Partial<ColumnMapping>) => {
    setErrors([]);
    setBusy(true);
    try {
      const result = await parse(await selected.arrayBuffer(), mapping);
      if (!mounted.current) return;
      setPreview(result);
      setAcceptIssues(false);
      if (!result.report) setErrors(result.errors);
    } catch (error) {
      if (mounted.current) setErrors([error instanceof Error ? error.message : 'Archivo inválido.']);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const load = async (selected: File) => {
    setErrors([]); setPreview(null); setFile(null);
    if (selected.size > 10 * 1024 * 1024) {
      setErrors(['El archivo supera 10 MB. Divide el catálogo antes de cargarlo.']);
      return;
    }
    if (/\.json$/i.test(selected.name)) {
      setBusy(true);
      try {
        const saved: unknown = JSON.parse(await selected.text());
        if (!validateProducts(saved) || !saved.length) throw new Error('El respaldo no contiene un inventario válido.');
        if (currentCount && !window.confirm('¿Reemplazar el catálogo y los conteos actuales? Descarga un respaldo antes si necesitas conservarlos.')) return;
        await onProductsLoaded(saved);
      } catch (error) {
        if (mounted.current) setErrors([error instanceof Error ? error.message : 'Archivo inválido.']);
      } finally {
        if (mounted.current) setBusy(false);
      }
      return;
    }
    setFile(selected);
    await analyze(selected);
  };

  const remap = (field: ImportField, column: number) => {
    if (!file || !preview?.report) return;
    const mapping: Partial<ColumnMapping> = { ...preview.report.mapping };
    // Una columna solo puede representar un dato: si ya estaba asignada, se libera del campo anterior.
    for (const key of Object.keys(mapping) as ImportField[]) if (mapping[key] === column && key !== field) mapping[key] = -1;
    mapping[field] = column;
    void analyze(file, mapping);
  };

  const confirm = async () => {
    if (!preview || !file || !preview.products.length) return;
    if (preview.issues.length && !acceptIssues) return;
    if (currentCount && !window.confirm('¿Reemplazar el catálogo y los conteos actuales? Descarga un respaldo antes si necesitas conservarlos.')) return;
    setBusy(true);
    try {
      await onProductsLoaded(preview.products, { ...preview.report, fileName: file.name, importedAt: new Date().toISOString() });
      if (mounted.current) { setPreview(null); setFile(null); }
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const report = preview?.report;
  return (
    <section className="upload-panel animate-card-pop">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-2xl bg-[#B38F6F]/20 text-[#B38F6F] flex items-center justify-center border border-[#B38F6F]/30">
          <FileSpreadsheet size={22} />
        </div>
        <div>
          <h3>Catálogo eleventa POS</h3>
          <p className="text-xs text-[#a8a8a8] font-semibold m-0">Vista previa antes de importar · Excel, CSV o respaldo JSON</p>
        </div>
      </div>

      <p className="text-sm text-[#CCCCCC] mt-3">
        Importa el archivo exportado desde <strong>F3 Productos</strong> o <strong>F4 Inventario</strong> de eleventa. Antes de reemplazar el catálogo verás qué se importará y qué filas tienen problemas.
      </p>

      <label className="upload-target group cursor-pointer hover:border-[#FF6E42] transition-colors">
        <div className="w-14 h-14 rounded-full bg-[#161616] text-[#B38F6F] group-hover:text-[#FF6E42] flex items-center justify-center mx-auto border border-white/10 shadow-lg transition-transform group-hover:scale-105">
          <Upload size={26} strokeWidth={2.4} />
        </div>
        <span className="text-[#F2F1ED] font-black text-base group-hover:text-[#FF6E42] transition-colors">
          {busy ? 'Analizando catálogo…' : file ? `Cambiar archivo (${file.name})` : 'Seleccionar archivo de eleventa'}
        </span>
        <input
          aria-label="Seleccionar archivo de inventario"
          type="file"
          accept=".xlsx,.xls,.csv,.json"
          disabled={busy}
          className="sr-only"
          onChange={event => {
            const selected = event.target.files?.[0];
            event.target.value = '';
            if (selected) void load(selected);
          }}
        />
        <small className="text-[#a8a8a8] font-bold">
          Archivos compatibles: .xlsx, .xls, .csv o respaldo .json · Máx 10 MB / 20,000 productos
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
          <ul className="mt-2 space-y-1">{errors.map((error, i) => <li key={i}>{error}</li>)}</ul>
        </div>
      )}

      {preview && report && <div className="import-preview" aria-label="Vista previa de la importación">
        {preview.errors.length > 0 && <div className="message warning" role="alert"><ul>{preview.errors.map(e => <li key={e}>{e}</li>)}</ul></div>}
        <div className="import-summary">
          <div><span>Filas con datos</span><strong>{report.fileRows.toLocaleString('es-MX')}</strong></div>
          <div className="is-ok"><span>Se importarán</span><strong>{preview.products.length.toLocaleString('es-MX')}</strong></div>
          <div className={preview.issues.length ? 'is-bad' : ''}><span>Con problemas</span><strong>{preview.issues.length.toLocaleString('es-MX')}</strong></div>
        </div>

        <details className="import-mapping" open={preview.errors.length > 0 || report.warnings.length > 0}>
          <summary>Columnas detectadas · cámbialas si alguna no corresponde</summary>
          <div className="mapping-grid">
            {FIELD_ORDER.map(field => <label key={field}>{FIELD_LABELS[field]}{REQUIRED_FIELDS.includes(field) ? ' *' : ''}
              <select disabled={busy} value={report.mapping[field]} onChange={e => remap(field, Number(e.target.value))}>
                <option value={-1}>— Sin columna —</option>
                {report.headers.map((header, index) => <option key={index} value={index}>{header || `Columna ${index + 1}`}</option>)}
              </select>
            </label>)}
          </div>
        </details>

        {report.warnings.map(w => <p key={w} className="message warning" role="status"><AlertTriangle size={15} aria-hidden="true" /> {w}</p>)}
        {report.unusedColumns.length > 0 && <p className="message" role="status">Columnas que no se importarán: <strong>{report.unusedColumns.join(', ')}</strong>. Si contienen datos necesarios, asígnalas arriba.</p>}

        {preview.products.length > 0 && <div className="import-table-wrap"><table className="import-table">
          <caption>Primeros productos del archivo</caption>
          <thead><tr><th>Código</th><th>Descripción</th><th>Departamento</th><th>Existencia</th><th>Venta</th><th>Costo</th></tr></thead>
          <tbody>{preview.products.slice(0, 8).map(p => <tr key={p.code}><td><code>{p.code}</code></td><td>{p.description}</td><td>{p.department}</td><td>{p.theoreticalStock}</td><td>{money.format(p.price)}</td><td>{money.format(p.cost)}</td></tr>)}</tbody>
        </table></div>}

        {preview.issues.length > 0 && <div className="message warning">
          <p className="font-bold">Filas que no se importarán:</p>
          <ul className="import-issues">{preview.issues.slice(0, 50).map(issue => <li key={issue.row}>Fila {issue.row}{issue.code ? ` (${issue.code})` : ''}: {issue.reason}</li>)}</ul>
          {preview.issues.length > 50 && <p>…y {preview.issues.length - 50} filas más. Quedarán registradas en el balance.</p>}
          <label className="import-accept"><input type="checkbox" checked={acceptIssues} onChange={e => setAcceptIssues(e.target.checked)} /> Entiendo que se omitirán {preview.issues.length} filas y quiero importar las demás.</label>
        </div>}

        <div className="workspace-actions">
          <button className="primary" disabled={busy || !preview.products.length || (preview.issues.length > 0 && !acceptIssues)} onClick={() => { void confirm(); }}>
            <CheckCircle2 size={17} aria-hidden="true" /> Importar {preview.products.length.toLocaleString('es-MX')} productos
          </button>
          <button className="secondary" disabled={busy} onClick={() => { setPreview(null); setFile(null); }}>Cancelar</button>
        </div>
      </div>}

      <div className="message bg-[#161616] border border-white/10 p-4 rounded-2xl mt-4">
        <strong className="text-[#B38F6F] block text-xs font-black uppercase tracking-wider mb-1">
          Instrucciones de eleventa:
        </strong>
        <p className="text-xs text-[#a8a8a8] leading-relaxed">
          1. En tu computadora con eleventa ve a <strong>F3 Productos &gt; Exportar</strong>.<br />
          2. Sube ese archivo aquí y revisa la vista previa: columnas detectadas, filas con problemas y columnas que no se usarán.
        </p>
      </div>
    </section>
  );
}
