# Diseño técnico · Auditoría colaborativa en varios dispositivos

- **Estado:** Aprobado (2026-10-03), según [ADR-0002](../adr/0002-colaboracion-en-tiempo-real-con-sesiones-por-persona.md)
- **Fecha:** 2026-10-03
- **Alcance:** fases 4b y 5 del [informe de auditoría](../auditoria/2026-10-03-informe-auditoria.md)
- **Reemplaza a:** `docs/superpowers/specs/2026-09-30-login-roles-firebase-design.md`, que asumía login con Google

## 1. Arquitectura objetivo

```
Teléfono / PC (PWA)
 ├─ Modo local (actual, IndexedDB)  ← se conserva sin cambios para clientes sin nube
 └─ Modo nube
     ├─ Firebase Auth (correo + contraseña, sesión persistente en el dispositivo)
     ├─ Firestore SDK con caché persistente y cola de escrituras sin conexión
     └─ useCloudAudit(auditId) → expone la misma forma { products, recordCount, … }
        que consumen BarcodeScanner, InventoryTable y AuditSummary
Firebase (plan Spark)
 ├─ firestore.rules (membresía, roles, inmutabilidad del historial)
 └─ Emulador local para pruebas de reglas y de concurrencia
```

Los componentes de interfaz ya reciben `products` y callbacks. El modo nube reemplaza la fuente de datos, no las pantallas.

## 2. Modelo de datos (Firestore)

| Ruta | Contenido | Escritura |
|---|---|---|
| `members/{uid}` | `name`, `role: admin\|auditor`, `active` | Solo admin |
| `companies/{companyId}` | Datos del cliente (igual que hoy) | Admin |
| `settings/profile` | Membrete | Admin |
| `audits/{auditId}` | `companyId`, `period`, `status`, `createdBy`, `notes`, `catalog: { chunks, products, importedAt, importedBy, fileName, report }` | Admin; notas, cualquier miembro |
| `audits/{id}/catalog/{n}` | Hasta 500 productos del catálogo, sin conteos | Admin |
| `audits/{id}/counts/{b}` (16 cubetas) | `q.{código}`: total contado; `n.{código}`: número de capturas | Miembros, solo con `increment` |
| `audits/{id}/captures/{captureId}` | `code`, `delta`, `mode`, `observed`, `by`, `byName`, `at` (servidor), `clientAt` (ISO 8601), `device`, `department`, `voids?` | Miembros: **solo crear** y solo con `by == uid`; nadie puede editar ni borrar |
| `audits/{id}/departments/{key}` | `name`, `assignee`, `assigneeName`, `status: pending\|in_progress\|done`, `updatedBy`, `updatedAt` | Transacción; reglas de propiedad (sección 4) |
| `audits/{id}/unregistered/{codeKey}` | `code`, `name`, `note`, `createdBy`, `excluded`, `excludedBy`, `excludedAt`, `reason`, `linkedTo?` | Miembros; nunca se borra |
| `audits/{id}/events/{eventId}` | Bitácora: asignaciones, cambios de estado, ediciones y exclusiones | Miembros: solo crear |

**Cubetas:**
- Un código se asigna a su cubeta con `fnv1a(código) % 16`.
- Un dispositivo que abre la auditoría lee 16 documentos en lugar de miles de capturas.
- Las cubetas se crean con la auditoría, porque `update` falla sobre un documento que no existe.
- Se excluyen del índice los campos `q` y `n`, que no se consultan.

## 3. Concurrencia e integridad

| Situación | Estrategia | Qué prevalece |
|---|---|---|
| Dos personas, productos distintos | Escrituras independientes; `increment` en la cubeta | Ambas |
| Dos personas suman al mismo producto | `increment` atómico en el servidor | **La suma de ambas.** Nada se sobrescribe |
| Corrección "Fijar total" | Se guarda como `delta = objetivo − observado`, con `observed` en la captura | Se conservan las capturas concurrentes del otro; la app marca el producto como **conflicto a revisar** (amarillo) si hubo capturas ajenas entre lo observado y la confirmación |
| Reintento tras desconexión | ID de captura generado en el dispositivo; `set` sobre el mismo ID no duplica la captura | La captura se aplica una sola vez; la cubeta se escribe en el mismo lote atómico |
| Deshacer o anular | Nueva captura con `delta` negativo y `voids: captureId` | El historial queda completo |
| Producto de un departamento ajeno | Aviso amarillo con el nombre del responsable; contar requiere confirmación explícita | La decisión de la persona, registrada en la captura |
| Mismo no encontrado desde dos teléfonos | Documento con ID derivado del código: el segundo intento ve que ya existe y solo suma su cantidad | Un solo registro con dos capturas |

**Verificación:** el balance ofrece "Verificar integridad", que recalcula los totales desde las capturas y los compara con las cubetas. Una diferencia indica una escritura parcial y se informa sin corregirla en silencio.

**Atomicidad:** la captura y su `increment` van en un solo `writeBatch`. Firestore aplica el lote completo o no aplica nada, también cuando sale de la cola sin conexión.

## 4. Reglas de seguridad (resumen)

- `isMember()`: existe `members/{uid}` con `active == true`. `isAdmin()`: además, `role == 'admin'`.
- **Sin membresía no hay lectura ni escritura.** Las cuentas desconocidas reciben `permission-denied`.
- **`captures`:**
  - Solo `create`.
  - `by == request.auth.uid`.
  - `delta` numérico finito, con valor absoluto ≤ 1e9.
  - `code` de tipo string de 1 a 128 caracteres.
  - La auditoría debe estar `in_progress`.
  - `update` y `delete` están prohibidos.
