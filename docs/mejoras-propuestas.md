# Mejoras propuestas · 4 de noviembre de 2026

## Corrección entregada

El grid de la auditoría admitía el ancho mínimo de su contenido y los filtros horizontales ensanchaban la página. Reproducido con viewport de 360 px y documento de 885 px. La columna ahora usa minmax(0,1fr) y sus hijos pueden encogerse. Se eliminó el límite heredado de 480 px de la navegación del equipo. Se reforzó el ajuste de códigos y nombres largos y la legibilidad de cantidades y datos secundarios.

Prueba local con InventoryTable real y datos ficticios, sin Firebase. Revisados anchos 320, 390, 600, 899, 900 y 1280 px con letra XL: ancho del documento igual al ancho útil, sin desplazamiento horizontal de la página. Los filtros conservan su desplazamiento interno. Probados sumar una unidad y editar/guardar 12 unidades. Pendiente validación en Android/iPhone físicos y teclado virtual real.

## Orden recomendado

| Prioridad | Área | Propuesta | Beneficio y alcance |
|---|---|---|---|
| 1 | Accesos | Recuperación desde la app con correo real verificado, manteniendo el nombre de usuario | Evitar depender de intervención administrativa para recuperar contraseñas. Requiere migración compatible de cuentas existentes; no sustituir directamente los correos sintéticos. |
| 1 | Cierre y sincronización | Resumen de pendientes por dispositivo y paso de confirmación antes del cierre | Reduce cierres con trabajo sin enviar. Un teléfono sin conexión no puede confirmar su estado actual; mostrarlo como desconocido. Evitar latidos frecuentes que consuman cuota. |
| 1 | Respaldo | Descargar copia completa al cierre y permitir verificar su restauración en una auditoría nueva | Recuperación ante errores sin sobrescribir auditorías actuales. Empezar con descarga local, sin almacenamiento de pago. |
| 1 | Permisos | Acceso por empresa/auditoría y autorización central de roles | Actualmente los miembros activos acceden al equipo completo. Requiere ajustar modelo, consultas, reglas y pruebas adversariales juntos. |
| 1 | Integridad | Reforzar las reglas para exigir que captura y contador se escriban juntos y validar las anulaciones en servidor | La app ya escribe por lote; endurecer el contrato frente a clientes modificados. Necesita estrategia de actualización de clientes antiguos y sus colas pendientes. |
| 2 | Conteo móvil | Vista de campo centrada en producto, existencia y cantidad; precios/costos desplegables | Menos información simultánea y controles al alcance del pulgar. Conservar vista completa para revisión. |
| 2 | Revisión | Lista priorizada de diferencias, conteos compartidos y cambios recientes por persona | Concentrar revisión en lo que puede cambiar el dictamen. Consultar historial por páginas, no suscribir toda la bitácora. |
| 2 | Importación | Señalar costos/precios ausentes por separado de valores confirmados en cero | Evitar dictámenes con valoración incompleta sin aviso. Conservar el reporte de filas rechazadas. |
| 2 | Consumo | Guía de cuotas y acceso directo al panel de uso, más estimación antes de importar o verificar historial | No presentar estimaciones locales como consumo global real. Mantener Spark y no agregar sondeos recurrentes. |
| 2 | Calidad | Pruebas visuales de celular, tablet, escritorio y letra XL en cada cambio de interfaz | Evitar que reaparezcan conflictos entre estilos. Usar datos ficticios y emuladores. |
| 3 | Mantenimiento | Consolidar estilos duplicados entre index.css y workspace.css por componente | Reducir regresiones por reglas heredadas. Hacerlo por pantalla y comparar visualmente, incluyendo impresión. |
| 3 | Rendimiento | Medir escáner, búsqueda y batería en teléfonos reales durante una sesión larga | Las mediciones de escritorio no garantizan rendimiento en hardware móvil. Priorizar los dispositivos del equipo. |

Estas propuestas no activan servicios ni suponen autorizar un cambio al plan de facturación. Implementar primero recuperación, cierre y respaldo; después permisos y validación del contrato de datos.
