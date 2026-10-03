# Estado de los hallazgos y evidencia de pruebas

- **Actualizado:** 2026-10-03 · **Rama:** `feature/audit-system-improvements`
- **Informe de origen:** [2026-10-03-informe-auditoria.md](2026-10-03-informe-auditoria.md)

## Estado

| ID | Sev. | Estado | Qué se hizo / qué falta | Commit |
|---|---|---|---|---|
| H-01 | Alto | **Pendiente de decisión** | Diseño y ADR-0002 listos; implementar requiere aprobar Firebase (costo $0, datos en Google Cloud) | 6e12ee3 |
| H-02 | Alto | Mitigado (parte local) | Guía de instalación en iPhone y solicitud de almacenamiento persistente. Se resuelve de fondo con H-01 (servidor como fuente de verdad) | 265e89d |
| H-03 | Alto | **Corregido** | Sinónimos, avisos de precio y costo faltantes, columnas sin usar, mapeo manual, vista previa, todas las filas omitidas con motivo y aceptación explícita | 5882164 |
| H-04 | Alto | **Corregido** | Buscador real; una descripción nunca crea productos | 5882164 |
| H-05 | Medio | **Corregido** | Panel de no encontrado con nombre, nota, cantidad y departamento; edición, vínculo con el catálogo, exclusión lógica y reincorporación | 5882164 |
| H-06 | Medio | Corregido (local) | Bitácora de actividad por auditoría (acción, código, cantidad, actor y hora). En la nube, el actor será la persona autenticada | 5882164 |
| H-07 | Medio | Abierto (hipótesis) | Medir en el teléfono. La bitácora agrega como máximo unos 3 MB por escritura en catálogos grandes; en la nube cada escaneo es un documento pequeño | — |
| H-08 | Medio | Pendiente de decisión | Requiere H-01 (asignación compartida con exclusión mutua) | — |
| H-09 | Medio | **Corregido** | El balance y el dictamen usan precio de venta como cifra principal; el costo queda como referencia | 5882164 |
| H-10 | Medio | **Corregido** | Los importes por fila se valoran siempre a precio de venta | 5882164 |
| H-11 | Medio | **Corregido** | Panel "Verificación del inventario" en el balance | 5882164 |
| H-12 | Medio | Pendiente de decisión | El PIN sigue siendo un control de interfaz; con H-01 lo reemplazan cuentas y reglas del servidor | — |
| H-13 | Medio | **Corregido** | CSP y cabeceras en `vercel.json` y en el servidor local, con una prueba que exige que coincidan. Se aplica en producción al desplegar | 265e89d |
| H-14 | Bajo | Abierto | Con la nube, el respaldo deja de ser el canal de transferencia | — |
| H-15 | Bajo | Abierto (aceptado) | `html5-qrcode` funciona y no tiene vulnerabilidades conocidas | — |
| H-16 | Bajo | **Corregido** | Se eliminaron `ScanLog` y `cooldownMs`; los respaldos viejos que lo traen siguen siendo válidos | 5882164 |
| H-17 | Bajo | Abierto | Renombrar la hoja cambiaría un formato que el equipo ya usa; se deja documentado | — |
| H-18 | Bajo | Abierto | Agregar CI requiere decidir el flujo en GitHub | — |
| H-19 | Bajo | Parcial | La bitácora cubre las acciones; falta un registro de errores | — |
| H-20 | Bajo | **Corregido** | La búsqueda ignora acentos, mayúsculas y el orden de las palabras | 5882164 |
| H-21 | Bajo | Parcial | Placeholder y textos secundarios del escáner, la importación y la instalación con más contraste; quedan etiquetas de 10 px en el balance anterior | 5882164 |
| H-22 | Medio | **Corregido** | En el teléfono, la cabecera fija ocupaba unos 255 de 812 px sobre el escáner; ahora se desplaza con el contenido | 5882164 |

## Evidencia de pruebas (TDD)

**ROJO:** commit `96598c9`. `npm test` dio 11 fallas esperadas:
- `productSearch` y `unregisteredProducts` no existían;
- el importador no reportaba filas omitidas ni columnas, y no aceptaba mapeo.

**VERDE:** commit `5882164`. `npm test` dio **82/82**; `tsc -b` y `oxlint` terminaron sin errores.

| # | Garantía | Prueba | Tipo | Resultado |
|---|---|---|---|---|
| 1 | Un código desconocido nunca se cuenta sin confirmación | `tests/unregistered.test.mjs` · *unknown code is never counted silently* | unitaria | PASA |
| 2 | Un mismo no encontrado registrado dos veces se suma, no se duplica | *registering the same not-found code twice…* | unitaria | PASA |
| 3 | Excluir es reversible y conserva la cantidad; los excluidos no suman | *excluding is reversible…* | unitaria | PASA |
| 4 | Vincular un no encontrado mueve sus piezas al catálogo y deja la traza | *linking a not-found product…* | unitaria | PASA |
| 5 | La verificación separa esperados, encontrados, pendientes, no encontrados y excluidos, y valora a venta | *catalog verification…* | unitaria | PASA |
| 6 | La búsqueda encuentra por código, clave y palabras sin acentos y en cualquier orden, en menos de 30 ms con 20,000 productos | `tests/search.test.mjs` | unitaria / rendimiento | PASA |
| 7 | Un EAN-13 con cero inicial coincide con su UPC de 12 dígitos; los códigos cortos nunca | *scanned EAN-13…*, *short codes…* | unitaria | PASA |
| 8 | El importador reporta todas las filas inválidas y los duplicados con su fila de origen | `tests/audit.test.mjs` · *every invalid row…*, *duplicate code rows…* | unitaria | PASA |
| 9 | Si faltan las columnas de precio o costo, se advierte; las columnas sin usar se listan | *a missing sale price…*, *unknown columns…* | unitaria | PASA |
| 10 | El mapeo manual reemplaza la detección y rechaza una columna asignada a dos campos | *a manual column mapping…* | unitaria | PASA |
| 11 | `vercel.json` publica las mismas cabeceras que el servidor local, sin `unsafe-eval` | `tests/server.test.mjs` | unitaria | PASA |
| 12 | Flujos de interfaz bajo la CSP: verde al encontrar, amarillo por zona, rojo sin contar ante un código desconocido, registro de un no encontrado, buscar sin crear productos, excluir y reincorporar con bitácora, vista previa de importación con aceptación explícita y verificación en el balance | `tests/field-browser.js` (puerto 5191) | E2E en navegador | 34/35 |

La falla de la suite de campo es "Caché sin conexión": el panel de navegador integrado no registra service workers (limitación conocida del entorno). Se verifica en Chrome o Edge.

## Pruebas físicas pendientes (a cargo del equipo)

- [ ] iPhone 17 Pro: instalar en la pantalla de inicio, usar cámara y linterna, ver los estados verde, rojo y amarillo, y registrar un no encontrado.
- [ ] Motorola Edge 50 Neo: los mismos pasos, la vibración diferenciada y la velocidad de escaneo con un catálogo real.
- [ ] Importar el archivo real de eleventa del cliente y comparar el total de filas con la verificación del balance.
- [ ] Revisar en producción las cabeceras (`curl -I`) y que la cámara funcione con la CSP desplegada.
