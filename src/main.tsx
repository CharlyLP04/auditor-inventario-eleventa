import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    // En desarrollo local desregistrar service workers previos para siempre ver los últimos cambios
    void navigator.serviceWorker.getRegistrations().then(registrations => {
      for (const registration of registrations) {
        void registration.unregister();
      }
    });
    if ('caches' in window) {
      void caches.keys().then(names => {
        for (const name of names) {
          void caches.delete(name);
        }
      });
    }
  } else if (import.meta.env.PROD && window.isSecureContext) {
    window.addEventListener('load', () => {
      void navigator.serviceWorker.register('/sw.js').catch(error => console.warn('Modo sin conexión no disponible:', error));
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
