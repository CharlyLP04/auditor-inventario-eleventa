import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

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

  // Solo mostrar si el navegador soporta el prompt nativo de instalación
  if (!prompt) return null;

  return (
    <aside className="fixed bottom-20 right-4 left-4 sm:left-auto sm:right-6 sm:w-96 z-30 rounded-2xl border border-white/15 bg-[#1E1E1E]/95 backdrop-blur-xl p-4 shadow-2xl animate-card-pop">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h4 className="text-xs font-black text-[#F2F1ED] uppercase tracking-wider flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5 text-[#FF6E42]" />
            Instalar App en el dispositivo
          </h4>
          <p className="text-[11px] text-[#888888] font-medium mt-1 leading-relaxed">
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
