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
    try {
      exportAuditToEleventaExcel(products, stats);
      setExportError('');
    } catch {
      setExportError('No se pudo generar el Excel. Intenta de nuevo o descarga un respaldo JSON.');
      return;
    }
    soundService.playSuccessBeep();
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.7 },
      colors: ['#FF6E42', '#B38F6F', '#F2F1ED', '#710014', '#004E72'],
      disableForReducedMotion: true,
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="export-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      className="export-dialog fixed inset-0 z-50 m-auto max-h-[90dvh] overflow-y-auto rounded-[28px] border-0 bg-transparent p-4 text-[#F2F1ED]"
    >
      <div className="export-screen bg-[#1E1E1E] border border-white/10 rounded-[28px] max-w-lg w-full p-6 shadow-2xl flex flex-col gap-5 animate-card-pop">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div id="export-title" className="flex items-center gap-2.5 text-[#F2F1ED] font-extrabold text-lg">
            <div className="w-8 h-8 rounded-full bg-[#FF6E42]/20 text-[#FF6E42] flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            Finalizar y Exportar Auditoría
          </div>
          <button
            aria-label="Cerrar exportación"
            onClick={onClose}
            className="text-[#888888] hover:text-[#F2F1ED] p-2 rounded-full hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumen en Swatch Cards */}
        <div className="bg-[#161616] p-4 rounded-2xl border border-white/10 grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-[#888888] font-bold">Total Productos:</span>
            <div className="text-base font-black text-[#F2F1ED] mt-0.5">{stats.totalCatalog}</div>
          </div>
          <div>
            <span className="text-[#888888] font-bold">Piezas Contadas:</span>
            <div className="text-base font-black text-[#FF6E42] mt-0.5">{stats.totalPiecesPhysical}</div>
          </div>
          <div>
            <span className="text-[#888888] font-bold">Pérdida por Merma:</span>
            <div className="text-base font-black text-[#ff8a9e] mt-0.5">-${stats.missingCostValue.toFixed(2)}</div>
          </div>
          <div>
            <span className="text-[#888888] font-bold">Productos Cuadrados:</span>
            <div className="text-base font-black text-[#B38F6F] mt-0.5">{stats.matchCount}</div>
          </div>
        </div>

        <p className="text-xs text-[#B38F6F] font-semibold leading-relaxed">
          El archivo Excel generado contiene el formato exacto requerido por el módulo de <strong>Ajustes de Inventario</strong> de eleventa.
        </p>

        {exportError && <p role="alert" className="text-xs text-[#FF6E42] font-bold">{exportError}</p>}

        <div className="flex flex-col gap-3">
          <button
            disabled={stats.auditedCount === 0}
            onClick={handleExportExcel}
            className="w-full py-4 px-6 bg-[#FF6E42] hover:bg-[#ff8560] active:scale-[0.98] text-[#161616] font-black rounded-full shadow-xl shadow-[#FF6E42]/25 flex items-center justify-center gap-2 transition-all cursor-pointer text-sm uppercase tracking-wider"
          >
            <Download className="w-5 h-5 stroke-[2.5]" />
            Descargar Excel para eleventa (.xlsx)
          </button>

          <button
            onClick={handlePrint}
            className="w-full py-3.5 px-6 bg-[#262626] hover:bg-[#303030] text-[#F2F1ED] text-xs font-bold rounded-full border border-white/10 flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-[#888888]" />
            Imprimir Reporte Físico
          </button>
        </div>

        <div className="bg-[#161616] border border-white/10 rounded-2xl p-4 text-xs text-[#CCCCCC] space-y-2">
          <div className="font-bold text-[#B38F6F] flex items-center gap-2 uppercase tracking-wider text-[11px]">
            <CheckCircle className="w-4 h-4 text-[#FF6E42]" />
            ¿Cómo aplicar el ajuste en eleventa?
          </div>
          <p className="text-[#888888] leading-relaxed">
            1. Abre el Excel descargado y valida las mermas.<br />
            2. En eleventa, ve a <strong>F4 Inventario &gt; Ajustes</strong> (o <strong>F3 Productos &gt; Importar</strong>).<br />
            3. Selecciona la hoja <strong>Ajuste_Inventario_eleventa</strong> para actualizar tus existencias físicas.
          </p>
        </div>
      </div>

      <section className="print-report">
        <h1>Auditoría de inventario eleventa</h1>
        <p>{new Date().toLocaleString('es-MX')} · {stats.auditedCount} de {stats.totalCatalog} productos contados</p>
        <p>Merma: ${stats.missingCostValue.toFixed(2)} · Sobrante: ${stats.surplusCostValue.toFixed(2)}</p>
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Producto</th>
              <th>Teórico</th>
              <th>Físico</th>
              <th>Diferencia</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.code}>
                <td>{p.code}</td>
                <td>{p.description}</td>
                <td>{p.theoreticalStock}</td>
                <td>{isCounted(p) ? p.physicalStock : '—'}</td>
                <td>{isCounted(p) && !p.isUnregistered ? roundQuantity(p.physicalStock - p.theoreticalStock) : '—'}</td>
                <td>
                  {{
                    missing: 'Faltante',
                    surplus: 'Sobrante',
                    match: 'Cuadrado',
                    not_counted: 'Sin contar',
                    unregistered: 'No registrado',
                  }[productStatus(p)]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </dialog>
  );
};
