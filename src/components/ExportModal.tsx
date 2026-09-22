import React, { useEffect, useRef, useState } from 'react';
import { Download, FileSpreadsheet, Printer, CheckCircle, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Product, AuditStats } from '../types';
import { exportAuditToEleventaExcel } from '../services/eleventaExporter';
import { soundService } from '../services/audioService';

import { isCounted, productStatus, roundQuantity } from '../services/auditState';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  stats: AuditStats;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  products,
  stats,
}) => {
  const [exportError, setExportError] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (isOpen && dialog && !dialog.open) dialog.showModal();
    if (!isOpen && dialog?.open) dialog.close();
  }, [isOpen]);

  const handleExportExcel = () => {
    try { exportAuditToEleventaExcel(products, stats); setExportError(''); }
    catch { setExportError('No se pudo generar el Excel. Intenta de nuevo o descarga un respaldo JSON.'); return; }
    soundService.playSuccessBeep();
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.7 },
      disableForReducedMotion: true,
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <dialog ref={dialogRef} aria-labelledby="export-title" onCancel={(event) => { event.preventDefault(); onClose(); }} className="export-dialog fixed inset-0 z-50 m-auto max-h-[90dvh] overflow-y-auto rounded-2xl border-0 bg-transparent p-4 text-slate-100">
      <div className="export-screen bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div id="export-title" className="flex items-center gap-2 text-white font-bold text-lg">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            Finalizar y Exportar Auditoría
          </div>
          <button
            aria-label="Cerrar exportación"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-slate-400">Total Productos:</span>
            <div className="text-sm font-bold text-white mt-0.5">{stats.totalCatalog}</div>
          </div>
          <div>
            <span className="text-slate-400">Piezas Físicas Contadas:</span>
            <div className="text-sm font-bold text-emerald-400 mt-0.5">{stats.totalPiecesPhysical}</div>
          </div>
          <div>
            <span className="text-slate-400">Pérdida por Merma:</span>
            <div className="text-sm font-bold text-red-400 mt-0.5">-${stats.missingCostValue.toFixed(2)}</div>
          </div>
          <div>
            <span className="text-slate-400">Productos Cuadrados:</span>
            <div className="text-sm font-bold text-teal-300 mt-0.5">{stats.matchCount}</div>
          </div>
        </div>

        <p className="text-sm text-amber-300">El ajuste incluye solo productos contados y registrados. Los nuevos aparecen en el reporte; confirma una cantidad de 0 para registrar un faltante total.</p>
        {exportError && <p role="alert" className="text-red-300">{exportError}</p>}
        <div className="flex flex-col gap-3">
          <button
            disabled={stats.auditedCount === 0}
            onClick={handleExportExcel}
            className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold rounded-xl shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Download className="w-5 h-5" />
            Descargar Excel para eleventa (.xlsx)
          </button>

          <button
            onClick={handlePrint}
            className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-400" />
            Imprimir Reporte Físico
          </button>
        </div>

        <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-3.5 text-xs text-emerald-200/90 space-y-1.5">
          <div className="font-semibold text-emerald-300 flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4" />
            ¿Cómo aplicar el ajuste en eleventa?
          </div>
          <p className="text-slate-300">
            1. Abre el Excel descargado y revisa las cantidades y diferencias.
          </p>
          <p className="text-slate-300">
            2. En tu versión de eleventa, identifica la opción para importar o ajustar inventario y revisa la correspondencia de columnas.
          </p>
          <p className="text-slate-300">
            3. Usa la hoja <strong className="text-white">Ajuste_Inventario_eleventa</strong> después de revisar los datos. Este programa no aplica cambios automáticamente en eleventa.
          </p>
        </div>
      </div>
      <section className="print-report"><h1>Auditoría de inventario eleventa</h1><p>{new Date().toLocaleString('es-MX')} · {stats.auditedCount} de {stats.totalCatalog} productos contados</p><p>Merma: ${stats.missingCostValue.toFixed(2)} · Sobrante: ${stats.surplusCostValue.toFixed(2)}</p>
        <table><thead><tr><th>Código</th><th>Producto</th><th>Teórico</th><th>Físico</th><th>Diferencia</th><th>Estado</th></tr></thead><tbody>{products.map(p => <tr key={p.code}><td>{p.code}</td><td>{p.description}</td><td>{p.theoreticalStock}</td><td>{isCounted(p) ? p.physicalStock : '—'}</td><td>{isCounted(p) && !p.isUnregistered ? roundQuantity(p.physicalStock - p.theoreticalStock) : '—'}</td><td>{{ missing: 'Faltante', surplus: 'Sobrante', match: 'Cuadrado', not_counted: 'Sin contar', unregistered: 'No registrado' }[productStatus(p)]}</td></tr>)}</tbody></table>
      </section>
    </dialog>
  );
};
