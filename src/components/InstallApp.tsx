import { useEffect, useState } from 'react';
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const available = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const done = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener('beforeinstallprompt', available);
    window.addEventListener('appinstalled', done);
    return () => { window.removeEventListener('beforeinstallprompt', available); window.removeEventListener('appinstalled', done); };
  }, []);
  if (installed) return null;
  return <aside className="mb-4 rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-xs text-slate-300">
    {prompt ? <button className="w-full rounded-lg bg-emerald-600 px-4 font-semibold text-white" disabled={busy} onClick={async () => {
      setBusy(true);
      try { await prompt.prompt(); await prompt.userChoice; } catch { /* The browser menu remains available. */ } finally { setPrompt(null); setBusy(false); }
    }}>Instalar Auditor como aplicación</button> : <p>{window.isSecureContext
      ? 'Instalación: usa el menú del navegador → Instalar aplicación o Añadir a pantalla de inicio, si está disponible.'
      : 'Conexión Wi-Fi por HTTP: ingreso manual o lector USB/Bluetooth. La cámara y la instalación de la app requieren HTTPS confiable.'}</p>}
    <p className="mt-2">Los conteos se guardan solo en este navegador. La PC y el celular no se sincronizan; exporta el Excel desde el dispositivo donde contaste.</p>
  </aside>;
}
