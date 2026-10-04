import { useEffect, useState } from 'react';
import { transition } from '../services/transition';
type Scale = 'sm' | 'md' | 'lg';
export function InterfaceScale({ username }: { username: string }) {
  const key = `grid_ui_scale::${username}`;
  const [scale, setScale] = useState<Scale>(() => { const value = localStorage.getItem(key); return value === 'sm' || value === 'lg' ? value : 'md'; });
  useEffect(() => { document.documentElement.dataset.uiScale = scale; localStorage.setItem(key, scale); }, [key, scale]);
  return <div className="interface-scale" role="group" aria-label="Tamaño de interfaz">{(['sm', 'md', 'lg'] as const).map((value, i) => <button key={value} className="secondary" aria-pressed={scale === value} title={['Compacto', 'Estándar', 'Campo XL'][i]} onClick={() => transition(() => { document.documentElement.dataset.uiScale = value; localStorage.setItem(key, value); setScale(value); })}>{['A−', 'A', 'A+'][i]}</button>)}</div>;
}
