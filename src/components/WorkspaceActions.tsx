import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';
export function WorkspaceActions({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !ref.current?.contains(event.target) && ref.current) ref.current.open = false; };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  return <details ref={ref} className="workspace-menu" onKeyDown={event => {
    if (event.key === 'Escape' && ref.current) { ref.current.open = false; ref.current.querySelector('summary')?.focus(); }
  }}>
    <summary aria-label="Herramientas del espacio de trabajo"><SlidersHorizontal size={17} aria-hidden="true" /><span>Herramientas</span></summary>
    <div className="workspace-menu-panel" onClick={event => { if ((event.target as Element).closest('button') && ref.current) ref.current.open = false; }}>{children}</div>
  </details>;
}
