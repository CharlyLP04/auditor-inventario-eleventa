import * as XLSX from 'xlsx';
import type { Product, AuditStats } from '../types';

import { isCounted, roundQuantity } from './auditState';

export function createAuditWorkbook(products: Product[], stats: AuditStats, now = new Date()) {
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
      'Precio Venta ($)': p.price,
      'Estado': estado,
    };
  });

  const wsDiscrepancias = XLSX.utils.json_to_sheet(discrepanciaRows);
  XLSX.utils.book_append_sheet(wb, wsDiscrepancias, 'Auditoría_Discrepancias');

  // HOJA 3: Resumen Ejecutivo
  const fechaStr = now.toLocaleDateString('es-MX', { dateStyle: 'full' }) + ' ' + now.toLocaleTimeString('es-MX');

  const resumenRows = [
    { 'Métrica': 'Fecha de Auditoría', 'Valor': fechaStr },
    { 'Métrica': 'Total Productos en Catálogo', 'Valor': stats.totalCatalog },
    { 'Métrica': 'Productos Auditados', 'Valor': `${stats.auditedCount} (${Math.round((stats.auditedCount / (stats.totalCatalog || 1)) * 100)}%)` },
    { 'Métrica': 'Total Piezas Teóricas (eleventa)', 'Valor': stats.totalPiecesTheoretical },
    { 'Métrica': 'Total Piezas Físicas Contadas', 'Valor': stats.totalPiecesPhysical },
    { 'Métrica': 'Diferencia Neta de Piezas (Productos Contados Registrados)', 'Valor': roundQuantity(stats.totalSurplusPieces - stats.totalMissingPieces) },
    { 'Métrica': 'Piezas Faltantes (Mermas)', 'Valor': stats.totalMissingPieces },
    { 'Métrica': 'Costo de Merma / Faltantes ($)', 'Valor': `$${stats.missingCostValue.toFixed(2)} MXN` },
    { 'Métrica': 'Piezas Sobrantes', 'Valor': stats.totalSurplusPieces },
    { 'Métrica': 'Costo de Sobrantes ($)', 'Valor': `$${stats.surplusCostValue.toFixed(2)} MXN` },
    { 'Métrica': 'Productos Cuadrados al 100%', 'Valor': stats.matchCount },
    { 'Métrica': 'Productos con Diferencias', 'Valor': stats.missingCount + stats.surplusCount },
    { 'Métrica': 'Productos No Registrados en Catálogo', 'Valor': stats.unregisteredCount },
  ];

  const wsResumen = XLSX.utils.json_to_sheet(resumenRows);
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen_Ejecutivo');

  return wb;
}
export function exportAuditToEleventaExcel(products: Product[], stats: AuditStats) {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  XLSX.writeFile(createAuditWorkbook(products, stats, now), `Auditoria_Inventario_eleventa_${date}.xlsx`);
}
