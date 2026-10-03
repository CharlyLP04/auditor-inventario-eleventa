# Informe de auditoría técnica · Auditor de inventario eleventa

- **Fecha:** 2026-10-03
- **Rama:** `feature/audit-system-improvements` (parte de `feat/login-roles-firebase` = `main` 13ef924 + 3 commits de documentación)
- **Objetivo del negocio:** que dos personas (Oscar con Motorola Edge 50 Neo, Charly con iPhone 17 Pro) cuenten la misma auditoría a la vez, cada una con su sesión y sus departamentos, sin recontar y sin respaldos manuales.
- **Skills aplicadas:** `ecc:production-audit` (lente de preparación para producción y puntaje), `ecc:security-review` (lista de verificación de seguridad), `security-critic-audit` y `ux-craft-delight` (del proyecto), `engineering:architecture` (ADR).

## 1. Método y evidencia

| Evidencia | Resultado |
|---|---|
| `git status` / ramas | Árbol limpio; `main` = `origin/main` = 13ef924; sin stashes ni conflictos |
| Lectura completa de `src/` (27 archivos), `public/sw.js`, `vercel.json`, pruebas y documentación | Ver hallazgos |
| `npm run lint` | 0 avisos |
| `npm test` | 44/44 pruebas en verde |
| `npm run build` | Correcto; módulos diferidos de 317 kB (núcleo), 388 kB (escáner), 366 kB (exportación) y 367 kB (worker de importación) |
| `npm audit` | 0 vulnerabilidades |
| `npm outdated` | Solo versiones menores (vite 8.3.2, lucide 1.51, oxlint 1.86) |
| `curl -I` a producción | Solo `Strict-Transport-Security`; sin CSP ni otras cabeceras |
| Prueba de rendimiento en Node (20,000 productos) | 2.1 ms de CPU por escaneo; cada escaneo reescribe 3.27 MB de la auditoría en IndexedDB |
| Sondas del importador con archivos sintéticos | Ver H-03 |
| Suite de campo en navegador (última ejecución sobre el mismo código) | 28/29; la falla es el registro del service worker en el panel integrado, una limitación del entorno |

**Convención:** *Comprobado* = reproducido o visible en el código; *Hipótesis* = plausible, pero no medido; *Mejora* = recomendación sin defecto.

## 2. Arquitectura actual (diagnóstico)

```
Navegador (PWA React 19 + Vite)
 ├─ App.tsx ── pestañas: Clientes · Contar · Auditoría · Balance · eleventa
 ├─ useAuditStore (estado único, bloqueo de escritura, roles por PIN)
 │    └─ storageIndexedDB: companies, audits (cada auditoría = 1 registro con TODOS sus productos), app_settings
 ├─ services: eleventaParser (+ worker), auditState (estadísticas), scannerState (conteo, deshacer),
 │            eleventaExporter (Excel), audioService
 └─ sw.js (precaché versionado en el build)
Vercel: hospedaje estático. No hay servidor, base de datos ni autenticación remota.
```

**Fortalezas que conviene conservar:**
- Validación estricta de datos guardados y de respaldos.
- Importación atómica: si una fila falla, no se reemplaza nada.
- Control optimista por revisión en IndexedDB, que protege de dos pestañas a la vez.
- Separación entre pendiente y cero confirmado.
- Pruebas puras de la lógica.
- Diseño táctil de 48 px.

**Límite estructural:** todo el estado vive en el navegador de un solo dispositivo. La única forma de pasar datos de un equipo a otro es el respaldo JSON, y restaurarlo **reemplaza** el espacio de trabajo completo (`restore` → `change(..., replace = true)`). No existe ningún mecanismo de fusión. Es la causa raíz de que la auditoría anterior tomara dos días con un solo teléfono.

## 3. Hallazgos

Severidad: Crítico · Alto · Medio · Bajo. P = probabilidad estimada.

### Concurrencia, sincronización y datos

