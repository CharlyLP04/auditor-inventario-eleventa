import * as XLSX from 'xlsx';
import type { Product, AuditStats, Company, AuditRecord, AuditorProfile } from '../types';

import { isCounted, roundQuantity } from './auditState';
import { prepareDownload } from './fileDownload';

interface ReportContext { company?: Company; audit?: AuditRecord; profile?: AuditorProfile; }
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function dateSuffix(now: Date) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function prepareWorkbook(wb: XLSX.WorkBook, fileName: string) {
  const data = XLSX.write(wb, { type: 'array', bookType: 'xlsx', compression: true });
  return prepareDownload(new Blob([data], { type: XLSX_MIME }), fileName);
}

export function createEleventaAdjustmentWorkbook(products: Product[]) {
  const counted = products.filter(p => isCounted(p) && !p.isUnregistered);
  if (!counted.length) throw new Error('Confirma el conteo de al menos un producto del catálogo para generar un ajuste.');

  // Reproduce las columnas del catálogo real. Los respaldos antiguos no guardaban
  // mayoreo/mínimo: omitir columnas desconocidas evita sobrescribirlas con ceros.
  const hasWholesale = counted.every(p => p.wholesalePrice !== undefined);
  const hasMinimum = counted.every(p => p.minStock !== undefined);
  const headers = ['Codigo', 'Descripcion', 'Precio Costo', 'Precio Venta'];
  if (hasWholesale) headers.push('Precio Mayoreo');
  headers.push('Inventario');
  if (hasMinimum) headers.push('Inv. Minimo');
  headers.push('Departamento');
  const rows = counted.map(p => {
    const row: (string | number)[] = [p.code, p.sourceDescription ?? p.description, p.cost, p.price];
    if (hasWholesale) row.push(p.wholesalePrice!);
    row.push(roundQuantity(p.physicalStock));
    if (hasMinimum) row.push(p.minStock!);
    row.push(p.department);
    return row;
  });
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  sheet['!cols'] = headers.map(name => ({ wch: name === 'Descripcion' ? 44 : name === 'Departamento' ? 26 : 20 }));
  for (let r = 1; r <= counted.length; r++) {
    const code = sheet[XLSX.utils.encode_cell({ r, c: 0 })];
    code.t = 's'; code.z = '@';
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Ajuste_Inventario_eleventa');
  return workbook;
}

export function exportEleventaAdjustment(products: Product[]) {
  return prepareWorkbook(createEleventaAdjustmentWorkbook(products), `Ajuste_Inventario_eleventa_${dateSuffix(new Date())}.xlsx`);
}

export function createAuditWorkbook(products: Product[], stats: AuditStats, now = new Date(), context: ReportContext = {}) {
  const wb = XLSX.utils.book_new();

  // HOJA 1: Formato listo para Importar / Ajustar en eleventa
  const eleventaAjusteRows = products.filter(p => isCounted(p) && !p.isUnregistered).map(p => ({
    'Código': p.code,
    'Descripción': p.description,
    'Existencia': p.physicalStock,
    'Costo': p.cost,
    'Precio Venta': p.price,
    'Departamento': p.department,
    'Tipo': p.unitType || 'unidad',
  }));

  const wsEleventa = XLSX.utils.json_to_sheet(eleventaAjusteRows, { header: ['Código', 'Descripción', 'Existencia', 'Costo', 'Precio Venta', 'Departamento', 'Tipo'] });
  XLSX.utils.book_append_sheet(wb, wsEleventa, 'Ajuste_Inventario_eleventa');

  // HOJA 2: Reporte de Auditoría y Discrepancias (Detalle de mermas y sobrantes)
  const discrepanciaRows = products.map(p => {
    const diff = roundQuantity(p.physicalStock - p.theoreticalStock);
    let estado = 'CUADRADO';
    if (p.isUnregistered) estado = 'NO REGISTRADO EN ELEVENTA';
    else if (!isCounted(p)) estado = 'SIN CONTAR';
    else if (diff < 0) estado = 'FALTANTE (MERMA)';
    else if (diff > 0) estado = 'SOBRANTE';

    const impactoDinero = isCounted(p) && !p.isUnregistered ? roundQuantity(diff * p.cost) : null;

    return {
      'Código de Barras': p.code,
      'Descripción': p.description,
      'Departamento': p.department,
      'Stock Teórico (eleventa)': p.theoreticalStock,
      'Stock Físico (Contado)': isCounted(p) ? p.physicalStock : null,
      'Diferencia (Piezas)': isCounted(p) && !p.isUnregistered ? diff : null,
      'Costo Unitario ($)': p.cost,
      'Impacto en $ (Costo)': impactoDinero,
      'Impacto en $ (Venta)': isCounted(p) && !p.isUnregistered ? roundQuantity(diff * p.price) : null,
      'Precio Venta ($)': p.price,
      'Estado': estado,
      'Precio Mayoreo ($)': p.wholesalePrice ?? null,
      'Inventario Mínimo': p.minStock ?? null,
    };
  });

  const wsDiscrepancias = XLSX.utils.json_to_sheet(discrepanciaRows);
  XLSX.utils.book_append_sheet(wb, wsDiscrepancias, 'Auditoría_Discrepancias');

  // HOJA 3: Resumen Ejecutivo
  const fechaStr = now.toLocaleDateString('es-MX', { dateStyle: 'full' }) + ' ' + now.toLocaleTimeString('es-MX');

  const resumenRows = [
    { 'Métrica': 'Empresa', 'Valor': context.company?.name ?? '' },
    { 'Métrica': 'Periodo', 'Valor': context.audit?.period ?? '' },
    { 'Métrica': 'Auditor', 'Valor': context.profile?.auditorName ?? '' },
    { 'Métrica': 'Servicio', 'Valor': context.profile?.serviceName ?? '' },
    { 'Métrica': 'Hallazgos', 'Valor': context.audit?.notes ?? '' },
    { 'Métrica': 'Merma a precio de venta ($)', 'Valor': stats.missingSaleValue },
    { 'Métrica': 'Sobrante a precio de venta ($)', 'Valor': stats.surplusSaleValue },
    { 'Métrica': 'Fecha de Auditoría', 'Valor': fechaStr },
    { 'Métrica': 'Total Productos en Catálogo', 'Valor': stats.totalCatalog },
    { 'Métrica': 'Productos Auditados', 'Valor': `${stats.auditedCount} (${Math.round((stats.auditedCount / (stats.totalCatalog || 1)) * 100)}%)` },
    { 'Métrica': 'Total Piezas Teóricas (eleventa)', 'Valor': stats.totalPiecesTheoretical },
    { 'Métrica': 'Total Piezas Físicas Contadas', 'Valor': stats.totalPiecesPhysical },
    { 'Métrica': 'Diferencia Neta de Piezas (Productos Contados Registrados)', 'Valor': roundQuantity(stats.totalSurplusPieces - stats.totalMissingPieces) },
    { 'Métrica': 'Piezas Faltantes (Mermas)', 'Valor': stats.totalMissingPieces },
    { 'Métrica': 'Costo de Merma / Faltantes ($)', 'Valor': stats.missingCostValue },
    { 'Métrica': 'Piezas Sobrantes', 'Valor': stats.totalSurplusPieces },
    { 'Métrica': 'Costo de Sobrantes ($)', 'Valor': stats.surplusCostValue },
    { 'Métrica': 'Productos Cuadrados al 100%', 'Valor': stats.matchCount },
    { 'Métrica': 'Productos con Diferencias', 'Valor': stats.missingCount + stats.surplusCount },
    { 'Métrica': 'Productos No Registrados en Catálogo', 'Valor': stats.unregisteredCount },
    { 'Métrica': 'Productos registrados con costo en cero (sin valoración al costo)', 'Valor': products.filter(p => !p.isUnregistered && p.cost === 0).length },
  ];

  const wsResumen = XLSX.utils.json_to_sheet(resumenRows);
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen_Ejecutivo');

  return wb;
}
export function exportAuditToEleventaExcel(products: Product[], stats: AuditStats, context: ReportContext = {}) {
  if (!products.length) throw new Error('Carga un catálogo antes de descargar el reporte.');
  const now = new Date();
  return prepareWorkbook(createAuditWorkbook(products, stats, now, context), `Auditoria_Inventario_eleventa_${dateSuffix(now)}.xlsx`);
}
