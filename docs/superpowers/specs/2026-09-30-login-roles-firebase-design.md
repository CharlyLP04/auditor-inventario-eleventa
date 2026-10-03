# Inicio de sesión, roles y auditorías en la nube (Firebase)

- **Fecha:** 2026-09-30
- **Rama:** `feat/login-roles-firebase` (parte de `fix/auditoria-integral`)
- **Estado:** reemplazado por [ADR-0002](../../adr/0002-colaboracion-en-tiempo-real-con-sesiones-por-persona.md) y el [diseño de colaboración](../../diseno/colaboracion-multidispositivo.md) (2026-10-03: sin login de Google, una sesión por persona y departamentos asignables). Se conserva como antecedente.

## 1. Objetivo

Convertir el auditor local en una plataforma compartida para el servicio de auditoría de inventarios de dos administradores (el propietario y Charlie). Los administradores dan de alta empresas cliente, cargan su catálogo (XLS/XLSX/CSV), crean auditorías mensuales y las asignan a auditores. Cada auditor inicia sesión con Google en su teléfono y solo ve y cuenta las auditorías que tiene asignadas. Al terminar se obtiene el balance, el dictamen y el historial mes a mes de cada cliente.

**Restricciones:** costo cero (plan gratuito Spark de Firebase, sin tarjeta) y puesta en marcha sencilla.

### Criterios de éxito

1. Un administrador entra con Google y gestiona empresas, catálogos, auditorías, equipo y reportes.
2. Un auditor asignado ve solo sus auditorías en curso. Un auditor no asignado no ve ninguna. Una cuenta de Google desconocida ve "sin acceso". Las reglas del servidor lo garantizan aunque se manipule el cliente.
3. Dos teléfonos cuentan la misma auditoría a la vez y el total de cada producto es exactamente la suma de sus capturas activas.
4. Una captura hecha sin señal se sube sola al recuperar conexión. Si el servidor la rechaza, queda visible y no se pierde.
5. Un auditor no puede leer costos, precios ni importes (lo verifica una prueba de reglas).
6. Terminar una auditoría guarda un resumen con importes, y el historial del cliente muestra un renglón por mes.
7. El reporte Excel, el archivo de ajuste y el dictamen conservan su formato actual.
8. Todo funciona dentro del plan gratuito.

## 2. Decisiones tomadas con el usuario

| Tema | Decisión |
|---|---|
| Backend | Firebase: Authentication (Google), Cloud Firestore y Hosting, en plan Spark |
| Conteo simultáneo | Depende de la tienda: debe soportar uno o varios auditores a la vez |
| Señal en tienda | Desconocida: debe funcionar sin conexión |
| Re-escaneo del mismo código | **Sumar.** Cada captura confirmada se suma, queda registrada y se puede anular |
| Datos locales existentes | No se migran; la versión con login arranca vacía |
| Acceso de auditores | Solo cuentas de Google |
| Visibilidad del auditor | Ve existencia de eleventa y faltantes/sobrantes; **no** ve costos, precios ni importes |

## 3. Alcance

**Incluido:** login con Google; roles de administrador y auditor; empresas; equipo; auditorías mensuales con catálogo; asignación; conteo con cámara (escanear → cantidad → confirmar); anulación; modo sin conexión con bandeja local; cierre y cierre forzado; balance; dictamen; Excel; historial mensual por cliente; respaldo JSON por auditoría; reglas de seguridad con pruebas; publicación en Firebase Hosting.

**Fuera de alcance:**
- Migración de datos locales.
- Otros métodos de login.
- Firebase Storage y Cloud Functions (requieren plan de pago).
- Notificaciones por correo, apps nativas e integración directa con la base de eleventa.
- Autoregistro de auditores.
- Varias firmas auditoras (multi-organización).
- El modo de servidor local en red Wi-Fi.

## 4. Arquitectura

