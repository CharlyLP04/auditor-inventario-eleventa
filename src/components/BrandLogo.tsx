import type { CSSProperties } from 'react';

/** Marca vectorial: estructura Grid, prompt de terminal y cursor de captura. */
export function BrandLogo({ size = 40, className = '' }: { size?: number; className?: string }) {
  return <div className={`grid-logo ${className}`} style={{ width: size, height: size } as CSSProperties}>
    <svg viewBox="0 0 64 72" width="100%" height="100%" fill="none" aria-hidden="true" focusable="false">
      <path className="grid-mark-frame" pathLength="100" d="M50 14 44 8H20L9 20v17l23 16 23-16V27H39" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path className="grid-mark-base" pathLength="100" d="m9 51 23 15 23-15" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path className="grid-mark-prompt" d="m23 23 6 6-6 6" stroke="var(--app-accent-hover)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path className="grid-mark-cursor" d="M34 36h9" stroke="var(--app-accent-hover)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  </div>;
}
