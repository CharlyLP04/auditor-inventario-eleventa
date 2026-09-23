import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  Printer,
  CheckCircle,
  X,
  Eye,
  ShieldCheck,
  FileText,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
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
  stats,
  company,
  audit,
  profile,
}) => {
  const [activeTab, setActiveTab] = useState<'options' | 'preview'>('options');
  const [showAllInPreview, setShowAllInPreview] = useState(false);
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
    if (isOpen && dialog && !dialog.open) {
      dialog.showModal();
      setActiveTab('options');
      setShowAllInPreview(false);
    }
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

  const topLosses = products
    .filter(p => productStatus(p) === 'missing')
    .sort((a, b) => (b.theoreticalStock - b.physicalStock) * b.price - (a.theoreticalStock - a.physicalStock) * a.price)
    .slice(0, 10);

  const renderDocumentContent = (isForScreenPreview: boolean) => {
    const displayProducts = isForScreenPreview && !showAllInPreview && products.length > 50
      ? products.slice(0, 50)
      : products;

    return (
      <div className="dictamen-paper">
        {/* Barra superior de acento corporativo */}
        <div className="dictamen-accent-bar" />

        {/* Encabezado ejecutivo */}
        <header className="dictamen-header">
          <div className="dictamen-brand-section">
            {profile?.logo ? (
              <img className="dictamen-service-logo" src={profile.logo} alt="Logotipo auditor" />
            ) : (
              <div className="dictamen-service-badge" aria-hidden="true">
                <ShieldCheck size={28} />
              </div>
            )}
            <div>
              <h2 className="dictamen-service-name">
                {profile?.serviceName || 'SERVICIO PROFESIONAL DE AUDITORÍA DE INVENTARIOS'}
              </h2>
              <p className="dictamen-letterhead preserve-lines">
                {profile?.letterhead || 'Control de Inventarios Físicos · Conciliación Oficial eleventa'}
              </p>
            </div>
          </div>

          <div className="dictamen-meta-section">
            <div className="dictamen-meta-pill">
              <span className="dictamen-meta-label">FOLIO / PERIODO</span>
              <span className="dictamen-meta-val">{audit?.period || 'Actual'}</span>
            </div>
            <div className="dictamen-meta-pill">
              <span className="dictamen-meta-label">FECHA DE EMISIÓN</span>
              <span className="dictamen-meta-val">
                {new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <div className={`dictamen-status-tag status-${audit?.status || 'in_progress'}`}>
              {audit?.status === 'in_progress'
                ? 'EN CURSO · PRELIMINAR'
                : audit?.status === 'completed'
                ? 'AUDITORÍA COMPLETADA'
                : 'AUDITORÍA CERRADA'}
            </div>
          </div>
        </header>

        {/* Bloque de Título Principal */}
        <div className="dictamen-title-block">
          <h1 className="dictamen-main-title">DICTAMEN EJECUTIVO DE AUDITORÍA FÍSICA</h1>
          <p className="dictamen-subtitle">
            Informe Oficial de Discrepancias, Conciliación de Catálogo y Dictamen de Ajuste Contable para eleventa
          </p>
        </div>

        {/* Ficha de la Empresa / Cliente Auditado */}
        <section className="dictamen-client-card">
          <div className="client-card-col">
            <div className="client-data-row">
              <span className="client-label">EMPRESA AUDITADA:</span>
              <strong className="client-value">{company?.name || 'Empresa No Especificada'}</strong>
            </div>
            <div className="client-data-row">
              <span className="client-label">DIRECCIÓN FISCAL / SUCURSAL:</span>
              <span className="client-value">{company?.address || 'No registrada'}</span>
            </div>
          </div>
          <div className="client-card-col">
            <div className="client-data-row">
              <span className="client-label">CONTACTO / RESPONSABLE:</span>
              <strong className="client-value">
                {company?.contactName || 'No registrado'} {company?.phone ? `(Tel: ${company.phone})` : ''}
              </strong>
            </div>
            <div className="client-data-row">
              <span className="client-label">AUDITOR RESPONSABLE:</span>
              <span className="client-value">{profile?.auditorName || 'Auditor Asignado'}</span>
            </div>
          </div>
        </section>

        {/* Resumen Ejecutivo en 4 Tarjetas Métricas */}
        <section className="dictamen-kpis">
          <div className="dictamen-kpi-card kpi-coverage">
            <span className="kpi-label">COBERTURA DEL CATÁLOGO</span>
            <strong className="kpi-number">
              {Math.round((stats.auditedCount / (stats.totalCatalog || 1)) * 100)}%
            </strong>
            <span className="kpi-sub">
              {stats.auditedCount} de {stats.totalCatalog} productos auditados
            </span>
            <span className="kpi-sub-minor">
              {stats.notCountedCount} sin contar · {stats.unregisteredCount} códigos no registrados
            </span>
          </div>

          <div className="dictamen-kpi-card kpi-loss">
            <span className="kpi-label">PÉRDIDA TOTAL POR MERMA</span>
            <strong className="kpi-number">
              -${stats.missingCostValue.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
            <span className="kpi-sub">Al costo de adquisición</span>
            <span className="kpi-sub-minor">
              ${stats.missingSaleValue.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} a precio venta ({stats.totalMissingPieces} piezas)
            </span>
          </div>

          <div className="dictamen-kpi-card kpi-surplus">
            <span className="kpi-label">SOBRANTE REGISTRADO</span>
            <strong className="kpi-number">
              +${stats.surplusCostValue.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
            <span className="kpi-sub">Al costo de adquisición</span>
            <span className="kpi-sub-minor">
              ${stats.surplusSaleValue.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} a precio venta ({stats.totalSurplusPieces} piezas)
            </span>
          </div>

          <div className="dictamen-kpi-card kpi-balance">
            <span className="kpi-label">CONTEO FÍSICO REAL</span>
            <strong className="kpi-number">{stats.totalPiecesPhysical.toLocaleString('es-MX')} pzas</strong>
            <span className="kpi-sub">{stats.matchCount} productos cuadrados al 100%</span>
            <span className="kpi-sub-minor">
              Diferencia neta: {roundQuantity(stats.totalSurplusPieces - stats.totalMissingPieces) >= 0 ? '+' : ''}
              {roundQuantity(stats.totalSurplusPieces - stats.totalMissingPieces)} piezas
            </span>
          </div>
        </section>

        {/* Hallazgos y Observaciones */}
        <section className="dictamen-section">
          <h3 className="dictamen-heading">
            <FileText size={16} aria-hidden="true" />
            Hallazgos y Observaciones de Auditoría
          </h3>
          <div className="dictamen-notes-box">
            <p className="preserve-lines">
              {audit?.notes?.trim() ||
                'Sin observaciones adicionales registradas. El conteo físico fue concluido con los protocolos vigentes de validación en tienda.'}
            </p>
          </div>
        </section>

        {/* Principales Mermas Económicas (Top 10) */}
        {topLosses.length > 0 && (
          <section className="dictamen-section break-avoid">
            <h3 className="dictamen-heading">
              <AlertTriangle size={16} className="text-amber-600" aria-hidden="true" />
              Principales Discrepancias por Impacto Económico (Top Mermas)
            </h3>
            <div className="table-responsive">
              <table className="dictamen-table top-losses-table">
                <thead>
                  <tr>
                    <th style={{ width: '36px' }}>#</th>
                    <th style={{ width: '130px' }}>Código</th>
                    <th>Descripción del Producto</th>
                    <th style={{ textAlign: 'right', width: '80px' }}>Teórico</th>
                    <th style={{ textAlign: 'right', width: '80px' }}>Físico</th>
                    <th style={{ textAlign: 'right', width: '80px' }}>Faltante</th>
                    <th style={{ textAlign: 'right', width: '110px' }}>Pérdida (PVP)</th>
                  </tr>
                </thead>
                <tbody>
                  {topLosses.map((p, idx) => {
                    const diff = p.theoreticalStock - p.physicalStock;
                    const lossPvp = diff * p.price;
                    return (
                      <tr key={p.code}>
                        <td style={{ fontWeight: 700, color: '#64748b' }}>{idx + 1}</td>
                        <td><code className="dictamen-code">{p.code}</code></td>
                        <td><strong>{p.description}</strong></td>
                        <td style={{ textAlign: 'right' }}>{p.theoreticalStock}</td>
                        <td style={{ textAlign: 'right' }}>{p.physicalStock}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#dc2626' }}>
                          -{roundQuantity(diff)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#dc2626' }}>
                          -${lossPvp.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Detalle del Inventario Físico */}
        <section className="dictamen-section">
          <h3 className="dictamen-heading">
            <CheckCircle size={16} aria-hidden="true" />
            Detalle del Inventario Físico y Conciliación
          </h3>
          <div className="table-responsive">
            <table className="dictamen-table">
              <thead>
                <tr>
                  <th style={{ width: '120px' }}>Código</th>
                  <th>Descripción</th>
                  <th style={{ textAlign: 'right', width: '70px' }}>Teórico</th>
                  <th style={{ textAlign: 'right', width: '70px' }}>Físico</th>
                  <th style={{ textAlign: 'right', width: '75px' }}>Diferencia</th>
                  <th style={{ textAlign: 'center', width: '95px' }}>Estado</th>
                  <th style={{ textAlign: 'right', width: '75px' }}>Costo</th>
                  <th style={{ textAlign: 'right', width: '75px' }}>P. Venta</th>
                  <th style={{ textAlign: 'right', width: '85px' }}>Impacto</th>
                </tr>
              </thead>
              <tbody>
                {displayProducts.map(p => {
                  const status = productStatus(p);
                  const diff = isCounted(p) && !p.isUnregistered
                    ? roundQuantity(p.physicalStock - p.theoreticalStock)
                    : null;
                  const impacto = diff !== null ? roundQuantity(diff * p.cost) : null;
                  return (
                    <tr key={p.code}>
                      <td><code className="dictamen-code">{p.code}</code></td>
                      <td>
                        <span className="dictamen-prod-name">{p.description}</span>
                        {p.department && <small className="dictamen-dept">{p.department}</small>}
                      </td>
                      <td style={{ textAlign: 'right' }}>{p.theoreticalStock}</td>
                      <td style={{ textAlign: 'right' }}>{isCounted(p) ? p.physicalStock : '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        {diff !== null ? (diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '0') : '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`dictamen-badge status-${status}`}>
                          {{
                            missing: 'Faltante',
                            surplus: 'Sobrante',
                            match: 'Cuadrado',
                            not_counted: 'Sin contar',
                            unregistered: 'No registrado',
                          }[status]}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>${p.cost.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>${p.price.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        {impacto !== null
                          ? impacto > 0
                            ? `+$${impacto.toFixed(2)}`
                            : impacto < 0
                            ? `-$${Math.abs(impacto).toFixed(2)}`
                            : '$0.00'
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {isForScreenPreview && !showAllInPreview && products.length > 50 && (
            <div className="preview-pagination-banner">
              <span>
                Mostrando los primeros 50 de {products.length} productos en la vista previa. Al imprimir o guardar como PDF se incluyen todos los {products.length} productos.
              </span>
              <button
                type="button"
                onClick={() => setShowAllInPreview(true)}
                className="preview-show-all-btn"
              >
                Cargar los {products.length} productos en pantalla
              </button>
            </div>
          )}
        </section>

        {/* Firmas de Conformidad y Validación */}
        <section className="dictamen-signatures">
          <div className="dictamen-signature-box">
            <div className="dictamen-sig-line" />
            <strong className="dictamen-sig-name">{profile?.auditorName || 'Firma del Auditor Responsable'}</strong>
            <span className="dictamen-sig-title">Auditor Independiente / Supervisor</span>
            <span className="dictamen-sig-date">Fecha de Firma: _________________________</span>
          </div>

          <div className="dictamen-signature-box">
            <div className="dictamen-sig-line" />
            <strong className="dictamen-sig-name">{company?.contactName || 'Conformidad de la Empresa'}</strong>
            <span className="dictamen-sig-title">Representante Legal / Encargado de Tienda</span>
            <span className="dictamen-sig-date">Fecha de Recepción: _________________________</span>
          </div>
        </section>

        {/* Sello Oficial y Logo Grid.mx al final del documento */}
        <footer className="dictamen-grid-footer">
          <div className="grid-footer-brand">
            <img
              src="/grid-logo.png"
              alt="Grid.mx - Pensamos en código. Creamos soluciones"
              className="grid-footer-logo"
            />
            <div>
              <div className="grid-footer-title">Grid.mx</div>
              <div className="grid-footer-slogan">Pensamos en código. Creamos soluciones</div>
            </div>
          </div>
          <div className="grid-footer-cert">
            <div className="grid-footer-stamp">Dictamen Oficial Certificado</div>
            <div className="grid-footer-meta">
              Sistema de Auditoría de Inventarios eleventa · <a href="https://grid.mx" target="_blank" rel="noreferrer">https://grid.mx</a>
            </div>
            <div className="grid-footer-time">
              Folio: GRD-MX-{audit?.id?.slice(0, 8).toUpperCase() || '2026'} · {new Date().toLocaleString('es-MX')}
            </div>
          </div>
        </footer>
      </div>
    );
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="export-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      className={`export-dialog fixed inset-0 z-50 m-auto max-h-[92dvh] overflow-y-auto rounded-[28px] border-0 bg-transparent p-3 text-[#F2F1ED] ${
        activeTab === 'preview' ? 'preview-mode-active' : ''
      }`}
    >
      {/* Vista 1: Opciones y Descargas */}
      {activeTab === 'options' && (
        <div className="export-screen bg-[#1E1E1E] border border-white/10 rounded-[28px] max-w-lg w-full p-6 shadow-2xl flex flex-col gap-5 animate-card-pop mx-auto">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div id="export-title" className="flex items-center gap-2.5 text-[#F2F1ED] font-extrabold text-lg">
              <div className="w-8 h-8 rounded-full bg-[#FF6E42]/20 text-[#FF6E42] flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
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
            El reporte incluye todo el catálogo, aunque haya productos pendientes. El ajuste contiene únicamente los {adjustmentProducts.length} productos registrados con conteo confirmado.
          </p>

          {exportError && <p role="alert" className="text-xs text-[#FF6E42] font-bold">{exportError}</p>}
          {download && (
            <div className="text-xs text-[#CCCCCC] break-words" role="status">
              Archivo preparado. Si no comenzó la descarga, usa este enlace:
              <a href={download.url} download={download.fileName} className="download-link">Guardar archivo: {download.fileName}</a>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {/* Botón de Previsualizador */}
            <button
              onClick={() => setActiveTab('preview')}
              className="w-full py-3.5 px-6 bg-[#262626] hover:bg-[#333333] active:scale-[0.98] text-[#F2F1ED] font-bold rounded-full border border-white/15 shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer text-xs"
            >
              <Eye className="w-4 h-4 text-[#FF6E42]" />
              Previsualizar dictamen oficial (PDF)
            </button>

            {/* Imprimir / Guardar como PDF directo */}
            <button
              onClick={handlePrint}
              className="w-full py-3.5 px-6 bg-[#262626] hover:bg-[#303030] text-[#F2F1ED] text-xs font-bold rounded-full border border-white/10 flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 text-[#FF6E42]" />
              Imprimir dictamen / Guardar como PDF
            </button>

            {/* Descargas Excel */}
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
              <FileSpreadsheet className="w-4 h-4 text-[#888888]" aria-hidden="true" />
              Descargar ajuste de inventario (.xlsx)
            </button>
            {adjustmentProducts.length === 0 && (
              <p className="text-xs text-[#CCCCCC]">
                Para generar un ajuste, confirma la cantidad de al menos un producto del catálogo. Un cero confirmado registra un faltante total.
              </p>
            )}
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
      )}

      {/* Vista 2: Previsualizador en Pantalla */}
      {activeTab === 'preview' && (
        <div className="export-screen preview-container bg-[#1E1E1E] border border-white/10 rounded-[28px] max-w-4xl w-full p-4 sm:p-6 shadow-2xl flex flex-col gap-4 animate-card-pop mx-auto">
          {/* Barra de herramientas de la vista previa */}
          <div className="preview-toolbar flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <button
              onClick={() => setActiveTab('options')}
              className="inline-flex items-center gap-1.5 text-xs text-[#CCCCCC] hover:text-[#F2F1ED] py-2 px-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver a opciones
            </button>

            <div className="text-xs font-bold text-[#F2F1ED] flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#FF6E42]" />
              Vista Previa del Dictamen Oficial (PDF)
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="py-2.5 px-4 bg-[#FF6E42] hover:bg-[#ff8560] text-[#161616] text-xs font-black rounded-full flex items-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer"
              >
                <Printer className="w-4 h-4 stroke-[2.5]" />
                Imprimir / Guardar como PDF
              </button>

              <button
                aria-label="Cerrar ventana"
                onClick={onClose}
                className="text-[#888888] hover:text-[#F2F1ED] p-2 rounded-full hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Contenedor del documento para pantalla */}
          <div className="preview-sheet-wrapper overflow-x-auto rounded-2xl">
            {renderDocumentContent(true)}
          </div>

          {/* Acciones al pie de la previsualización */}
          <div className="preview-footer-actions flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
            <span className="text-xs text-[#888888]">
              {products.length} productos en este dictamen · Certificado por Grid.mx
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExportExcel('report')}
                className="py-2 px-4 bg-[#262626] hover:bg-[#303030] text-[#F2F1ED] text-xs font-semibold rounded-full border border-white/10 flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar Excel
              </button>
              <button
                onClick={handlePrint}
                className="py-2.5 px-5 bg-[#FF6E42] hover:bg-[#ff8560] text-[#161616] text-xs font-black rounded-full flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Printer className="w-4 h-4" />
                Imprimir o Guardar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sección exclusiva para impresión nativa (window.print()) */}
      <section className="print-report">
        {renderDocumentContent(false)}
      </section>
    </dialog>
  );
};