- **Cliente:** la app React + Vite existente, desplegada en Firebase Hosting (`https://<proyecto>.web.app`, HTTPS requerido por la cámara). Sin servidor propio: la lógica vive en el cliente y la autorización en `firestore.rules`.
- **Firebase Authentication:** proveedor Google. `signInWithPopup` en escritorio y `signInWithRedirect` en móvil y en la PWA instalada. `authDomain` apunta al dominio de Hosting de la app para que el login funcione en Safari/iOS sin almacenamiento de terceros.
- **Cloud Firestore:**
  - Caché persistente con varias pestañas (`persistentLocalCache` + `persistentMultipleTabManager`), que habilita lectura y escritura sin conexión.
  - Región `nam5`, permanente.
- **Service worker:** se conserva el actual (versionado en build). No intercepta rutas `/__/` (handler de autenticación de Firebase Hosting) ni solicitudes a otros orígenes.
- **Desarrollo y pruebas:** Firebase Emulator Suite (Auth + Firestore; Java 21 ya instalado). Variable `VITE_USE_EMULATORS=1` para conectar el cliente a los emuladores.
- **Configuración web de Firebase:** valores públicos en `src/firebase/config.ts`. No contiene secretos.

## 5. Roles y acceso

- **Administradores:** dos correos de Gmail fijos.
  - Se declaran en `firestore.rules` (fuente de autoridad) y en `src/firebase/config.ts` (solo para mostrar la interfaz correcta).
  - Una prueba unitaria verifica que ambas listas coincidan.
  - Requiere `email_verified == true`. Se comparan en minúsculas.
  - Agregar un administrador implica editar ambos archivos y publicar.
- **Auditores:** documento `team/{correo}` con `active: true`, gestionado por los administradores desde la pantalla Equipo. Desactivar corta el acceso de inmediato.
- **Sin acceso:** cualquier otra cuenta ve "Tu cuenta no tiene acceso; pide a un administrador que te dé de alta" y un botón para cerrar sesión. No puede leer ningún documento.
- **Asignación:** `audits/{id}.assignedEmails` (máximo 20 correos). Puede incluir correos que aún no han iniciado sesión.
- **Se elimina:** el PIN de administrador (`PinAuthModal`, `security.adminPin`, `authenticatePin`, `requireAdmin` basado en PIN).

## 6. Modelo de datos

Los correos se guardan en minúsculas. Las fechas del servidor usan `serverTimestamp()`.

### `team/{correo}`
`name` (1–120), `active` (bool), `createdAt`, `createdBy`, `updatedAt`.

### `companies/{companyId}`
`name` (1–200), `contactName?`, `phone?`, `address?`, `notes?` (≤10,000), `archived` (bool), `createdAt`, `updatedAt`. Al renombrar una empresa se actualiza `companyName` en sus auditorías, en lote.

### `settings/profile`
`serviceName`, `auditorName`, `letterhead`, `logo?`. El logo es una data URL PNG/JPEG/WebP que el cliente reduce a un lado máximo de 600 px y como máximo 400 KB, para respetar el límite de 1 MiB por documento.

### `audits/{companyId}_{periodo}`
El ID determinista garantiza una sola auditoría por empresa y mes; las reglas exigen que coincida con los campos.

Campos:
- `companyId`, `companyName` (copia), `period` (`AAAA-MM`), `title`.
- `status`: `draft` | `in_progress` | `completed` | `closed`.
- `assignedEmails` (string[] ≤ 20).
- `notes` (≤10,000), `notesUpdatedBy?`, `notesUpdatedAt?`.
- `productCount`, `departmentCount`, `catalogChunks` (número de bloques).
- `createdAt`, `createdBy`, `openedAt?`, `completedAt?`, `closedAt?`.

