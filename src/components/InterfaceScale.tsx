import { useEffect, useState } from 'react';
import { transition } from '../services/transition';
type Scale = 'sm' | 'md' | 'lg';
function readScale(key: string): Scale {
  try { const value = localStorage.getItem(key); return value === 'sm' || value === 'lg' ? value : 'md'; }
  catch { return 'md'; }
}
export function InterfaceScale({ username }: { username: string }) {
  const key = `grid_ui_scale::${username}`;
  const [scale, setScale] = useState<Scale>(() => readScale(key));
  useEffect(() => {
    document.documentElement.dataset.uiScale = scale;
    try { localStorage.setItem(key, scale); } catch { /* El tamaño sigue activo aunque el navegador no permita persistirlo. */ }
  }, [key, scale]);
  return <div className="interface-scale" role="group" aria-label="Tamaño de interfaz">{(['sm', 'md', 'lg'] as const).map((value, i) => <button key={value} className="secondary" aria-pressed={scale === value} aria-label={['Tamaño compacto', 'Tamaño estándar', 'Tamaño campo XL'][i]} title={['Compacto', 'Estándar', 'Campo XL'][i]} onClick={() => transition(() => { document.documentElement.dataset.uiScale = value; setScale(value); })}>{['A−', 'A', 'A+'][i]}</button>)}</div>;
}
