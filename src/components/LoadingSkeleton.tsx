/** Presentación de carga; no dispara consultas ni retrasa los datos reales. */
export function LoadingSkeleton({ label = 'Cargando…', compact = false }: { label?: string; compact?: boolean }) {
  return <section className={`loading-skeleton${compact ? ' loading-skeleton-compact' : ''}`} aria-label={label} aria-busy="true">
    <p className="loading-caption" role="status"><span className="loading-indicator" aria-hidden="true" />{label}</p>
    <div className="skeleton-content" aria-hidden="true">
      {!compact && <div className="skeleton-toolbar"><span className="skeleton-line skeleton-title" /><span className="skeleton-control" /></div>}
      {Array.from({ length: compact ? 2 : 3 }, (_, index) => <div className="skeleton-row" key={index}>
        <div><span className="skeleton-line skeleton-code" /><span className="skeleton-line skeleton-name" /><span className="skeleton-line skeleton-detail" /></div>
        <span className="skeleton-control" />
      </div>)}
    </div>
  </section>;
}