#### Subcolecciones
- **`catalog/{000…}`**: `items: {code, description, department, theoreticalStock, unitType?}[]`, hasta 500 por documento, en el orden del archivo importado.
- **`pricing/{000…}`**: alineado por índice con `catalog`. `items: {code, cost, price, wholesalePrice?, minStock?, sourceDescription}[]`.
- **`counts/{00…15}`**: 16 documentos creados al abrir el conteo.
  - Contienen `items: { [code]: { qty: number, captures: number } }` y `lastWrite: {captureId, kind: 'capture' | 'void'}`.
  - El bloque de un código es `FNV-1a(code) % 16`. El total de un código es la suma de sus entradas en todos los bloques, de modo que un bloque incorrecto no altera los totales.
  - Un producto está **contado** si `captures > 0`; una captura de 0 equivale a faltante total confirmado.
- **`captures/{captureId}`**: el ID lo genera el cliente (UUID), lo que da idempotencia en reintentos.
  - Campos: `code`, `quantity` (0 a 1,000,000,000, hasta 6 decimales), `description?` (≤200, para códigos no registrados), `bucket`, `by` (correo), `byName`, `at` (hora del servidor), `clientAt` (ISO del dispositivo), `voided` (bool), `voidedBy?`, `voidedAt?`.
  - Nunca se borra salvo al eliminar la auditoría completa.
- **`private/summary`**: `stats` (`AuditStats`, con importes), `countedBy: {email, name, captures}[]`, `computedAt`, `computedBy`. Se escribe al terminar y al cerrar.

#### Productos para reportes
`Product[]` se reconstruye en el cliente uniendo `catalog` + `pricing` (solo administradores) + totales de `counts`. Los códigos con capturas que no están en el catálogo son "no registrados"; su descripción proviene de sus capturas. Las funciones existentes (`calculateStats`, exportador, dictamen, comparativa) operan sobre ese `Product[]` sin cambiar su formato.

## 7. Reglas de seguridad (`firestore.rules`)

Todo se niega por omisión. Funciones auxiliares:
- `signedIn()`
- `email()`: correo en minúsculas.
- `isAdmin()`: verificado y en la lista fija.
- `isAuditor()`: existe `team/{email}` con `active == true`.
- `assigned(audit)`: `isAuditor() && email() in audit.assignedEmails && audit.status == 'in_progress'`.

| Ruta | Administrador | Auditor |
|---|---|---|
| `team/{correo}` | todo | leer solo el propio |
| `companies`, `settings`, `audits/*/pricing`, `audits/*/private` | todo | nada |
| `audits/{id}` | todo; al crear, ID = `companyId_period` y campos válidos | leer si `assigned`. La consulta de lista debe filtrar `assignedEmails array-contains` y `status == in_progress`. Actualizar solo `notes`, `notesUpdatedBy`, `notesUpdatedAt` |
| `audits/*/catalog` | todo | leer si `assigned` |
| `audits/*/counts/{b}` | leer; actualizar con las mismas validaciones que el auditor; crear y borrar | leer si `assigned`; actualizar solo como se describe abajo |
| `audits/*/captures/{c}` | leer; crear y anular cualquiera; borrar | crear y anular solo las propias, como se describe abajo; leer solo las propias |

**Crear captura (auditor asignado o administrador):**
- `by == email()` y `at == request.time`.
- `quantity` dentro de rango; `code` de 1 a 128 caracteres sin espacios al borde.
- `voided == false`; el documento no existía.

**Anular captura:**
- Solo cambia `voided` (false → true), `voidedBy == email()` y `voidedAt == request.time`.
- El auditor solo puede anular las suyas.

**Actualizar `counts/{b}`:**
- Solo cambian `items` y `lastWrite`, y en `items` solo cambia la clave igual al `code` de la captura indicada en `lastWrite.captureId`.
- Para `kind == 'capture'`, la captura debe crearse en la misma operación (`!exists` antes y `existsAfter`) y los deltas deben ser `qty += quantity` y `captures += 1`.
- Para `kind == 'void'`, la captura pasa de `voided == false` a `true` en la misma operación y los deltas son `qty -= quantity` y `captures -= 1`.
- Ambas escrituras viajan en un mismo `writeBatch` atómico.

