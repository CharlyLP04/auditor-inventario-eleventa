import { lazy, Suspense, useState } from 'react';
import App from './App';
import { cloudConfig, readMode, saveMode } from './services/cloud/config';

// El modo equipo (Firebase) se descarga solo cuando se usa; el modo local no depende de él.
const CloudApp = lazy(() => import('./components/cloud/CloudApp'));

export function Root() {
  const available = Boolean(cloudConfig());
  const [mode, setMode] = useState<'local' | 'cloud'>(() => available ? readMode() ?? 'cloud' : 'local');
  const choose = (next: 'local' | 'cloud') => { saveMode(next); setMode(next); };
  if (mode === 'cloud' && available) return <Suspense fallback={<p role="status" className="message">Cargando modo equipo…</p>}><CloudApp onUseLocal={() => choose('local')} /></Suspense>;
  return <App onUseCloud={available ? () => choose('cloud') : undefined} />;
}
