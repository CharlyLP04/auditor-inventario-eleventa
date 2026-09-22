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

  if (installed) return null;

  return (
    <aside className="mb-6 rounded-2xl border border-white/10 bg-[#202020] p-4 text-xs text-[#CCCCCC] shadow-lg animate-card-pop">
      {prompt ? (
        <button
          className="w-full rounded-full bg-[#FF6E42] hover:bg-[#ff8560] py-3 px-6 font-black text-[#161616] uppercase tracking-wider text-xs shadow-md transition-all cursor-pointer"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await prompt.prompt();
              await prompt.userChoice;
            } catch {
              /* Browser menu fallback */
            } finally {
              setPrompt(null);
              setBusy(false);
            }
          }}
        >
          {busy ? 'Instalando…' : '📥 Instalar Auditor como App en este dispositivo'}
        </button>
      ) : (
        <p className="leading-relaxed">
          {window.isSecureContext
            ? '💡 Puedes instalar esta app en tu celular o PC desde el menú del navegador: "Instalar aplicación" o "Agregar a pantalla de inicio".'
            : 'Conexión local por HTTP: Para activar la cámara en el celular e instalar la app como PWA, se requiere HTTPS confiable o usar la versión en Vercel.'}
        </p>
      )}
      <p className="mt-2 text-[11px] text-[#888888]">
        Tus datos se guardan exclusivamente en el almacenamiento local de este dispositivo.
      </p>
    </aside>
  );
}