**Validaciones de forma:** longitudes de texto, `period` con formato `AAAA-MM`, `assignedEmails.size() <= 20` y `status` dentro de los cuatro valores.

**Grupo de colecciones:** `match /{path=**}/captures/{c}` permite lectura solo al administrador, para el contador diario y las consultas de conteo por auditor.

**Índices** (`firestore.indexes.json`):
- `audits`: (`assignedEmails` array-contains, `status`).
- `audits`: (`companyId`, `period` desc).
- `captures`: (`by`, `at` desc).
- `captures`: (`by`, `voided`), para las consultas de conteo de "Contado por".
- Grupo de colecciones `captures`: `at`, para el contador diario.

## 8. Flujo de conteo (auditor)

1. **Mis auditorías:** auditorías en curso asignadas, con tienda, periodo y avance.
2. **Contar:**
   - Cámara (Html5Qrcode, formatos actuales), campo para lector USB/Bluetooth o captura manual.
   - Zona activa (departamento), voz y letra grande; estas preferencias se guardan en `localStorage` de cada dispositivo.
   - Barra de avance e indicador de conexión.
   - Se conserva el antirrebote de 1.8 s por código.
3. **Cantidad:**
   - La cámara se congela.
   - Se muestran descripción, código, departamento, existencia de eleventa y lo que lleva contado (piezas y número de capturas), con el teclado grande actual, atajos +1/+6/+12/+24/+50 y punto decimal.
   - Aviso de zona si el producto es de otro departamento.
   - Si el código no está en el catálogo: aviso y campo opcional de descripción.
   - **Cancelar** vuelve a la cámara sin escribir nada.
4. **Confirmar:**
   - "Sumar N piezas a DESCRIPCIÓN · total quedará en T · eleventa E → faltan/sobran D".
   - Botones **Confirmar** (Enter) y **Corregir**. Con 0: "No hay piezas: faltante total".
5. **Guardar:**
   - `writeBatch` con la captura más el incremento del bloque. No se espera al servidor para continuar.
   - Retroalimentación con sonido, destello, vibración y voz opcional; la cámara se reanuda.
6. **Corregir:** la tarjeta de última captura ofrece **Anular**. **Mis capturas** lista las 30 más recientes propias, cada una anulable con confirmación.
7. **Notas de campo:** el auditor puede editar las notas de la auditoría.
8. **Se eliminan:** los modos Unidad (+1), Caja y Fijar total.

## 9. Modo sin conexión y bandeja local

- **Primera apertura:** con señal, para descargar al teléfono la auditoría, el catálogo y los totales (caché persistente de Firestore). La sesión de Google se restaura sin conexión.
- **Bandeja local** (`localStorage`, clave por usuario y auditoría): cada captura o anulación se registra antes de escribirse, con estado `pending`.
  - Cuando el `commit` se confirma, se elimina.
  - Si el servidor la rechaza, pasa a `rejected` con el motivo.
- **Al iniciar la app** con entradas `pending` sin promesa en memoria (por ejemplo, porque se cerró la app sin señal): ya en línea y tras `waitForPendingWrites()`, se lee del servidor el documento de la captura.
  - Si existe con el estado esperado, se elimina de la bandeja.
  - Si no, se marca `rejected`.
- **Indicador:** "En línea" / "Sin señal · N capturas por subir" / "Subiendo…" / "N capturas no aceptadas".
- **Reintentar:** las capturas rechazadas pueden reintentarse con el mismo ID, por ejemplo si un administrador reabre la auditoría, o descartarse con confirmación.
- **Cierre de sesión:** se bloquea mientras haya escrituras pendientes, porque se enviarían con otra identidad y se rechazarían. Forzarlo exige confirmar la advertencia.

