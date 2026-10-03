# ADR-0002: Colaboración en tiempo real con sesiones por persona

- **Estado:** Aceptado el 2026-10-03 (opción A: Firebase Spark, cuentas de correo y contraseña por persona). Reemplaza a ADR-0001.
- **Fecha:** 2026-10-03
- **Decisores:** Oscar y Charly
- **Skills aplicadas:** `engineering:architecture`, `ecc:security-review`, `ecc:production-audit`
- **Relacionados:** [Informe de auditoría](../auditoria/2026-10-03-informe-auditoria.md) (H-01, H-02, H-06, H-08, H-12) · [Diseño técnico](../diseno/colaboracion-multidispositivo.md)

## Contexto

El requisito cambió respecto a ADR-0001:
- Antes bastaba con identificar **dispositivos**.
- Ahora **cada persona tiene su propia sesión**, elige y se le asignan **departamentos**, y debe quedar un **historial de quién hizo cada registro**.
- Siguen vigentes estas restricciones:
  - costo cero;
  - sin login de Google;
  - integridad de los conteos por encima de la velocidad;
  - la tienda puede tener mala señal.

**Hechos:**
1. **Sin servidor no hay sincronización.** Hoy todo vive en IndexedDB de cada navegador (H-01).
2. **Safari borra el almacenamiento** de sitios sin interacción en 7 días si la app no está en la pantalla de inicio (H-02).
3. **Supabase gratis pausa el proyecto** tras una semana sin actividad en la base de datos ([JetAdmin, 2026](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/)). Las auditorías son mensuales, así que el proyecto estaría pausado casi siempre al empezar a contar.
4. **Firebase Spark** (gratis) ofrece Auth con correo y contraseña, y Firestore con 50,000 lecturas, 20,000 escrituras y 20,000 borrados al día. Su SDK web trae **caché persistente sin conexión** y cola de escrituras.

## Opciones

| | A · Firebase, una cuenta por persona (correo + contraseña) | B · Firebase anónimo + vincular dispositivos por QR (ADR-0001) | C · Supabase (Postgres + RLS) | D · Servidor propio (Node + SQLite en VPS) |
|---|---|---|---|---|
| Sesión por persona | **Sí**, nativa | No: identifica el dispositivo | Sí | Sí, a construir |
| Costo | $0 | $0 | $0, pero se pausa | ~US$5–10 al mes y mantenimiento |
| Sin conexión | **Caché y cola de escrituras incluidas** | Igual que A | No incluido; habría que construirlo | A construir |
| Recuperar acceso (iPhone que perdió datos) | Volver a escribir la contraseña | Revincular desde otro dispositivo | Contraseña | Contraseña |
| Seguridad del servidor | Reglas de Firestore, con pruebas en el emulador | Igual, con reglas a la medida | RLS (fuerte) | Propia (mayor riesgo) |
| Esfuerzo | Medio | Medio-alto | Alto, por el modo sin conexión | Alto, más operación |
| Crecimiento (auditores) | Admin crea la cuenta y asigna su rol | Vinculación presencial | Igual que A | A construir |

**Descartadas:**
- **Google:** el usuario lo excluyó.
- **P2P/WebRTC entre teléfonos:** exige que ambos estén en línea a la vez y no deja respaldo.
- **Compartir archivos:** prohibido por el requisito.

### Puntaje (1 = peor, 5 = mejor)

| Criterio (peso) | A | B | C | D |
|---|---|---|---|---|
| Integridad y concurrencia (×3) | 5 | 5 | 4 | 3 |
| Sesión por persona y trazabilidad (×3) | 5 | 3 | 5 | 4 |
| Funciona con mala señal (×3) | 5 | 5 | 2 | 2 |
| Seguridad (×2) | 4 | 4 | 5 | 3 |
| Costo y operación (×2) | 5 | 5 | 2 | 2 |
| Recuperación de acceso (×1) | 5 | 2 | 5 | 5 |
| Esfuerzo (×1) | 3 | 2 | 2 | 1 |
| **Total (máx. 75)** | **72** | **62** | **55** | **42** |

## Decisión

**Adoptar A.** Implica:
- Firebase Auth con correo y contraseña, **una cuenta por persona**, creada por un administrador en la consola de Firebase. La app no ofrece registro público.
- Cloud Firestore con caché persistente sin conexión.

**Condiciones:**
1. **Acceso en el servidor.**
   - Una cuenta sin documento `members/{uid}` activo no lee ni escribe nada.
   - El rol (`admin` o `auditor`) se lee de ese documento en las reglas, nunca del cliente.
2. **Conteos sumables e idempotentes.**
   - Cada captura es un documento nuevo con un ID generado en el teléfono, así que reintentar no duplica.
   - El total por producto se acumula con `increment`, una operación atómica en el servidor. Ninguna captura sobrescribe el total de otra persona.
3. **Asignación de departamentos con exclusión mutua.**
   - Tomar un departamento es una transacción que solo procede si está libre o ya es tuyo; por eso requiere conexión.
   - Contar sin conexión dentro de un departamento propio sí se permite.
4. **Las reglas tienen pruebas automatizadas** en el emulador antes de usarse en campo.
5. **Migración no destructiva.** La versión local sigue funcionando; subir una auditoría a la nube es una acción explícita que no borra los datos locales.
6. **iPhone con la app instalada** en la pantalla de inicio. Si Safari borra la sesión, basta volver a iniciarla; los datos están en el servidor.

## Consecuencias

**Se facilita:**
- Contar entre dos o más personas.
- Ver el avance en vivo.
- Saber quién capturó qué.
- Agregar auditores sin cambiar el modelo.

**Se complica:**
- Hay un proveedor externo: los catálogos (costos y precios del cliente) se guardan en Google Cloud.
- Hay que configurar el proyecto de Firebase.
- Hay que mantener las reglas y sus pruebas.

**A revisar:**
- Si se rebasan las cuotas gratuitas (ver el cálculo en el diseño técnico).
- Si un cliente exige que sus datos no salgan del dispositivo. En ese caso se conserva el modo local.

## Acciones que requieren a una persona

1. [x] Aprobar o ajustar este ADR (aprobado el 2026-10-03).
2. [ ] Crear el proyecto de Firebase (plan Spark) y registrar la app web. La configuración web es pública por diseño y se guarda en variables `VITE_FIREBASE_*`.
3. [ ] Habilitar el inicio de sesión con correo y contraseña, y crear las dos cuentas.
4. [ ] Publicar las reglas (`firebase deploy --only firestore:rules`) desde una cuenta con permisos.
5. [ ] Ensayo con los dos teléfonos reales al menos una semana antes de la auditoría.
