import { useEffect, useLayoutEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { currentWorkspaceUser } from '../services/storageIndexedDB';

// Estado de presentación por usuario y auditoría; nunca se mezcla con los datos del conteo.
export function useViewPreference<T>(scope: string, initial: T, valid: (value: unknown) => value is T): [T, Dispatch<SetStateAction<T>>] {
  const key = `grid_view_v1::${currentWorkspaceUser()}::${scope}`;
  const [entry, setEntry] = useState(() => {
    try { const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null'); return { key, value: valid(value) ? value : initial }; }
    catch { return { key, value: initial }; }
  });
  // Los consumidores se montan con key de auditoría. Este respaldo evita heredar estado al cambiar de ámbito.
  const value = entry.key === key ? entry.value : initial;
  const setValue: Dispatch<SetStateAction<T>> = update => setEntry(previous => {
    const current = previous.key === key ? previous.value : initial;
    return { key, value: typeof update === 'function' ? (update as (v: T) => T)(current) : update };
  });
  useEffect(() => { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Sigue disponible durante la sesión. */ } }, [key, value]);
  return [value, setValue];
}

const positions = new Map<string, number>();
export function useViewScroll(scope: string) {
  const key = `${currentWorkspaceUser()}::${scope}`;
  useLayoutEffect(() => {
    const restore = () => window.scrollTo({ top: positions.get(key) ?? 0, behavior: 'instant' });
    restore();
    const frame = requestAnimationFrame(restore);
    let position = positions.get(key) ?? 0;
    const remember = () => { position = window.scrollY; };
    window.addEventListener('scroll', remember, { passive: true });
    return () => { cancelAnimationFrame(frame); positions.set(key, position); window.removeEventListener('scroll', remember); };
  }, [key]);
}
