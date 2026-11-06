# Accesos, cierre de equipo y respaldo · 5 de noviembre de 2026

## Recuperación de cuenta

En modo equipo, abre **Mi cuenta · correo de recuperación**. Escribe un correo real y tu contraseña actual. Firebase reautentica y envía un enlace: el correo no cambia hasta que lo verifiques. Se conserva el UID, nombre visible, permisos y autoría de todos los conteos. Después entra con el correo verificado y tu contraseña actual. El antiguo nombre sintético deja de servir para iniciar sesión: no crees otra cuenta. **Olvidé mi contraseña** envía el enlace al correo vinculado. No se guarda ni publica el correo real en Firestore.

Las cuentas existentes siguen entrando por usuario hasta que su propietario vincule el correo. No se migran automáticamente ni se cambian contraseñas administrativas. Vincular requiere conexión y acceso al buzón. La entrega real del correo depende de Firebase y del proveedor del destinatario; se probó el flujo de verificación y recuperación completo en Auth Emulator.

## Permisos

En **Personas con acceso**, activa la cuenta y abre **Empresas y auditorías permitidas**. El administrador puede conservar acceso a todo el equipo, elegir empresas completas o auditorías específicas, y guardar. Una auditoría específica permite leer los datos de su empresa pero no sus otras auditorías. Se admiten hasta 10 selecciones combinadas, para respetar los límites de consultas de Firestore. Las auditorías se cargan por páginas de 30 al pedirlas. Los administradores conservan alcance global.

Los usuarios existentes conservan el alcance anterior hasta que un administrador lo cambie. Las cuentas nuevas creadas con esta versión empiezan sin permisos de empresa/auditoría. Solo los administradores pueden editar permisos. Consultas, historial, acceso por enlace y subcolecciones aplican el mismo alcance; los auditores ya no consultan las fichas de otros miembros. Los nombres disponibles de responsables se obtienen de departamentos.

Revocar acceso impide nuevas lecturas y escrituras autorizadas en el servidor. Como en cualquier sistema con modo offline, no puede borrar retroactivamente datos que alguien ya descargó; no compartas un dispositivo con sesión abierta.

## Cierre coordinado

Antes del primer cierre tras actualizar, todos deben sincronizar sus pendientes y abrir la versión actual en cada navegador usado para contar. El registro cubre los dispositivos que abren esta versión; no puede descubrir un teléfono antiguo que permanece desconectado.

1. El administrador pulsa **Solicitar cierre al equipo**. Se pausa el conteo en clientes actualizados.
2. Cada navegador registrado se muestra sin confirmar. No equivale a estar conectado ni a tener cero pendientes.
3. Cada persona se conecta, espera **Todo sincronizado** y pulsa **Terminé: confirmar este dispositivo**. La app espera la cola de Firebase antes de confirmar. El servidor rechaza capturas posteriores de ese dispositivo confirmado.
4. Solo cuando todos los registrados confirman se cambia el estado a **Completada** o **Cerrada**. La transacción y las reglas impiden cerrar si falta alguien. Un dispositivo registrado durante la solicitud también necesita confirmar.
5. Se puede cancelar la solicitud y seguir contando; las confirmaciones anteriores se invalidan. Reabrir exige una nueva ronda de confirmaciones al volver a cerrar.

Los dispositivos sin señal, apagados, con pestaña cerrada o con acceso revocado necesitan volver y confirmar. No hay cierre forzado que omita sus pendientes. No borres datos del navegador para resolverlo. Se identifican por navegador/almacenamiento y cuenta (un sufijo permite distinguirlos); varias pestañas del mismo navegador comparten la cola persistente. Máximo 100 registros por auditoría. Un cliente modificado puede mentir sobre su cola: las reglas comprueban autoría y estado, no pueden inspeccionar almacenamiento privado de un teléfono. Clientes antiguos deben actualizarse antes de solicitar cierre; sus capturas sin identificador no se aceptan durante la comprobación.

## Respaldo completo

Después de cerrar o completar aparece **Descargar respaldo completo** para administradores. Requiere conexión y estado sincronizado. Se leen los documentos de catálogo, contadores, capturas, departamentos, no encontrados y eventos; incluye auditoría, notas y datos de empresa. No incluye contraseñas ni fichas de acceso. Se compara el documento de auditoría antes/después para rechazar una reapertura concurrente. Las diferencias entre capturas y contadores se informan y conservan, nunca se ocultan.

El archivo JSON contiene formato/version, payload serializado y SHA-256 del texto exacto de payload. La suma detecta corrupción accidental; no es una firma de autenticidad. Guarda el archivo fuera del teléfono y comprueba la descarga. No es el JSON simplificado del importador eleventa; la restauración automática de este formato completo queda fuera de esta entrega. Su contenido conserva IDs y datos originales para una recuperación posterior revisada, sin sobrescribir auditorías en automático.

## Conteo y revisión

La lista abre en vista simple al contar: producto, existencia, estado y cantidad. **Mostrar precios y costos** devuelve el detalle. **Revisar diferencias primero** muestra faltantes, sobrantes y no encontrados, ordenados por magnitud de diferencia de piezas. Conserva búsqueda y departamento y excluye los pendientes sin contar de las diferencias para no tratarlos como faltantes. Se mantiene paginación de 50 productos y preferencia local de vista, sin lecturas adicionales.

## Consumo y validación

Sin tareas programadas, servicios de pago ni sondeos periódicos. El registro y la confirmación generan cambios puntuales en el documento ya escuchado de auditoría; no añaden escrituras a cada captura. Historial de permisos y respaldo solo se consultan por acción explícita. El respaldo lee todo el historial y consume cuota; evita descargarlo repetidamente. El proyecto sigue sin cuenta de facturación asociada (comprobado durante la entrega). Agotar cuota puede interrumpir sincronización, no habilita facturación automáticamente.

Pruebas: compilación, lint, pruebas unitarias, emuladores de Auth/Firestore (permisos entre empresas, subcolecciones, consultas reales, suplantación de confirmaciones, cierre con pendientes offline, cancelación, correo verificado con mismo UID, recuperación y SHA-256 del respaldo). Revisión móvil con datos ficticios en 320/390/768/1280 px y letra XL sin desbordamiento. El navegador integrado se bloqueó en un diálogo nativo de confirmación durante la prueba visual de cierre; el cierre completo está probado por SDK/emulador. No se probó entrega de correo real ni teléfonos físicos.