**H-01 · Alto · Comprobado · P: segura si se usan dos teléfonos.** No hay colaboración entre dispositivos.
- **Evidencia:** `storageIndexedDB.ts` guarda todo localmente; `useAuditStore.restore` reemplaza todo (`replace = true`); el README dice "PC y celular **no se sincronizan**".
- **Impacto:** dos teléfonos producen dos auditorías divergentes. Fusionarlas a mano con respaldos sobrescribe los conteos de uno de los dos.
- **Recomendación:** un servidor común con capturas sumables e idempotentes, sesiones por persona y reglas de acceso en el servidor (ver ADR-0002).
- **Archivos:** `storageIndexedDB.ts`, `useAuditStore.ts`, `types/index.ts`.
- **Pruebas:** dos clientes contra el emulador (escenarios 1 a 9 de la sección 12 del encargo).

**H-02 · Alto · Comprobado · P: alta en iPhone.** Safari puede borrar los datos de Charly.
- **Evidencia:** en iPhone, Safari borra IndexedDB tras 7 días sin interacción si la app no está en la pantalla de inicio. `InstallApp.tsx` solo aparece con `beforeinstallprompt`, un evento que iOS nunca emite, así que en iPhone no hay ninguna guía para instalar. Tampoco se llama a `navigator.storage.persist()` en ningún lugar.
- **Impacto:** se pierden el historial y una auditoría en curso.
- **Recomendación:** guía de instalación para iOS, solicitar almacenamiento persistente y, con H-01 resuelto, que la fuente de verdad sea el servidor.
- **Pruebas:** unitaria de detección de iOS; prueba física pendiente en el iPhone.

**H-03 · Alto · Comprobado · P: media, depende del archivo.** El importador deja precio o costo en **$0 sin avisar**.
- **Evidencia:** sonda con `Código,Descripción,Existencia,Precio Público,Costo Promedio,Marca` → `price: 0, cost: 0, errors: []`. En `eleventaParser.ts`, si no se encuentra una columna, `numeric(undefined)` devuelve 0. Las columnas desconocidas, como "Marca", se descartan sin informar.
- **Impacto:** el balance a precio de venta da $0 y la exportación de ajuste lleva precios en cero a eleventa.
- **Recomendación:**
  - Ampliar los sinónimos.
  - Advertir cuando faltan precio o costo, y nunca inventar 0.
  - Vista previa con mapeo de columnas.
  - Informar las columnas no utilizadas.
- **Pruebas:** unitarias del mapeo, de las advertencias y de la vista previa.

**H-04 · Alto · Comprobado.** El botón **Buscar** del escáner **cuenta** lo que se escribe.
- **Evidencia:** `BarcodeScanner.handleManualSubmit` → `handleDetectedCode(texto)` → `applyCount`. Si el texto no es un código, `applyCount` crea "Producto no registrado (coca cola)" con 1 pieza.
- **Impacto:**
  - Se crean productos fantasma que aparecen en el reporte.
  - El botón dice "Buscar", pero no busca: no hay forma de encontrar un producto por su descripción desde la pantalla de conteo.
- **Recomendación:** un buscador real por código, clave y descripción. Un código desconocido nunca se cuenta sin confirmación.
- **Pruebas:** unitarias de búsqueda y de campo ("Buscar texto no cuenta").

**H-05 · Medio · Comprobado.** Un código no encontrado se cuenta en automático y no se puede gestionar.
- **Evidencia:** en `scannerState.applyCount` (línea 21), cualquier lectura desconocida (lectura parcial, código interno) crea un producto. No se le puede poner nombre ni nota, y solo se puede llevar a 0: sigue en el reporte como "NO REGISTRADO" y no existe forma de quitarlo.
- **Recomendación:**
  - Panel rojo de "no encontrado" que pide confirmar, nombre, nota y cantidad.
  - Edición posterior.
  - Exclusión lógica con historial.
  - Relacionarlo después con un producto del catálogo.
- **Pruebas:** unitarias del modelo y flujo de campo.

