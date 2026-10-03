import { useMemo, useState } from 'react';
import { ClipboardCheck, AlertTriangle } from 'lucide-react';
import type { Product, ImportReport } from '../types';
import { catalogVerification } from '../services/auditState';

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const number = (value: number) => value.toLocaleString('es-MX', { maximumFractionDigits: 6 });

/** Primer bloque del balance: ¿se cargó todo el catálogo y cuánto falta por contar? Todo a precio de venta. */
export function CatalogVerification({ products, report }: { products: Product[]; report?: ImportReport }) {
  const v = useMemo(() => catalogVerification(products, report), [products, report]);
  const [showIssues, setShowIssues] = useState(false);
  const loadComplete = report ? report.issues.length === 0 && report.imported === v.expected : null;
  const netPieces = Math.round((v.physicalPieces - v.theoreticalPieces) * 1e6) / 1e6;
  return <section className="workspace-card verification-panel" aria-labelledby="verification-title">
    <div className="verification-heading">
      <ClipboardCheck size={22} aria-hidden="true" />
      <div><h3 id="verification-title">Verificación del inventario</h3><p>Valores a precio de venta. El costo se muestra solo como referencia en el detalle.</p></div>
    </div>
    <div className="verification-grid">
      <div><span>Productos esperados</span><strong>{number(v.expected)}</strong><small>{report ? `${number(report.fileRows)} filas en el archivo` : 'Sin reporte de importación'}</small></div>
      <div><span>Encontrados (contados)</span><strong>{number(v.found)}</strong><small>{v.progress}% de avance</small></div>
      <div><span>Pendientes de contar</span><strong>{number(v.pending)}</strong><small>{v.departmentsDone} de {v.departmentsTotal} departamentos completos</small></div>
      <div><span>Faltantes · Sobrantes</span><strong>{number(v.missing)} · {number(v.surplus)}</strong><small>{number(v.match)} cuadrados</small></div>
      <div className="is-notfound"><span>No encontrados agregados</span><strong>{number(v.unregistered)}</strong><small>{v.excluded ? `${v.excluded} excluidos (conservados)` : 'Fuera del catálogo'}</small></div>
      <div><span>Valor de venta esperado</span><strong>{money.format(v.expectedSaleValue)}</strong><small>{number(v.theoreticalPieces)} piezas en eleventa</small></div>
      <div><span>Valor de venta contado</span><strong>{money.format(v.countedSaleValue)}</strong><small>{number(v.physicalPieces)} piezas contadas</small></div>
      <div><span>Diferencia de piezas</span><strong>{netPieces > 0 ? '+' : ''}{number(netPieces)}</strong><small>Contadas menos esperadas (incluye pendientes)</small></div>
    </div>
    <div role="progressbar" aria-label="Avance del conteo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v.progress} className="verification-progress"><span style={{ width: `${v.progress}%` }} /></div>
    {loadComplete === true && <p className="verification-ok">✓ Carga completa: las {number(report!.fileRows)} filas del archivo se importaron.</p>}
    {report && report.issues.length > 0 && <div className="message warning" role="status">
      <p><AlertTriangle size={15} aria-hidden="true" /> {report.issues.length} filas del archivo no se importaron. Revisa si alguno de esos productos está en tienda.</p>
      <button type="button" className="secondary" aria-expanded={showIssues} onClick={() => setShowIssues(value => !value)}>{showIssues ? 'Ocultar filas' : 'Ver filas omitidas'}</button>
      {showIssues && <ul className="verification-issues">{report.issues.slice(0, 200).map(issue => <li key={issue.row}>Fila {issue.row}{issue.code ? ` · ${issue.code}` : ''}: {issue.reason}</li>)}</ul>}
      {showIssues && report.issues.length > 200 && <p>Se muestran las primeras 200 filas.</p>}
    </div>}
    {v.missingPrice > 0 && <p className="message warning" role="status"><AlertTriangle size={15} aria-hidden="true" /> {v.missingPrice} productos no tienen precio de venta: su valor aparece en $0. Corrígelo en eleventa o en el producto.</p>}
    {report?.unusedColumns.length ? <p className="verification-note">Columnas del archivo no utilizadas: {report.unusedColumns.join(', ')}.</p> : null}
  </section>;
}
