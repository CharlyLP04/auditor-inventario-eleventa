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

1. Carga un Excel (.xlsx/.xls), CSV o TSV (UTF-8 o Windows-1252). Se requieren Código, Descripción y Existencia; se reconocen variantes de encabezados (por ejemplo, Precio Público, Costo Promedio, Clave interna, Depto) en cualquier orden, aunque haya filas de título arriba del encabezado.
2. Antes de reemplazar el catálogo se muestra una vista previa: columnas detectadas (puedes reasignarlas a mano), primeros productos, columnas que no se usarán, avisos si faltan precio de venta o costo, y cada fila con problemas (código vacío o duplicado, número inválido) con su motivo. Si hay filas con problemas debes aceptar explícitamente que se omitan; quedan registradas en el balance. Límite: 10 MB / 20,000 productos. Los números deben usar punto decimal (1,234.50); una coma decimal ambigua (1,25) se rechaza en lugar de adivinarse. No se interpretan fechas.
3. Conserva como texto los códigos con ceros iniciales o más de 15 dígitos. Una precisión perdida previamente por Excel no puede recuperarse automáticamente.
4. Cuenta por cámara, lector USB/Bluetooth, teclado o edición manual. Un cero confirmado significa faltante total; un producto pendiente no es una merma confirmada. Cada lectura muestra un estado con color, icono y texto: verde (en la auditoría), rojo (no encontrado) o amarillo (advertencia, por ejemplo otro departamento).
5. El buscador del escáner localiza por código de barras, clave interna o palabras de la descripción (sin acentos y en cualquier orden). Escribir una descripción nunca crea productos.
6. Un código que no está en el catálogo no se cuenta solo: puedes registrarlo como **no encontrado** con nombre, nota, cantidad y departamento. Después puedes editarlo, vincularlo al producto correcto del catálogo o excluirlo del conteo (no se borra y se puede reincorporar). Cada acción queda en la bitácora de la auditoría.
7. Exporta el Excel o imprime el reporte. El balance y el dictamen valoran a precio de venta; el costo se muestra como referencia. La hoja de ajuste incluye solo productos contados y registrados. Los no registrados permanecen en el reporte para revisión; no se exportan con costo/precio cero a la hoja de ajuste.
8. Revisa la correspondencia de columnas y las opciones de importación de tu versión de eleventa antes de aplicar cambios. Esta aplicación no accede a su base de datos ni aplica ajustes automáticamente.

## Modo equipo (varios teléfonos en la misma auditoría)

Con Firebase configurado (ver [docs/puesta-en-marcha-equipo.md](docs/puesta-en-marcha-equipo.md)), cada persona entra con su cuenta y la app ofrece dos modos:
- **Equipo:** auditoría compartida en vivo, con departamentos asignables, historial de quién capturó qué y conteo sin conexión con envío automático.
- **Local:** como hasta ahora, solo en ese dispositivo.

Sin configuración, la app funciona únicamente en modo local y no descarga el SDK de Firebase. Las decisiones están en [ADR-0002](docs/adr/0002-colaboracion-en-tiempo-real-con-sesiones-por-persona.md) y el detalle técnico en [docs/diseno](docs/diseno/colaboracion-multidispositivo.md).

## Respaldos del modo local

El botón **Respaldo** descarga un JSON. Puedes restaurarlo desde Cargar archivo para continuar los conteos en este u otro equipo. PC y celular **no se sincronizan**; cambiar de dirección o navegador cambia el almacenamiento. El programa avisa si el almacenamiento está lleno o los datos guardados están dañados y evita sobrescribir silenciosamente esos datos.

## Desarrollo y pruebas locales

- `npm run dev`: desarrollo local, sin service worker.
- `npm run build`: TypeScript y compilación de producción.
- `npm start`: servir `dist` con PWA y QR.
- `npm run lint`: análisis de código.
- `npm test`: pruebas de importación, búsqueda, no encontrados, conteo, validación, exportación, modelo de nube y cabeceras de seguridad.
- `npm run test:cloud`: reglas de Firestore y escenarios de dos personas contra los emuladores de Firebase (requiere Java 11+).
- `node tests/field-browser-server.mjs`: verificación de campo en `http://localhost:5191/__field.html` (requiere `npm run build`). Pulsa Ejecutar; usa datos sintéticos en otro origen de almacenamiento y borra su base de pruebas al iniciar.

Las pruebas de navegador no sustituyen probar una cámara física, una linterna, una instalación real en iOS/Android o la importación en una instalación real de eleventa.