**H-06 · Medio · Comprobado.** No hay trazabilidad de quién hizo qué.
- **Evidencia:** `Product` solo guarda `lastScannedAt`; el tipo `ScanLog` está declarado, pero no se usa en ninguna parte (código muerto). Deshacer cubre un solo nivel.
- **Impacto:** no se puede reconstruir un conteo ni resolver una disputa con la tienda.
- **Recomendación:** bitácora de actividad (autor, hora, acción y cantidad); en la nube, capturas append-only.
- **Pruebas:** unitarias de bitácora.

**H-07 · Medio · Hipótesis (falta medir en el teléfono).** Cada escaneo reescribe la auditoría completa.
- **Evidencia:** `recordCount` hace `writeWorkspace(...)` y `audits.put(a)` con los 20,000 productos: 3.27 MB por escaneo. La CPU medida es de 2.1 ms; la E/S de IndexedDB en un móvil de gama media no está medida.
- **Impacto:** latencia y desgaste con catálogos grandes.
- **Recomendación:** en el modelo de nube, guardar capturas pequeñas; en local, medir en el teléfono antes de optimizar.

**H-08 · Medio · Comprobado.** Los departamentos no tienen dueño ni estado.
- **Evidencia:** "Zona activa" es una preferencia del dispositivo (`scannerPreferences.activeZoneDepartment`). Solo advierte y no se comparte.
- **Recomendación:** asignación persistente por departamento (pendiente, en curso o completado) con exclusión mutua en el servidor.

### Balance e informes

**H-09 · Medio · Comprobado.** El balance prioriza el **costo**, y el requisito es el **precio de venta**.
- **Evidencia:**
  - `AuditSummary.tsx:15` elige "costo" por omisión, salvo que algún producto tenga costo 0.
  - En `ExportModal.tsx`, los indicadores principales del dictamen dicen "Al costo de adquisición".
  - El historial de clientes muestra los dos valores.
- **Recomendación:** venta por omisión y como cifra principal; el costo queda como dato secundario.

**H-10 · Medio · Comprobado.** Mezcla de costo y venta en una misma columna.
- **Evidencia:** en `InventoryTable.tsx:209`, el importe de cada fila es `diff * (p.cost || p.price)`. Unas filas quedan valoradas al costo y otras a venta dentro de la misma lista.
- **Recomendación:** valorar siempre a precio de venta.

**H-11 · Medio · Comprobado.** El balance no permite verificar la carga del catálogo.
- **Evidencia:** no muestra productos esperados contra encontrados, filas omitidas en la importación, no encontrados agregados ni departamentos completados.
- **Recomendación:** panel de verificación de importación y de avance.

### Seguridad

**H-12 · Medio · Comprobado.** El PIN de administrador es un control de interfaz, no de seguridad.
- **Evidencia:** el PIN inicial es `1234`, se guarda en texto plano en IndexedDB (`security.adminPin`) y se compara en el cliente. Las guardas `requireAdmin` corren en el mismo navegador.
- **Impacto:** cualquiera con el teléfono, o con la consola del navegador, puede editar precios. Hoy el riesgo es acotado porque los datos son locales; con colaboración en la nube sería **crítico** si se conservara este esquema.
- **Recomendación:** autenticación real con roles verificados por las reglas del servidor; el PIN deja de ser la frontera.

**H-13 · Medio · Comprobado.** Faltan cabeceras de seguridad en producción.
- **Evidencia:** `curl -I` muestra solo HSTS; faltan CSP, `X-Frame-Options`/`frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy` y `Permissions-Policy`. `vercel.json` no define cabeceras.
- **Impacto:** la app podría incrustarse en otro sitio (clickjacking), y no hay una política que limite scripts y conexiones.
- **Recomendación:** cabeceras en `vercel.json` con una CSP compatible con el escáner y, después, con Firebase.

**H-14 · Bajo · Comprobado.** Los respaldos JSON contienen costos y precios del cliente sin cifrar.
- **Evidencia:** `backup()` exporta todo el espacio de trabajo.
- **Recomendación:** advertirlo en la interfaz; con la nube, los respaldos dejan de ser el canal de transferencia.

### Calidad, dependencias y operación

