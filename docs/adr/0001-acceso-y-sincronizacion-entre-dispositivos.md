# ADR-0001: Acceso y sincronización entre dispositivos sin login de Google

- **Estado:** Propuesto
- **Fecha:** 2026-10-03
- **Decisores:** Oscar y Charlie (socios y administradores)
- **Skills aplicadas:** `engineering:architecture` (formato y análisis de compromisos), `security-critic-audit` (revisión adversarial), `ux-craft-delight` (fricción en campo)

## Contexto

- **Situación actual:** dos socios y un cliente. La primera auditoría (2026-10-01) se hizo en un solo teléfono, con los datos guardados únicamente en su navegador (IndexedDB) y respaldos JSON manuales.
- **Objetivo para la próxima auditoría (en un mes):** dos teléfonos cuentan la **misma** auditoría a la vez, cada uno una parte, sin respaldos manuales y sin contar dos veces lo mismo.
- **Restricciones:** sin login de Google, costo cero (Firebase Spark), fácil de usar en tienda y con funcionamiento sin señal.
- **A futuro:** contratar auditores, que solo verán y contarán lo que se les asigne.

**Hechos verificados que condicionan la decisión:**
1. **Safari en iPhone borra el almacenamiento escrito por scripts** (IndexedDB, localStorage y registro del service worker) tras 7 días de uso del navegador sin interactuar con el sitio. Las apps añadidas a la pantalla de inicio llevan su propio contador y en la práctica no lo alcanzan ([WebKit / Search Engine Land](https://searchengineland.com/what-safaris-7-day-cap-on-script-writeable-storage-means-for-pwa-developers-332519)).
   - Esto **afecta hoy al sistema actual**: en un iPhone, sin instalar la app, el historial local puede desaparecer entre auditorías mensuales.
   - En cualquier opción con sesión de Firebase, esa sesión (guardada en IndexedDB) también se borra.
2. **Firebase Auth** permite 100 cuentas nuevas (anónimas o con correo) por hora y por IP ([límites](https://firebase.google.com/docs/auth/limits)). Es suficiente para este uso.
3. **Cuotas gratuitas de Firestore:** 50,000 lecturas, 20,000 escrituras y 20,000 borrados al día, y 1 GiB almacenado; se reinician a medianoche del Pacífico ([precios](https://cloud.google.com/firestore/pricing)).
4. **No hay sincronización real sin un servidor común.** La parte de datos en la nube es la misma en todas las opciones: modelo de capturas que se suman, caché sin conexión de Firestore y reemplazo de `storageIndexedDB.ts`. **Solo cambia cómo se identifica cada dispositivo.**

## Opciones consideradas

### A. Vincular dispositivos con QR (sesión anónima + lista de miembros)

Cada navegador recibe una identidad anónima de Firebase, sin pantalla de login. Para entrar al espacio de trabajo, el dispositivo nuevo muestra un QR con su identificador; un dispositivo que ya es miembro lo escanea, le asigna nombre y rol y confirma. Las reglas solo permiten acceso a quienes están en `members/{uid}`, y solo un miembro puede agregar a otro.

| Dimensión | Evaluación |
|---|---|
| Complejidad | Media: reglas de membresía, pantalla de vinculación y arranque del primer miembro |
| Costo | $0 |
| Escalabilidad | Buena: los auditores se vinculan igual, con rol `auditor` |
| Familiaridad | Patrón conocido (WhatsApp Web, Bluetooth). El QR se genera con `scripts/terminal-qr.mjs`, adaptado al navegador; un identificador de 28 caracteres cabe en su límite de 32 bytes |

**A favor:**
- Nadie escribe nada.
- **No existe un secreto compartido que pueda filtrarse.**
- Revocación individual: quitar un teléfono perdido desde otro.
- Trazabilidad por dispositivo ("Charlie, teléfono").
- El mismo mecanismo sirve para auditores.
- Firebase permite enlazar después una identidad anónima a Google o a correo sin perder el `uid`, así que no cierra puertas.

**En contra:**
- Si se borran los datos del navegador, hay que volver a vincular, y eso requiere otro dispositivo miembro. En iPhone sin instalar la app puede ocurrir cada mes (hecho 1).
- Si se pierden todos los dispositivos miembros, la recuperación se hace en la consola de Firebase.
- Las reglas son a la medida, así que tienen más superficie de error que una lista de correos.

**Crítica de seguridad:**
- 🔴 *Bloqueante si no se resuelve:* **el arranque del primer miembro.** Si la regla dice "el primero en llegar es dueño", cualquiera que vea la configuración pública de la app podría adueñarse del espacio antes que ustedes. Solución: el primer miembro solo puede crearse presentando un código de instalación cuyo `sha256` está fijo en las reglas (`hashing.sha256`). Se usa una vez y queda inservible en cuanto existe un miembro.
- 🟠 *Ingeniería social:* que alguien envíe por WhatsApp un QR para que se lo escaneen. Mitigación: la confirmación muestra nombre y huella corta del dispositivo y advierte "Vincula solo dispositivos que tienes en la mano"; los miembros aparecen en una lista visible y revocable.
- 🟡 Cualquiera puede crear cuentas anónimas en el proyecto (100/h por IP), pero sin membresía no leen ni escriben nada. Riesgo aceptable.

### B. Una sola cuenta del negocio (correo y contraseña)

| Dimensión | Evaluación |
|---|---|
| Complejidad | Baja: reglas de un solo `uid` permitido |
| Costo | $0 |
| Escalabilidad | Mala: no sirve para auditores, porque compartirían la cuenta de administrador |
| Familiaridad | Alta |

**A favor:** lo más rápido de construir; recuperación por correo de restablecimiento; un iPhone que pierde la sesión solo vuelve a escribir la contraseña.

**En contra:**
- Contraseña compartida y tecleada en cada teléfono.
- Revocar un dispositivo exige cambiarla para todos.
- "Quién contó qué" depende de un nombre que el teléfono declara, sin garantía.
- Al contratar auditores habrá que construir otro mecanismo.

**Crítica de seguridad:** 🟠 un secreto compartido de administrador total, que tiende a circular por mensajería y a ser débil; si se filtra, da acceso a todos los clientes. Firebase limita los intentos de acceso, pero no evita una filtración.

### C. Google (descartado por el requisito)

Es la más fuerte: verificación en dos pasos, recuperación a cargo de Google e identidad por persona. Pide un toque por teléfono. Se registra como referencia: es la recomendación si el requisito cambia, y puede añadirse después para administradores sin rehacer nada, gracias al enlace de identidades.

### Rechazadas
- **Código de equipo compartido** (un PIN o código para entrar): es una contraseña compartida con menos protecciones que B.
- **Sincronizar teléfono con teléfono (WebRTC/CRDT) o usar la PC como servidor en la tienda:** exigen que ambos estén en línea al mismo tiempo, no dejan respaldo y son frágiles con mala señal.
- **Base de datos sin autenticación:** expone costos y conteos de los clientes a cualquiera, con permiso de borrarlos.

## Análisis de compromisos (1 = peor, 5 = mejor)

| Criterio (peso) | A · Vincular QR | B · Cuenta compartida | C · Google |
|---|---|---|---|
| Seguridad (×3) | 4 | 2 | 5 |
| Fricción diaria en tienda (×2) | 5 | 4 | 4 |
| Alta de un teléfono (×1) | 4 | 3 | 4 |
| Recuperación al perder la sesión (×2) | 2 | 4 | 5 |
| Trazabilidad de capturas (×2) | 4 | 2 | 5 |
| Sirve al contratar auditores (×2) | 4 | 1 | 3 |
| Esfuerzo y riesgo de construcción (×2) | 3 | 5 | 4 |
| **Total ponderado (máx. 70)** | **52** | **41** | **61** |

C gana por sí sola, pero queda fuera por el requisito. **Entre las opciones sin Google, A supera a B con claridad**: B solo gana en esfuerzo de construcción y en recuperación, y pierde en lo que más importa a una firma auditora (seguridad, trazabilidad y crecimiento). La debilidad de A (recuperación) se mitiga con medidas concretas (ver Consecuencias).

## Decisión (propuesta)

**Adoptar A: vincular dispositivos con QR.** Condiciones obligatorias:
1. El primer miembro se crea con un código de instalación verificado por `sha256` en las reglas.
2. Hay al menos **tres dispositivos miembros** en todo momento (los dos teléfonos y la PC), para que perder uno nunca bloquee el acceso.
3. En iPhone se usa la **app instalada en la pantalla de inicio**; la app lo detecta y lo pide.
4. Las reglas tienen una suite de pruebas en el emulador: no miembros, miembro revocado, auditor que intenta escalar a administrador y arranque repetido.
5. Existe un procedimiento escrito de recuperación por consola, para el caso de perder todos los dispositivos.

Para evitar contar dos veces con dos teléfonos, esta decisión se acompaña de:
- **zonas por persona** ("Charlie está contando Lácteos");
- un **aviso al escanear algo que ya capturó otra persona**, con quién, cuándo y cuánto, que pide confirmar para sumar;
- en el balance, los productos capturados por más de una persona marcados para revisión.

## Consecuencias

- **Se facilita:** contar entre dos sin respaldos; agregar un auditor (se vincula su teléfono con rol `auditor`); quitar un teléfono perdido; el historial queda en la nube en lugar de un navegador.
- **Se complica:** más reglas a la medida, que hay que probar; recuperar el acceso si se pierden todos los dispositivos (consola); y la vinculación debe ser presencial.
- **A revisar más adelante:**
  - Si el equipo crece mucho o un auditor necesita entrar desde varios dispositivos, se puede añadir Google o correo enlazando su identidad anónima, sin migrar datos.
  - Si alguna vez se requiere identidad legal del auditor, por ejemplo una firma en el dictamen.

## Acciones

1. [ ] **Urgente, independiente de esta decisión:** si la auditoría del 1 de octubre se hizo en un iPhone con Safari sin instalar la app, abrir la app antes del 8 de octubre y conservar el respaldo JSON. Safari puede borrar esos datos.
2. [ ] Aprobar o ajustar este ADR (Oscar y Charlie).
3. [ ] Actualizar la especificación de la Etapa 1: acceso por vinculación, zonas y aviso de doble conteo.
4. [ ] Redactar el plan de implementación con pruebas de reglas y una prueba de campo con dos dispositivos.
5. [ ] Ensayo con dos teléfonos al menos una semana antes de la próxima auditoría.
