# Puesta en marcha del modo equipo (Firebase)

Guía para activar la auditoría compartida: Oscar y Charly cuentan la misma auditoría desde sus teléfonos, cada uno con su cuenta. Mientras no se configure, la app sigue funcionando solo en modo local.

**Tiempo estimado:** 20 a 30 minutos. **Costo:** $0 en el plan Spark de Firebase (ver cuotas en el [diseño](diseno/colaboracion-multidispositivo.md#6-cuotas-plan-spark)).

## 1. Crear el proyecto (consola de Firebase)

1. Entra a <https://console.firebase.google.com> con la cuenta de Google del negocio y crea un proyecto, por ejemplo `auditor-grid`. Google Analytics no es necesario.
2. **Compilación → Firestore Database → Crear base de datos**:
   - modo **producción**;
   - ubicación cercana, por ejemplo `us-central1` o `northamerica-south1`. No se puede cambiar después.
3. **Compilación → Authentication → Comenzar**:
   - habilita **Correo electrónico/contraseña**;
   - no habilites el enlace de correo ni otros proveedores.
4. **Configuración del proyecto → Tus apps → Web (</>)**:
   - registra la app;
   - copia `apiKey`, `authDomain`, `projectId` y `appId`. Esta configuración no es secreta; la protección la dan las reglas.

## 2. Cuentas y primer administrador

1. **Authentication → Usuarios → Agregar usuario**: crea la cuenta de Oscar y la de Charly, cada una con su correo y una contraseña fuerte, que cada quien puede cambiar con "Olvidé mi contraseña".
2. Copia el **UID de usuario** de Oscar, que aparece en la lista de usuarios.
3. **Firestore → Iniciar colección** `members` → documento con ID = el UID de Oscar y estos campos:
   - `name` (string): `Oscar`
   - `role` (string): `admin`
   - `active` (boolean): `true`
4. El resto de las personas se agregan desde la app: Oscar entra y va a **Personas con acceso**. Charly inicia sesión una vez, la app le muestra su UID, y Oscar lo pega ahí con rol Administrador.

## 3. Publicar las reglas de seguridad

Desde la carpeta del proyecto, con la sesión de Google del negocio:

```bash
npx firebase login
```
```bash
npx firebase use --add
```
```bash
npx firebase deploy --only firestore:rules,firestore:indexes
```

Hasta que se publiquen las reglas, Firestore en modo producción rechaza todo: no hay una ventana de acceso abierto.

## 4. Configurar la app

**Para probar localmente:**
- copia `.env.example` como `.env.local`;
- completa las variables `VITE_FIREBASE_*`;
- ejecuta `npm run build` y luego `npm start`.

**En Vercel:**
- **Settings → Environment Variables**: agrega las mismas cuatro variables (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID` y `VITE_FIREBASE_APP_ID`) para Production y Preview;
- vuelve a desplegar. Las variables se leen al compilar.

**En Firebase:**
- **Authentication → Configuración → Dominios autorizados**: agrega `auditor-inventario-eleventa.vercel.app`.

## 5. Ensayo antes de la auditoría (al menos una semana antes)

1. En cada teléfono, abre la app y, **en el iPhone**, instálala con Safari → Compartir → Añadir a pantalla de inicio. Entra siempre desde ese icono.
2. Inicia sesión con tu cuenta, abre la auditoría de prueba y toma un departamento distinto en cada teléfono.
3. Cuenta unos productos en cada teléfono y comprueba que el otro los ve sin recargar.
4. Activa el **modo avión** en un teléfono, cuenta 5 productos y observa el indicador "Sin conexión · 5 por enviar". Desactiva el modo avión y espera a que diga "Todo sincronizado".
5. Escanea un código que no esté en el catálogo desde los dos teléfonos: debe quedar **un solo** producto no encontrado con la suma de ambos.
6. En **Balance → Verificación de integridad**, todos los totales deben coincidir con el historial.

## Cómo funciona sin conexión

- **Contar sin señal está permitido.** Cada captura se guarda en el teléfono y se envía en orden cuando vuelve la conexión. El indicador muestra cuántas faltan por enviar.
- **Requieren conexión:** tomar, soltar o completar departamentos; crear auditorías e importar catálogos; cambiar el estado de la auditoría; dar acceso a personas; y el **primer** inicio de sesión en un dispositivo.
- **Antes de borrar datos del navegador** o desinstalar la app, espera a que el indicador diga "Todo sincronizado". Lo que no se haya enviado se pierde.
- **Si cierras sesión con capturas pendientes,** quedan guardadas en ese teléfono y se envían cuando la misma cuenta vuelve a entrar ahí.

## Si algo sale mal

| Situación | Qué hacer |
|---|---|
| "Tu cuenta aún no tiene acceso" | Un administrador agrega el UID que muestra la pantalla en **Personas con acceso** |
| Se perdieron todos los administradores | En la consola de Firestore, edita `members/{uid}` y pon `role: admin` y `active: true` |
| Un teléfono se perdió | **Personas con acceso → Quitar acceso** a esa persona, y en Authentication deshabilita la cuenta o cambia su contraseña |
| La verificación de integridad muestra diferencias | No corrijas a mano: anota los códigos y revisa el historial de capturas en Firestore (`audits/{id}/captures`) |
| Se rebasa la cuota diaria gratuita | Firestore rechaza escrituras hasta la medianoche del Pacífico; las capturas quedan en cola en el teléfono. Con el volumen previsto (≈8,500 escrituras/día de 20,000) no debería pasar |

## Pruebas automatizadas

- `npm test`: lógica (91 pruebas), sin red.
- `npm run test:cloud`: reglas de seguridad y escenarios de dos personas contra los emuladores de Firebase (30 pruebas; requiere Java 11+).
- `node tests/field-browser-server.mjs` y abrir `http://localhost:5191/__field.html`: flujos de interfaz en navegador (requiere `npm run build`).
