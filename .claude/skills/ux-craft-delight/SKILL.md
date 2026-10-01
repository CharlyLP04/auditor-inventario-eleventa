---
name: ux-craft-delight
description: >-
  Craft world-class user experience, emotional design, zero-friction workflows, delightful empty states,
  sensory feedback (sound + visual cues), graceful error recovery, and progressive disclosure for desktop and POS applications.
---

# UX Craft & Delight: Experiencia de Usuario Emocional y Flujos Sin Fricción

Esta skill define la arquitectura de interacción humana, ergonomía cognitiva y detalles de deleite (*delight*) para hacer que el software no solo sea funcional, sino que se sienta como una herramienta artesanal de alta gama.

---

## 1. Los Tres Niveles de Diseño Emocional (Don Norman)

1. **Visceral (El primer impacto estético):**
   * Superficies pulidas, paletas balanceadas en grafito, bronce o ámbar, contrastes nítidos, tipografía con ritmo vertical impecable.
   * Sin bordes toscos ni bloques planos de color estridente; uso de sombras difusas en capas (`--ex-shadow-*`) y materiales traslúcidos (*glassmorphism* tenue).
2. **Conductual (La usabilidad pura y fluidez):**
   * Cero confusión sobre cuál es el siguiente paso. La acción primaria siempre es obvia (Fitts's Law).
   * La interfaz responde en menos de 100ms a cada pulsación de tecla o clic.
   * Respuestas inmediatas con skeletons durante consultas de red o base de datos.
3. **Reflexivo (La satisfacción posterior y orgullo de uso):**
   * Sensación de maestría y control por parte del recepcionista o administrador.
   * Cierres de venta limpios con confirmación auditiva y visual sutil.

---

## 2. Leyes de Interacción Cognitiva en la Práctica

### Ley de Hick (Menos es Más Rápido)
* En listas o filtros con muchas opciones (por ejemplo, reportes o categorías de caja), **agrupar en no más de 3 a 5 alternativas de primer nivel**.
* Opciones avanzadas o poco frecuentes van en divulgación progresiva (*progressive disclosure*: botón "Más filtros" o menú desplegable).

### Ley de Fitts (Blancos Fáciles de Alcanzar)
* Botones clave de alta frecuencia como **"Cobrar Ticket"**, **"Verificar Acceso"** o **"Guardar"** deben tener un área mínima de impacto de **48×48px** y estar ubicados en zonas de flujo natural de la mirada y el puntero.

### Prevención de Errores sobre Diálogos Bloqueantes
* Prefiere botones con estados deshabilitados informativos (ej. tooltip: *"Agrega al menos un producto para cobrar"*) antes que dejar que el usuario haga clic y mostrar un alert rojo molesto.
* En acciones reversibles, usa notificación con botón **Deshacer (Undo)** en lugar de interrumpir el flujo con preguntas obvias de confirmación.

---

## 3. Feedback Sensorial Multi-Canal (Audio & Visual)

* **Confirmación de Éxito:**
  * Doble tono armónico suave generado por Web Audio API (ej. D5 ➔ A5 como el implementado en `Access.tsx`).
  * Halo de luz de color de marca (`--ex-glow`) que se expande y desvanece suavemente.
* **Alertas y Advertencias:**
  * Tono grave amortiguado sin estridencias.
  * Pequeña vibración horizontal sutil (3px) para campos requeridos vacíos.

---

## 4. Estados Vacíos con Propósito (*Actionable Empty States*)

Un estado vacío nunca debe ser una pantalla en blanco con texto frío como *"No hay registros"*.
Debe incluir:
1. **Iconografía expresiva:** Un icono temático con trazo elegante (ej. `ShoppingBag`, `Users`, `ReceiptText`) con badge translúcido de fondo.
2. **Mensaje constructivo:** Explicar qué debería haber aquí (ej. *"Aún no has agregado productos a esta venta"*).
3. **Llamado a la acción (CTA) directo:** Un botón inmediato para resolver el estado (ej. *"Explorar catálogo"* o *"Nuevo Socio"*).

---

## 5. Ergonomía para Punto de Venta (POS) y Recepción

1. **Atajos de Teclado Universales:**
   * `F10` o `Ctrl + Enter` para Cobrar.
   * `Escape` para cerrar cualquier modal o cancelar búsqueda.
   * `/` para enfocar la barra de búsqueda de productos o socios al instante.
2. **Cifras de Dinero Claras (Tipografía Tabular / Mono):**
   * Todos los precios y totales deben usar `font-variant-numeric: tabular-nums` para que los números no bailen al cambiar de valor y se alineen perfectamente en columnas.
