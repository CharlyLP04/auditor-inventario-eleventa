# Consumo y rendimiento

Verificado el 31 de octubre de 2026: el proyecto grid-auditor-eleventa tiene billingEnabled=false y no tiene cuenta de facturación vinculada. No se activó Blaze ni ningún servicio de pago. Este estado puede cambiar si un propietario vincula una cuenta después.

## Medidas implementadas

- Solo las auditorías en curso se escuchan en la pantalla inicial; esa suscripción se cierra al abrir una auditoría.
- El historial se consulta al abrirlo, con cursores y páginas de 20 documentos. No se descarga completo ni se mantiene una suscripción al historial.
- Los conteos de la auditoría abierta siguen en tiempo real. No hay consultas periódicas ni escrituras por cada tecla.
- Caché persistente y coordinación entre pestañas del mismo navegador. Las confirmaciones sin cambios de contenido no reconstruyen las listas.
- Se reutilizan los productos que no cambiaron y su índice de búsqueda. El escáner se carga al entrar a Contar.
- Los mapas de conteos, catálogo, notas e información de importación no necesitan índices para las consultas actuales.
- La verificación de integridad es manual: lee TODO el historial y los contadores dos veces. No usarla para refrescar la pantalla.

## Qué consume cuota

Una captura normal escribe dos documentos: bitácora y contador. Una cantidad de 20 piezas en una captura cuesta las mismas dos escrituras que una pieza. Corregir, deshacer, vincular e importar tienen operaciones adicionales. Cada dispositivo que escucha recibe lecturas por los documentos modificados; las reglas de acceso también pueden generar lecturas. Una consulta vacía tiene un consumo mínimo.

Las cuotas gratuitas publicadas para Firestore Standard incluyen 50,000 lecturas y 20,000 escrituras diarias, 1 GiB almacenado y transferencia limitada. No equivalen a 20,000 capturas. Los límites se comparten entre todos los teléfonos y computadoras del proyecto. Una reconexión después de más de 30 minutos puede volver a contabilizar la consulta completa incluso con caché.

En Spark, agotar la cuota puede impedir temporalmente sincronizar. No borrar datos del navegador ni cerrar la sesión con capturas pendientes. No existe un contador local que garantice la cuota global: consultar Uso en Firebase. Antes de cerrar una auditoría, todos los dispositivos deben mostrar Todo sincronizado.

No vincular una cuenta de facturación ni cambiar a Blaze si se requiere gasto cero. Los presupuestos de Google Cloud son alertas, no topes de gasto.

Fuentes: https://firebase.google.com/docs/firestore/pricing y https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