## 10. Flujo del administrador

- **Menú:** Clientes · Auditorías · Equipo · Identidad.
- **Clientes:** alta y edición; archivar en lugar de eliminar si tiene auditorías; ver archivadas.
- **Nueva auditoría:** empresa y mes; estado `draft`, invisible para auditores.
- **Cargar catálogo:**
  - Se reutilizan `eleventaParser` e `importWorker`.
  - Muestra un resumen (productos, departamentos y cuántos tienen costo en cero) antes de escribir los bloques de `catalog` y `pricing` en lotes de hasta 400 operaciones.
  - Solo se permite en `draft`. Regresar una auditoría de `in_progress` a `draft` solo es posible si no tiene capturas (verificado con una consulta `limit(1)`); al hacerlo se borran los 16 documentos `counts`, que se recrean al volver a abrir el conteo.
- **Asignar:** seleccionar auditores activos del Equipo.
- **Abrir conteo:** crea los 16 documentos `counts` y pasa a `in_progress`.
- **Seguimiento en vivo:**
  - Avance por departamento.
  - Tabla de inventario con costos y precios. El conteo se modifica mediante el mismo flujo de captura y anulación.
  - El administrador puede editar departamento, costo y precio de un producto; se reescribe su bloque.
  - Bitácora de capturas paginada.
  - Contador de capturas del día: consulta de conteo sobre el grupo `captures` desde la medianoche del Pacífico, mostrado frente a la referencia de unas 9,000 al día.
- **Terminar o forzar el cierre:**
  - Confirmación con el número de productos pendientes, que se reportan como pendientes y no como merma.
  - Pasa a `completed` y escribe `private/summary`. `countedBy` se obtiene con una consulta de conteo agregada (`count()`, `where by == correo` y `voided == false`) por cada miembro del equipo y cada administrador, sin leer las capturas una por una.
  - **Reabrir** vuelve a `in_progress`.
  - **Cerrar** deja la auditoría `closed`, de solo lectura, y reescribe el resumen.
- **Balance y reportes:**
  - `AuditSummary`, `DepartmentSummary`, `ExportModal` (dictamen e impresión), reporte Excel y archivo de ajuste.
  - El dictamen agrega "Contado por" con los auditores y su número de capturas.
- **Historial del cliente:**
  - Tabla con un renglón por auditoría: periodo, estado, cobertura, merma al costo y a precio de venta, sobrante y productos con diferencia. Se alimenta de los `private/summary`.
  - Gráfica SVG de merma por mes.
  - Se conserva la comparativa con el mes anterior y las mermas recurrentes; los productos del mes anterior se cargan bajo demanda.
- **Equipo:** alta (Gmail y nombre), activar/desactivar, auditorías asignadas por persona. Los administradores se muestran en solo lectura.
- **Identidad:** membrete existente con el logo reducido.
- **Respaldo:** "Descargar respaldo JSON" de una auditoría (catálogo, precios, totales, capturas y resumen).
- **Eliminar auditoría:** confirmación con número de capturas; borra subcolecciones en lotes con progreso y después el documento.

## 11. Cuotas del plan gratuito

| Recurso (por día, salvo almacenamiento) | Límite Spark | Uso estimado |
|---|---|---|
| Escrituras | 20,000 | 2 por captura o anulación; catálogo de 5,000 productos ≈ 20 |
| Lecturas | 50,000 | abrir una auditoría ≈ 30; 1 por captura por cada dispositivo conectado a la auditoría |
| Almacenamiento | 1 GiB | tienda de 3,000 productos con 3,500 capturas ≈ 1.5 MB |

**Escenario de referencia:** dos tiendas de 3,000 productos, 2 auditores cada una y un administrador mirando son unas 7,000 capturas, es decir ≈14,000 escrituras y ≈28,000 lecturas.

