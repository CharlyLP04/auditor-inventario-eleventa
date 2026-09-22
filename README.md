# Auditor de Inventario eleventa · Escritorio y celular

Aplicación local con dos interfaces adaptables: escritorio con navegación lateral, columnas y paginación; celular con tarjetas, botones de 48 px y navegación inferior. Comparte el mismo código, pero cada navegador conserva su propio inventario.

## Inicio en Windows

Requiere Node.js **22.18 o posterior**. Abre `Iniciar-Auditor.bat`. Si faltan dependencias, el primer inicio las descarga desde npm y la fuente oficial de SheetJS; después compila y sirve la aplicación local en el puerto 5173. El navegador se abre cuando el servidor está listo. Mantén la terminal abierta y usa Ctrl+C para detenerlo.

El lanzador muestra los QR de las direcciones IPv4 de la PC. Usa la dirección correspondiente a la misma red Wi-Fi del celular. El programa no publica el proyecto, no necesita una cuenta y no envía catálogos a servicios externos.

## Cámara y PWA

En la PC usa `http://localhost:5173`. En el celular, una IP por HTTP permite captura manual y lectores externos, pero la cámara y la instalación PWA requieren **HTTPS con un certificado confiable**. Consulta `LEEME-LOCAL.md` para configurar certificados locales. No se desactivan protecciones del navegador.

Para contar varias piezas con el mismo código, retira el código del visor antes de presentar la siguiente pieza. El modo caja suma la cantidad seleccionada por lectura. Cámara, linterna, sonido y vibración dependen del navegador y del equipo.

La versión compilada almacena los recursos para abrirse sin conexión después de una primera visita. Cierra todas las ventanas de la aplicación y vuelve a abrirla para activar una actualización descargada.

## Importación, conteo y exportación

1. Carga un Excel o CSV con Código, Descripción y Existencia. Se reconocen variantes explícitas de esos encabezados, Costo, Precio Venta, Departamento y Tipo.
2. El límite es 10 MB / 20,000 productos. Códigos duplicados, faltantes o datos numéricos inválidos rechazan la importación completa, mostrando las filas a corregir.
3. Conserva como texto los códigos con ceros iniciales o más de 15 dígitos. Una precisión perdida previamente por Excel no puede recuperarse automáticamente.
4. Cuenta por cámara, lector USB/Bluetooth, teclado o edición manual. Un cero confirmado significa faltante total; un producto pendiente no es una merma confirmada.
5. Exporta el Excel o imprime el reporte. La hoja de ajuste incluye solo productos contados y registrados. Los no registrados permanecen en el reporte para revisión; no se exportan con costo/precio cero a la hoja de ajuste.
6. Revisa la correspondencia de columnas y las opciones de importación de tu versión de eleventa antes de aplicar cambios. Esta aplicación no accede a su base de datos ni aplica ajustes automáticamente.

El botón **Respaldo** descarga un JSON. Puedes restaurarlo desde Cargar archivo para continuar los conteos en este u otro equipo. PC y celular **no se sincronizan**; cambiar de dirección o navegador cambia el almacenamiento. El programa avisa si el almacenamiento está lleno o los datos guardados están dañados y evita sobrescribir silenciosamente esos datos.

## Desarrollo y pruebas locales

- `npm run dev`: desarrollo local, sin service worker.
- `npm run build`: TypeScript y compilación de producción.
- `npm start`: servir `dist` con PWA y QR.
- `npm run lint`: análisis de código.
- `npm test`: pruebas de importación, conteo, validación y exportación.
- `node tests/browser-server.mjs`: servidor de pruebas en `http://localhost:5183/__tests.html`. Pulsa Ejecutar pruebas; usa datos sintéticos y otro origen de almacenamiento.

Las pruebas de navegador no sustituyen probar una cámara física, una linterna, una instalación real en iOS/Android o la importación en una instalación real de eleventa.