- **`counts`:** solo `update` y solo con cambios en `q` y `n`. La auditoría debe estar en curso.
- **`departments`:**
  - Un auditor solo puede tomar uno libre (`assignee == null`) o soltar el suyo.
  - Marcar "completado" lo puede hacer quien lo tiene asignado.
  - Reasignar lo puede hacer solo un admin, y queda registrado en `events`.
- **`catalog`, `companies` y estado de la auditoría:** solo admin.
- **`unregistered`:** cualquier miembro puede crear y editar `name`, `note` y `excluded`; `delete` está prohibido.
- **Pruebas en el emulador:** no miembro, miembro inactivo, auditor que intenta escalar a admin, captura con otro `by`, edición o borrado de captura, tomar el departamento de otro y escribir en una auditoría cerrada.

## 5. Sin conexión

- `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })`.
- **Contar sin señal está permitido:**
  - las capturas se encolan;
  - el total local se actualiza de forma optimista;
  - un indicador muestra "N capturas por sincronizar" (`hasPendingWrites`).
- **Requiere conexión:** tomar o soltar departamentos (transacción), importar el catálogo y cambiar el estado de la auditoría. La app lo explica en lugar de fallar en silencio.
- **Al volver la señal**, el SDK envía la cola en orden. Las cubetas convergen porque `increment` es conmutativo.
- **Riesgo residual:** si se borran los datos del navegador **antes** de sincronizar, se pierden las capturas pendientes.
  - Mitigación: el indicador de pendientes es visible.
  - Mitigación: al cerrar sesión, la app avisa si quedan pendientes.

## 6. Cuotas (plan Spark)

Supuesto: 20,000 productos y dos personas con 2,000 escaneos cada una por día.

| Concepto | Cálculo | Por día |
|---|---|---|
| Escrituras | 4,000 escaneos × 2 (captura y cubeta) + eventos | ~8,500 de 20,000 |
| Lecturas | Catálogo: 40 documentos por apertura; cubetas: ~2 lecturas por escaneo entre los dos listeners; ~10 aperturas | ~10,000 de 50,000 |
| Almacenamiento | Catálogo ≈ 4 MB + capturas ≈ 1 MB por auditoría | Muy por debajo de 1 GiB |

## 7. Flujos de usuario

1. **Iniciar sesión:** correo y contraseña, una vez por dispositivo; la sesión persiste.
2. **Elegir la auditoría abierta:** la cabecera siempre muestra empresa, periodo, persona y estado de sincronización.
3. **Departamentos:**
   - La lista muestra el responsable y el estado (pendiente, en curso o completado), con texto e icono además del color.
   - "Tomar" usa una transacción; si ya es de otra persona, la app explica quién lo tiene y qué acciones permiten tus permisos.
4. **Contar:**
   - **Encontrado (verde):** muestra la descripción, el departamento y la cantidad, y suma.
   - **No encontrado (rojo):** ofrece agregarlo con nombre, nota y cantidad.
   - **Advertencia (amarillo):** departamento ajeno, conflicto o datos incompletos.
5. **Completar el departamento:** se pide confirmación si quedan productos pendientes.
6. **Balance:** avance por departamento y por persona, esperados contra encontrados, valor a venta, no encontrados, conflictos y verificación de integridad.

## 8. Migración

- **La versión local no se toca.** "Subir a la nube" convierte una auditoría local en una auditoría de nube:
  - catálogo en bloques;
  - cada producto contado se vuelve una captura `mode: 'migrated'` del usuario que sube.
- **No borra ni modifica los datos locales.** Se puede repetir sobre otra auditoría con un ID nuevo.

## 9. Pruebas

| Tipo | Herramienta | Qué cubre |
|---|---|---|
| Unitarias | `node --test` | Cubetas, delta de corrección, detección de conflictos, búsqueda, no encontrados, importación |
| Reglas | Emulador de Firestore + `@firebase/rules-unit-testing` | Sección 4 |
| Concurrencia | Dos clientes del SDK contra el emulador | Escenarios 1 a 9 del encargo: incrementos simultáneos, el mismo producto, el mismo no encontrado, desconexión y reconexión con cola |
| Campo | `tests/field-browser.js` | Flujos de interfaz con datos sintéticos |
| **Físicas, a cargo del equipo** | iPhone 17 Pro y Motorola Edge 50 Neo | Cámara, instalación, señal real y ensayo de dos personas |

## 10. Notas de implementación (2026-10-03)

- **No encontrados:** se escriben con `set` + `merge` y cada persona deja su etiqueta en `labels.<uid>`, así dos teléfonos sin conexión convergen en un solo documento sin pisarse; el nombre y la nota definitivos (`name`, `note`) los fija una edición.
- **Deshacer:** escribe una captura inversa (`mode: undo`, `voids`) y resta también `n` y `u`, para que un producto contado una sola vez vuelva a "pendiente" en lugar de quedar como cero confirmado.
- **Crear auditoría:** primero se escriben catálogo, cubetas y departamentos, y al final, en una transacción que impide duplicados, el documento de la auditoría. Nadie ve una auditoría con el catálogo incompleto, y un reintento sobrescribe los mismos bloques.
- **Subir una auditoría local:** `uploadLocalAudit` crea la auditoría en la nube y una captura `migrated` por producto contado; los datos del dispositivo no se modifican.
- **Fuera de asignación:** contar en un departamento ajeno o libre exige una confirmación; la captura queda con `outsideAssignment: true` y el balance lista los productos capturados por más de una persona.
- **Código:** `src/services/cloud/` (modelo puro, repositorio y configuración), `src/hooks/useCloudSession.ts`, `src/hooks/useCloudAudit.ts`, `src/components/cloud/` y `firestore.rules`.
