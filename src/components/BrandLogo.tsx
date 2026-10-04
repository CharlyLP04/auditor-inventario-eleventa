import type { CSSProperties } from 'react';
export function BrandLogo({ size = 40, className = '' }: { size?: number; className?: string }) {
  return <div className={`grid-logo ${className}`} style={{ width: size, height: size } as CSSProperties}>
    <svg viewBox="0 0 64 72" width="82%" height="82%" fill="none" aria-hidden="true">
      <path d="M50 14 44 8H20L9 20v17l23 16 23-16V27H39" stroke="var(--app-pearl)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m9 51 23 15 23-15" stroke="var(--app-pearl)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m23 23 6 6-6 6m11 1h8" stroke="var(--app-accent)" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>;
}