**Techo práctico:** unas 9,000 capturas al día entre todas las auditorías.

**Al rebasarlo:** Firestore rechaza escrituras hasta el reinicio de la cuota (medianoche del Pacífico, 1–2 a. m. en México). La bandeja local conserva las capturas y se reintentan después.

**Hosting:** 10 GB de almacenamiento y 360 MB al día de transferencia. La app pesa unos 1.2 MB y el service worker la guarda en caché.

## 12. Organización del código

Unidades nuevas, cada una con un propósito y una interfaz pequeña:

| Módulo | Propósito |
|---|---|
| `src/firebase/config.ts` | Configuración web pública y `ADMIN_EMAILS` |
| `src/firebase/app.ts` | Inicializa app, Auth y Firestore (caché persistente; emuladores con `VITE_USE_EMULATORS`) |
| `src/auth/useSession.ts` | Login y logout de Google; rol `loading` / `signed-out` / `admin` / `auditor` / `no-access` |
| `src/domain/catalogChunks.ts` | **Puro.** `Product[]` → bloques de catálogo y precios; y de vuelta |
| `src/domain/countBuckets.ts` | **Puro.** `bucketFor(code)` (FNV-1a % 16) y `mergeCounts(buckets)` |
| `src/domain/auditProducts.ts` | **Puro.** Une catálogo, precios opcionales, totales y descripciones de no registrados en `Product[]` |
| `src/domain/captureRules.ts` | **Puro.** Valida captura y anulación; calcula deltas (lo usan el cliente y las pruebas) |
| `src/counting/outbox.ts` | Bandeja local con adaptador de almacenamiento inyectable; reconciliación |
| `src/data/*.ts` | Repositorios finos tipados: `team`, `companies`, `profile`, `audits`, `catalog`, `counts`, `captures`, `summary` |
| `src/counting/useCounting.ts` | Orquesta capturas y anulaciones en lote, bandeja y estado de sincronización |
| `src/screens/*` | `SignIn`, `NoAccess`, `MyAudits`, `Count`, `admin/Companies`, `admin/Team`, `admin/AuditDetail`, `admin/ClientHistory`, `admin/Identity` |
| `src/components/CaptureFlowModal.tsx` | Pasos cantidad → confirmación (evoluciona `QuantityKeypadModal`) |

**Se reutilizan:**
- Lógica: `eleventaParser`, `importWorker`, `eleventaExporter`, `auditState`, `scannerState` (antirrebote y estadísticas por departamento), `audioService`, `fileDownload`.
- Componentes: `AuditSummary`, `DepartmentSummary`, `MonthlyComparison`, `ExportModal`, `BrandLogo`, `CustomIcons`, `InstallApp`.
- La parte de cámara de `BarcodeScanner`, separada de los modos eliminados.
- `InventoryTable` y `ProductEditor` para el administrador.

**Se retiran:**
- `storageIndexedDB.ts`, `useAuditStore.ts` (lo sustituyen repositorios y hooks), `PinAuthModal.tsx`.
- Restauración del respaldo maestro, `CompanyManager.tsx` (sustituido por `admin/Companies`), `AuditContext.tsx` (sustituido por la cabecera de `AuditDetail`).
- `scripts/local-server.mjs`, `scripts/terminal-qr.mjs`, `Iniciar-Auditor.bat`, `LEEME-LOCAL.md`, `vercel.json`.
- Los modos de escaneo y `CountMode 'set'`.
- El servidor estático de pruebas se reubica en `tests/static-server.mjs`, con la protección de rutas actual y sus pruebas.

## 13. Pruebas

1. **Unitarias** (`npm test`, `node --test`):
   - Las 44 existentes, ajustadas a los módulos retirados.
   - Bloques de catálogo de ida y vuelta.
   - `bucketFor` estable y `mergeCounts`.
   - `auditProducts` con no registrados y ceros confirmados.
   - `captureRules`.
   - Bandeja: pendiente → confirmada, rechazada, reconciliación al iniciar.
   - Coincidencia de `ADMIN_EMAILS` con `firestore.rules`.
