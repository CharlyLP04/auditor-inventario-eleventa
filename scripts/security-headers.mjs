// Cabeceras de seguridad compartidas por el servidor local y Vercel (vercel.json debe contener las mismas;
// tests/server.test.mjs lo verifica). style-src permite estilos en línea porque el escáner (html5-qrcode)
// los aplica a su visor; no se permiten scripts en línea ni eval.
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob: mediastream:",
  // Firestore y Firebase Auth (modo equipo). Sin otros destinos de red.
  "connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com",
  "font-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export const SECURITY_HEADERS = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), payment=()',
};
