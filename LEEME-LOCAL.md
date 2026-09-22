# Auditor local

Abre `Iniciar-Auditor.bat`. Requiere Node.js 22.12 o posterior. Si faltan dependencias, el lanzador las instala desde npm; después compila el código y abre el navegador cuando el servidor ya está escuchando. No publica ni envía el catálogo a servidores externos. Mantén abierta la terminal; Ctrl+C detiene el servidor.

Los QR corresponden a las direcciones IPv4 de esta PC. Escanea la dirección de la red Wi-Fi compartida con el teléfono. VPN y adaptadores virtuales pueden mostrar direcciones adicionales. Si Windows solicita acceso de red, permite la red privada que utilizas. No abras el puerto en tu router.

## Cámara e instalación

En esta PC, `http://localhost:5173` permite cámara e instalación PWA en navegadores compatibles. El botón de instalar aparece cuando el navegador ofrece esa función; también puede estar disponible en su menú. En iPhone/iPad, usa Safari → Compartir → Añadir a pantalla de inicio.

Una dirección IP por HTTP en el teléfono permite captura manual y lectores externos, pero no cámara ni PWA. Para ambas funciones se necesita HTTPS con un certificado confiable para la IP o nombre utilizado. El servidor admite `AUDITOR_CERT_FILE` y `AUDITOR_KEY_FILE`, con rutas a archivos PEM locales. El certificado debe incluir las direcciones utilizadas y su autoridad debe ser confiable en cada dispositivo. No se instalan certificados ni se desactivan protecciones automáticamente.

El service worker se registra solo en producción. El lanzador sirve los recursos compilados y prepara su caché sin conexión. Visita la aplicación conectada una vez antes de usarla sin conexión. Cierra todas sus ventanas y vuelve a abrirla para activar una actualización descargada.

## Conteos y exportación

Cada navegador y dirección guardan datos independientes: no hay sincronización entre PC y celular. Cambiar de HTTP a HTTPS o de IP abre otro almacenamiento. Exporta antes de cambiar de dirección, borrar datos del navegador o reemplazar el catálogo.

Los productos pendientes se excluyen de la hoja de ajuste. Edita una cantidad y confirma `0` para registrar un faltante total. El reporte de discrepancias conserva las filas pendientes con estado `SIN CONTAR`; sus diferencias son provisionales. Las columnas del Excel mantienen sus nombres.

Los cambios de esta entrega no se ejecutaron ni se probaron, por solicitud del usuario.