2. **Reglas** (`npm run test:rules`: `firebase emulators:exec --only firestore` + `@firebase/rules-unit-testing`). Matriz de actores (administrador, auditor asignado, no asignado, desactivado, cuenta desconocida, sin sesión) contra cada ruta, más intentos de abuso:
   - Leer `pricing`, `private` o `companies`.
   - Autoasignarse o cambiar `status`.
   - Escribir `counts` sin captura, con delta distinto o en otra clave.
   - Anular capturas ajenas o anular dos veces.
   - Escribir en auditorías `draft`, `completed` o `closed`.
   - Falsificar `by` o `at`.
3. **Campo en navegador** contra los emuladores de Auth y Firestore, con login de Google simulado:
   - Flujo completo de administrador y de auditor.
   - Dos auditores simultáneos con totales consistentes.
   - Sin conexión (`disableNetwork`) y resincronización.
   - Captura rechazada tras cerrar la auditoría.
   - Ausencia de desbordes y verificación axe.
4. **Revisión de seguridad** con la skill `security-critic-audit` antes de publicar.

## 14. Puesta en marcha (acciones del usuario)

1. Crear un proyecto en console.firebase.google.com (plan Spark).
2. Authentication → Método de acceso → Google → Habilitar.
3. Firestore Database → Crear en modo producción, región `nam5`.
4. Configuración del proyecto → Agregar app web → copiar la configuración.
5. Proporcionar el Gmail de administrador del propietario y el de Charlie.
6. Ejecutar `npx firebase login` una vez. Publicar con `npm run deploy` (reglas, índices y hosting).

Se entregará `docs/puesta-en-marcha.md` con estos pasos y capturas de referencia en texto.

## 15. Fases de implementación

1. **Base:**
   - Dependencias (`firebase`; `firebase-tools` y `@firebase/rules-unit-testing` como desarrollo), `firebase.json`, emuladores, `src/firebase/*`, `useSession`.
   - Pantallas `SignIn` y `NoAccess`.
   - Reglas e índices con su suite de pruebas.
   - Módulos de dominio puros.
   - Repositorios.
   - Clientes, Equipo, Auditorías (crear, catálogo, asignar, abrir).
2. **Conteo:**
   - `MyAudits`, `Count`, `CaptureFlowModal`, anulación y Mis capturas.
   - Bandeja local, indicador de sincronización y notas de campo.
3. **Cierre y reportes:**
   - Terminar, forzar, reabrir y cerrar, con `private/summary`.
   - Balance, dictamen y Excel desde la nube; historial del cliente; respaldo JSON; eliminar auditoría.
   - Retiro de módulos antiguos, guía de puesta en marcha y publicación.

## 16. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Rebasar cuotas diarias | Contador diario visible, bandeja local, estimaciones de la sección 11 |
| Google cambia el plan gratuito | Sin dependencias de productos de pago; respaldo JSON por auditoría |
| Sin respaldos automáticos en Spark | Recomendar descargar el respaldo JSON al cerrar cada auditoría |
| Errores en reglas | Suite de reglas con matriz de actores e intentos de abuso; revisión de seguridad |
| Escrituras sin conexión de otra cuenta en el mismo teléfono | Bloquear el cierre de sesión con escrituras pendientes |
| Región de Firestore irreversible | Elegir `nam5` y documentarlo |
| Pérdida de acceso a un correo de administrador | El otro administrador o la consola de Firebase permiten editar las reglas |
| Sin política CSP estricta (el login de Google requiere iframes y ventanas de Google) | Encabezados `X-Content-Type-Options`, `Referrer-Policy` y `Permissions-Policy: camera=(self)`; CSP queda como mejora posterior |
