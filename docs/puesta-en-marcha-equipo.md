# Auditorías compartidas: PC y varios teléfonos

## Configuración

El proyecto de Firebase es **grid-auditor-eleventa**. La aplicación usa Firestore Standard con la base `(default)`, autenticación por contraseña y reglas de acceso por miembro. La configuración pública de Firebase está en `.env.local` en la copia del Escritorio; ese archivo no se sube a Git.

Para otras instalaciones copia `.env.example` como `.env.local` y completa las cuatro variables `VITE_FIREBASE_*`. En Vercel configura esas mismas variables y vuelve a compilar. Sin ellas el programa funciona solo en modo local y los dispositivos no se sincronizan.

Las reglas e índices están en `firestore.rules` y `firestore.indexes.json`. La configuración de acceso por contraseña y dominios está en `firebase.json`. Para aplicar cambios autorizados:

```powershell
npx -y firebase-tools@latest deploy --only firestore,auth --project grid-auditor-eleventa
```

## Primera sesión y equipo

1. El responsable crea **la primera cuenta desde la app**, con nombre de usuario y contraseña. Esa cuenta administra el equipo; hazlo antes de distribuir el enlace.
2. Cada colaborador crea su propia cuenta. Queda pendiente hasta que un administrador la active en **Personas con acceso**.
3. El administrador crea la empresa y una auditoría compartida e importa el catálogo una sola vez. Para conservar un conteo local existente, usa **Subir auditoría local** desde el mismo navegador donde está guardado.
4. Dentro de la auditoría pulsa **Compartir auditoría**, copia el enlace y ábrelo en las otras computadoras o teléfonos. El enlace no concede permisos: cada persona entra con su cuenta autorizada.
5. Reparte los departamentos y cuenta. Las capturas de todos se suman; los cambios se reflejan sin recargar. Las correcciones de un total se rechazan si otra persona cambió ese total desde que se leyó.

El formulario usa nombres, no correos personales: internamente crea `nombre@auth.grid.mx`. Las cuentas del modo local son independientes y no se trasladan automáticamente a Firebase.

## Sin conexión y sincronización

- Primero abre la auditoría con internet para descargar su catálogo.
- Sin señal puedes **sumar piezas**. Firebase guarda las escrituras pendientes en ese navegador y las envía al reconectar.
- **Todo sincronizado** solo aparece después de recibir confirmación del servidor y sin escrituras pendientes. Al reabrir la auditoría se consultan también los pendientes de la caché persistente.
- Corregir totales, deshacer, vincular productos, asignar departamentos, importar y administrar accesos requieren conexión.
- Antes de borrar datos del navegador o desinstalar la app, espera la confirmación. Las capturas locales pendientes se perderían al borrar esos datos.
- Si el servidor rechaza una captura, revisa el aviso y verifica el total; no supongas que quedó guardada.

## Prueba antes de usarla en una tienda

Abre la misma auditoría en dos dispositivos con cuentas distintas. Suma 2 piezas en uno y 3 en otro: ambos deben mostrar 5. Desconecta uno, agrega piezas, reconecta y verifica la suma. Reabre la auditoría y comprueba el estado de envío. Revisa **Balance → Verificación de integridad**.

La cámara en teléfonos necesita HTTPS. Usa el sitio publicado con HTTPS; una dirección de la PC por HTTP admite captura manual pero no garantiza acceso a la cámara.

## Verificación de desarrollo

- `npm test`: lógica local y estado de sincronización/enlaces.
- `npm run build` y `npm run lint`: compilación y análisis.
- `npm run test:cloud`: seguridad y dos clientes reales del SDK contra emuladores, sin tocar datos de producción. Requiere Java compatible con Firebase CLI en PATH. Cada prueba tiene un límite de 60 segundos; al terminar se cierran los procesos de prueba aunque el SDK conserve conexiones.

Estas pruebas no sustituyen comprobar cámaras físicas, instalación PWA ni uso real en iOS/Android.
