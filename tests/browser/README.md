# Comprobación móvil sin Firebase

Ejecutar npm run dev y abrir /tests/browser/mobile.html. Usa InventoryTable, InterfaceScale y las hojas de estilo reales con productos ficticios en memoria. No crea cuentas ni escribe conteos reales; no se incluye en la compilación de producción.

Revisar 320, 360, 390, 600, 900 y 1280 píxeles; repetir en Campo XL. La página no debe desplazarse horizontalmente. La barra de filtros sí puede desplazarse internamente. En móvil, la navegación ocupa el ancho útil y permite llegar al último producto sin cubrir sus controles.

Probar +, -, edición directa, búsqueda y filtros; incluir código largo, descripción sin espacios y precio grande. Verificar que el documento no sea más ancho que document.documentElement.clientWidth. Para la navegación fija, comparar su ancho con clientWidth. Respetar el zoom del navegador.
