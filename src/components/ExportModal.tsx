import React, { useEffect, useRef } from 'react';
import { Download, FileSpreadsheet, Printer, CheckCircle, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Product, AuditStats } from '../types';
import { exportAuditToEleventaExcel } from '../services/eleventaExporter';
import { soundService } from '../services/audioService';

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
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (isOpen && dialog && !dialog.open) dialog.showModal();
    if (!isOpen && dialog?.open) dialog.close();
  }, [isOpen]);

  const handleExportExcel = () => {
    soundService.playSuccessBeep();
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.7 },
      disableForReducedMotion: true,
    });
    exportAuditToEleventaExcel(products, stats);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <dialog ref={dialogRef} aria-labelledby="export-title" onCancel={(event) => { event.preventDefault(); onClose(); }} className="export-dialog fixed inset-0 z-50 m-auto max-h-[90dvh] overflow-y-auto rounded-2xl border-0 bg-transparent p-4 text-slate-100">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-5">
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

        <p className="text-sm text-amber-300">El ajuste incluye solo productos contados; confirma una cantidad de 0 para registrar un faltante total.</p>
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
            1. Abre el archivo descargado en tu computadora con eleventa.
          </p>
          <p className="text-slate-300">
            2. En eleventa ve a <strong className="text-white">F3 Productos &gt; Importar</strong> (o <strong className="text-white">F4 Inventario &gt; Ajustes</strong>).
          </p>
          <p className="text-slate-300">
            3. Selecciona la hoja <strong className="text-white">Ajuste_Inventario_eleventa</strong> y confirma.
          </p>
        </div>
      </div>
    </dialog>
  );
};
