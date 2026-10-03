import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Safari en iPhone borra los datos de un sitio tras 7 días sin uso, salvo en la app añadida a la pantalla de inicio.
function isIosBrowser(userAgent = navigator.userAgent, platform = navigator.platform, touchPoints = navigator.maxTouchPoints) {
  return /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && touchPoints > 1);
}
const IOS_DISMISS_KEY = 'auditor_ios_install_dismissed';
function readDismissed() { try { return localStorage.getItem(IOS_DISMISS_KEY) === '1'; } catch { return false; } }

export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const available = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const done = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', available);
    window.addEventListener('appinstalled', done);
    return () => {
      window.removeEventListener('beforeinstallprompt', available);
      window.removeEventListener('appinstalled', done);
    };
  }, []);

  if (installed || dismissed) return null;

  const standaloneIos = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (!prompt && isIosBrowser() && !standaloneIos && !readDismissed()) return (
    <aside className="fixed bottom-20 right-4 left-4 sm:left-auto sm:right-6 sm:w-96 z-30 rounded-2xl border border-[#f5c518]/60 bg-[#1E1E1E]/95 backdrop-blur-xl p-4 shadow-2xl" aria-labelledby="ios-install-title">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h4 id="ios-install-title" className="text-xs font-black text-[#F2F1ED] uppercase tracking-wider">Instala la app en tu iPhone</h4>
          <p className="text-[12px] text-[#d6d0c8] mt-1 leading-relaxed">
            En Safari, toca <strong>Compartir</strong> y luego <strong>Añadir a pantalla de inicio</strong>. Ábrela siempre desde ese icono: Safari puede borrar los datos de este sitio si pasan 7 días sin usarlo.
          </p>
        </div>
        <button onClick={() => { try { localStorage.setItem(IOS_DISMISS_KEY, '1'); } catch { /* Preferencia opcional. */ } setDismissed(true); }}
          className="text-[#c4bcb2] hover:text-[#F2F1ED] p-1 rounded-full hover:bg-white/10 transition-colors" aria-label="Cerrar guía de instalación">
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
  // En Android y escritorio solo se muestra si el navegador ofrece el diálogo nativo de instalación.
  if (!prompt) return null;

  return (
    <aside className="fixed bottom-20 right-4 left-4 sm:left-auto sm:right-6 sm:w-96 z-30 rounded-2xl border border-white/15 bg-[#1E1E1E]/95 backdrop-blur-xl p-4 shadow-2xl animate-card-pop">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h4 className="text-xs font-black text-[#F2F1ED] uppercase tracking-wider flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5 text-[#FF6E42]" />
            Instalar App en el dispositivo
          </h4>
          <p className="text-[11px] text-[#bdbdbd] font-medium mt-1 leading-relaxed">
            Instálala como aplicación nativa para escanear en pantalla completa sin barras de navegador.
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-[#888888] hover:text-[#F2F1ED] p-1 rounded-full hover:bg-white/10 transition-colors"
          aria-label="Cerrar sugerencia de instalación"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <button
        className="mt-3 w-full rounded-full bg-[#FF6E42] hover:bg-[#ff8560] py-2.5 px-4 font-black text-[#161616] uppercase tracking-wider text-[11px] shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await prompt.prompt();
            await prompt.userChoice;
          } catch {
            /* Fallback */
          } finally {
            setPrompt(null);
            setBusy(false);
          }
        }}
      >
        <span>{busy ? 'Instalando…' : 'Instalar ahora'}</span>
      </button>
    </aside>
  );
}
