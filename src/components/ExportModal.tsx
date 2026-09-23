import React, { useEffect, useRef, useState } from 'react';
import { Download, FileSpreadsheet, Printer, CheckCircle, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Product, AuditStats, Company, AuditRecord, AuditorProfile } from '../types';
import { exportAuditToEleventaExcel, exportEleventaAdjustment } from '../services/eleventaExporter';
import { startDownload, releaseDownload } from '../services/fileDownload';
import type { PreparedDownload } from '../services/fileDownload';
import { soundService } from '../services/audioService';
import { isCounted, productStatus, roundQuantity } from '../services/auditState';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  stats: AuditStats;
  company?: Company;
  audit?: AuditRecord;
  profile?: AuditorProfile;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  products,
  stats, company, audit, profile,
}) => {
  const [exportError, setExportError] = useState('');
  const [download, setDownload] = useState<PreparedDownload | null>(null);
  const downloadRef = useRef<PreparedDownload | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const adjustmentProducts = products.filter(p => isCounted(p) && !p.isUnregistered);

  useEffect(() => () => {
    if (downloadRef.current) releaseDownload(downloadRef.current);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (isOpen && dialog && !dialog.open) dialog.showModal();
    if (!isOpen && dialog?.open) dialog.close();
  }, [isOpen]);

  const handleExportExcel = (kind: 'report' | 'adjustment') => {
    try {
      const next = kind === 'adjustment'
        ? exportEleventaAdjustment(products)
        : exportAuditToEleventaExcel(products, stats, { company, audit, profile });
      if (downloadRef.current) releaseDownload(downloadRef.current);
      downloadRef.current = next;
      setDownload(next);
      setExportError('');
      try { startDownload(next); }
      catch { setExportError('El navegador no inició la descarga. Usa el enlace Guardar archivo que aparece abajo.'); }
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'No se pudo generar el Excel. Descarga un respaldo JSON para conservar tu conteo.');
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
          El reporte incluye todo el catálogo, aunque haya productos pendientes. El ajuste contiene únicamente los {adjustmentProducts.length} productos registrados con conteo confirmado y conserva las columnas disponibles del archivo original.
        </p>

        {exportError && <p role="alert" className="text-xs text-[#FF6E42] font-bold">{exportError}</p>}
        {download && (
          <div className="text-xs text-[#CCCCCC] break-words" role="status">
            Archivo preparado. Si no comenzó la descarga, usa este enlace:
            <a href={download.url} download={download.fileName} className="download-link">Guardar archivo: {download.fileName}</a>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            disabled={products.length === 0}
            onClick={() => handleExportExcel('report')}
            className="w-full py-4 px-6 bg-[#FF6E42] hover:bg-[#ff8560] active:scale-[0.98] text-[#161616] font-black rounded-full shadow-xl shadow-[#FF6E42]/25 flex items-center justify-center gap-2 transition-all cursor-pointer text-sm uppercase tracking-wider"
          >
            <Download className="w-5 h-5 stroke-[2.5]" />
            Descargar reporte completo (.xlsx)
          </button>

          <button
            disabled={adjustmentProducts.length === 0}
            onClick={() => handleExportExcel('adjustment')}
            className="w-full py-3.5 px-6 bg-[#262626] hover:bg-[#303030] text-[#F2F1ED] text-xs font-bold rounded-full border border-white/10 flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Descargar ajuste de inventario (.xlsx)
          </button>
          {adjustmentProducts.length === 0 && <p className="text-xs text-[#CCCCCC]">Para generar un ajuste, confirma la cantidad de al menos un producto del catálogo. Un cero confirmado registra un faltante total.</p>}
          {adjustmentProducts.some(p => p.wholesalePrice === undefined || p.minStock === undefined) && <p className="text-xs text-[#CCCCCC]">Este conteo no conserva todos los valores de mayoreo o mínimo. Las columnas incompletas se omiten del ajuste para no reemplazarlas por ceros.</p>}

          <button
            onClick={handlePrint}
            className="w-full py-3.5 px-6 bg-[#262626] hover:bg-[#303030] text-[#F2F1ED] text-xs font-bold rounded-full border border-white/10 flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-[#888888]" />
            Imprimir dictamen / Guardar como PDF
          </button>
        </div>

        <div className="bg-[#161616] border border-white/10 rounded-2xl p-4 text-xs text-[#CCCCCC] space-y-2">
          <div className="font-bold text-[#B38F6F] flex items-center gap-2 uppercase tracking-wider text-[11px]">
            <CheckCircle className="w-4 h-4 text-[#FF6E42]" />
            ¿Cómo aplicar el ajuste en eleventa?
          </div>
          <p className="text-[#888888] leading-relaxed">
            1. Descarga el ajuste y revisa las cantidades confirmadas.<br />
            2. Revisa la correspondencia de columnas en la opción de importación o ajuste de tu versión de eleventa.<br />
            3. Usa el archivo <strong>Ajuste_Inventario_eleventa</strong>, que contiene una sola hoja. Este programa no modifica automáticamente la base de datos de eleventa.
          </p>
        </div>
      </div>

      <section className="print-report">
        {profile?.logo && <img className="report-logo" src={profile.logo} alt="Logotipo del servicio" />}
        <h2>{profile?.serviceName || 'Servicio de auditoría de inventarios'}</h2>
        <p className="preserve-lines">{profile?.letterhead}</p>
        <h2>Dictamen ejecutivo · {company?.name || 'Empresa'}</h2>
        <p>{company?.address} · Contacto: {company?.contactName} · {company?.phone}</p>
        <p>Periodo: {audit?.period} · Auditor: {profile?.auditorName || '________________'}</p>
        <p>Estado: {audit?.status === 'in_progress' ? 'En curso / resultados provisionales' : audit?.status === 'completed' ? 'Completada' : 'Cerrada'}. Pendientes: {stats.notCountedCount}. Códigos no registrados: {stats.unregisteredCount}.</p>
        <h3>Hallazgos</h3><p className="preserve-lines">{audit?.notes || 'Sin observaciones capturadas.'}</p>
        <p>Merma a precio de venta: ${stats.missingSaleValue.toFixed(2)} · Sobrante a precio de venta: ${stats.surplusSaleValue.toFixed(2)}.</p>
        <p>Los productos pendientes no se consideran faltantes. La valoración PVP utiliza precios de venta; la valoración al costo excluye monetariamente los artículos sin costo capturado.</p>
        <h3>Principales mermas a precio de venta</h3>
        <ol>{products.filter(p => productStatus(p) === 'missing').sort((a, b) => (b.theoreticalStock - b.physicalStock) * b.price - (a.theoreticalStock - a.physicalStock) * a.price).slice(0, 10).map(p => <li key={p.code}>{p.code} · {p.description} · {roundQuantity(p.theoreticalStock - p.physicalStock)} piezas · ${((p.theoreticalStock - p.physicalStock) * p.price).toFixed(2)}</li>)}</ol>
        <div className="report-signatures"><p>____________________________<br />Auditor: {profile?.auditorName}</p><p>____________________________<br />Conformidad del cliente: {company?.contactName}</p></div>
        <h1>Auditoría de inventario eleventa</h1>
        <p>{new Date().toLocaleString('es-MX')} · {stats.auditedCount} de {stats.totalCatalog} productos contados</p>
        <p>Merma al costo: ${stats.missingCostValue.toFixed(2)} · Sobrante al costo: ${stats.surplusCostValue.toFixed(2)}</p>
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
