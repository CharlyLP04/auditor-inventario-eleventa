# Comprobación móvil sin Firebase

Ejecutar npm run dev y abrir /tests/browser/mobile.html. Usa InventoryTable, InterfaceScale y las hojas de estilo reales con productos ficticios en memoria. No crea cuentas ni escribe conteos reales; no se incluye en la compilación de producción.

Revisar 320, 360, 390, 600, 900 y 1280 píxeles; repetir en Campo XL. La página no debe desplazarse horizontalmente. La barra de filtros sí puede desplazarse internamente. En móvil, la navegación ocupa el ancho útil y permite llegar al último producto sin cubrir sus controles.

Probar +, -, edición directa, búsqueda y filtros; incluir código largo, descripción sin espacios y precio grande. Verificar que el documento no sea más ancho que document.documentElement.clientWidth. Para la navegación fija, comparar su ancho con clientWidth. Respetar el zoom del navegador.

## Flujo de equipo aislado

Inicia Auth/Firestore Emulator con proyecto demo-auditor y ejecuta node --import ./tests/register.mjs tests/browser/seed-team.mjs una vez sobre emuladores vacíos. Inicia Vite con VITE_FIREBASE_PROJECT_ID=demo-auditor, VITE_FIREBASE_API_KEY=demo-key, VITE_FIREBASE_AUTH_DOMAIN=localhost y VITE_FIREBASE_EMULATOR=true. La cuenta ficticia browser_admin usa browser-test-only. Nunca usar estas credenciales o el seed en producción.

Verifica permisos por empresa, apertura de auditoría, registro del navegador, solicitar cierre, confirmar, marcar completada y descargar respaldo. Revisa que no haya desbordamiento y que el respaldo sea JSON válido con SHA-256 del payload.
