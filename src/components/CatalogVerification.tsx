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
  const segments = [
    { label: 'Coinciden', value: v.match, color: 'var(--app-success)' },
    { label: 'Con faltantes', value: v.missing, color: 'var(--app-danger)' },
    { label: 'Con sobrantes', value: v.surplus, color: 'var(--app-surplus)' },
    { label: 'Pendientes', value: v.pending, color: '#526477' },
  ];
  const valueMaximum = Math.max(1, Math.abs(v.expectedSaleValue), Math.abs(v.countedSaleValue));
  return <section className="workspace-card verification-panel" aria-labelledby="verification-title">
    <div className="verification-heading">
      <ClipboardCheck size={22} aria-hidden="true" />
      <div><h3 id="verification-title">Verificación del inventario</h3><p>Avance del catálogo y valor registrado, de un vistazo.</p></div>
    </div>
    <div className="verification-dashboard">
      <div className="verification-overview">
        <div className="inventory-donut" role="img" aria-label={`${v.progress}% del catálogo contado: ${v.match} coinciden, ${v.missing} con faltantes, ${v.surplus} con sobrantes y ${v.pending} pendientes`}>
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="49" fill="none" stroke="var(--app-border)" strokeWidth="10" />
            {segments.map((segment, index) => <circle key={segment.label} cx="60" cy="60" r="49" fill="none" stroke={segment.color} strokeWidth="10" pathLength="100" strokeDasharray={`${v.expected ? segment.value / v.expected * 100 : 0} 100`} strokeDashoffset={-segments.slice(0, index).reduce((sum, item) => sum + (v.expected ? item.value / v.expected * 100 : 0), 0)} transform="rotate(-90 60 60)" />)}
          </svg>
          <div><strong>{v.progress}%</strong><span>{v.expected ? 'contado' : 'Sin catálogo'}</span></div>
        </div>
        <div className="verification-legend"><h4>{number(v.found)} <span>de {number(v.expected)} productos</span></h4>
          {segments.map(segment => <div key={segment.label}><span className="chart-key" style={{ backgroundColor: segment.color }} aria-hidden="true" /><span>{segment.label}</span><strong>{number(segment.value)}</strong></div>)}
          <small>{v.departmentsDone} / {v.departmentsTotal} departamentos completos</small>
        </div>
      </div>
      <div className="verification-value-chart">
        <h4>Valor a precio de venta</h4>
        {[{ label: 'Catálogo completo', value: v.expectedSaleValue, pieces: v.theoreticalPieces }, { label: 'Conteo registrado', value: v.countedSaleValue, pieces: v.physicalPieces }].map((item, index) => <div className="value-chart-row" key={item.label}>
          <div><span>{item.label}</span><strong>{money.format(item.value)}</strong></div>
          <div className="value-chart-track" aria-hidden="true"><span style={{ width: `${Math.abs(item.value) / valueMaximum * 100}%`, backgroundColor: index ? 'var(--app-accent)' : '#71889f' }} /></div>
          <small>{number(item.pieces)} piezas</small>
        </div>)}
        <p>{!v.expected ? 'Importa un catálogo para comenzar la verificación.' : v.pending ? 'El conteo está incompleto. La distancia entre barras aún no representa una pérdida.' : 'Catálogo y conteo completos. Revisa el balance para valorar las diferencias.'}</p>
      </div>
    </div>
    <div className="verification-footnotes">
      <span><strong>{number(v.unregistered)}</strong> fuera del catálogo</span>
      <span><strong>{number(v.excluded)}</strong> excluidos</span>
      <details><summary>Detalle de carga y piezas</summary><div>
        <p>{report ? `${number(report.fileRows)} filas en el archivo · ${number(report.imported)} importadas` : 'Sin reporte de importación'}</p>
        <p>Diferencia global: <strong>{netPieces > 0 ? '+' : ''}{number(netPieces)} piezas</strong>. Incluye los productos pendientes de contar.</p>
        <p>Las barras parten de cero y comparan magnitudes; los importes conservan su signo.</p>
      </div></details>
    </div>
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