**H-15 · Bajo · Comprobado.** `html5-qrcode` 2.3.8 no recibe cambios desde el 2023-04-15.
- **Impacto:** riesgo de compatibilidad futura con iOS.
- **Recomendación:** mantenerla por ahora, porque funciona y no tiene vulnerabilidades conocidas. Evaluar `BarcodeDetector` nativo en Android con respaldo a la librería.

**H-16 · Bajo · Comprobado.** Código muerto: `ScanLog` y la preferencia `cooldownMs`, fijada en 1800 y validada, pero sin usar.

**H-17 · Bajo · Comprobado.** Dos hojas se llaman `Ajuste_Inventario_eleventa` con columnas distintas: la del reporte y la del archivo de ajuste.

**H-18 · Bajo · Comprobado.** No hay CI: el lint y las pruebas dependen de correrlos a mano.

**H-19 · Bajo · Comprobado.** No hay observabilidad.
- **Evidencia:** los errores solo se muestran en pantalla; no hay registro persistente para diagnosticar después de una jornada.
- **Recomendación:** bitácora local de errores exportable con el respaldo; con la nube, registro de actividad por auditoría.

**H-20 · Bajo · Comprobado.** El buscador de la tabla de Auditoría no ignora acentos ni el orden de las palabras.
- **Evidencia:** usa `includes` sobre `toLocaleLowerCase`; "cafe" no encuentra "Café" y "molido cafe" no encuentra "Café molido".

### Accesibilidad e identidad visual

**H-21 · Bajo · Comprobado.** Contraste insuficiente en el texto de ayuda.
- **Evidencia:** el placeholder `#777777` sobre `#202020` da un contraste aproximado de 4.0:1, menor a 4.5:1. Hay etiquetas de 10 px en el balance.
- El texto secundario `#888888` sobre `#161616` sí pasa (≈5.1:1). Los estados de inventario ya combinan texto, símbolo y color (✓ ↓ ↑ ⚠), lo cual es correcto.

**O-01 · Observación de marca, no es un defecto.** La app usa la paleta "Obsidian" (fondo #161616, naranja #FF6E42 y arena #B38F6F) con un isotipo propio (prisma); el sello Grid.mx aparece en el dictamen. El logotipo oficial de Grid es blanco y verde sobre negro.
- **Decisión:** conservar la paleta actual como identidad de la app y usar el verde de Grid solo como color semántico de "encontrado". Así se cumple el requisito verde, rojo y amarillo sin introducir otra identidad.

## 4. Puntaje de preparación (ecc:production-audit)

**Auditoría de producción: 64/100, riesgosa para el objetivo de dos dispositivos.** El uso actual con un solo teléfono funciona, pero:
- no hay colaboración (H-01);
- el iPhone puede perder datos (H-02);
- el importador puede valorar en $0 sin avisar (H-03).

El tope de 69 aplica porque la autorización (PIN en el cliente) no protegería datos compartidos (H-12).

**Bloqueantes para la próxima auditoría colaborativa:** H-01, H-02, H-03, H-04 y H-12 (al pasar a la nube).

## 5. Priorización

| Fase | Hallazgos y funciones | Por qué en ese orden |
|---|---|---|
| 3 · Correcciones | H-03, H-04, H-05, H-09, H-10, H-02 (parte local), H-13, H-16, H-20 | Bajo riesgo, sin dependencias de infraestructura; corrigen la integridad de datos y lo que hoy confunde en campo |
| 4a · Funciones locales | Buscador, no encontrados, indicadores de escaneo, balance, vista previa y mapeo de importación | Necesarias con o sin nube; se diseñan con un modelo compatible con la sincronización |
| 4b · Colaboración | H-01, H-06, H-08, H-12, H-19 | Requiere decidir la infraestructura (ADR-0002): costo $0, datos en Google Cloud y cuentas por persona |
| 5 · Validación | Pruebas unitarias, de reglas (emulador), de campo y físicas | Las pruebas físicas en iPhone y Motorola quedan a cargo del equipo |

## 6. Estado de los hallazgos

El estado de cada hallazgo se actualiza en [`estado-hallazgos.md`](estado-hallazgos.md) conforme se corrige.
