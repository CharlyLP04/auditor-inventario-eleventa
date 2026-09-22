# 📦 Auditor de Inventario Móvil para eleventa POS

Aplicación web y PWA diseñada específicamente para negocios y tiendas que utilizan el punto de venta **eleventa** (`eleventa.com`). Permite realizar auditorías e inventarios físicos rápidos usando la cámara de cualquier teléfono celular como lector de códigos de barras (EAN-13, UPC, Code 128, etc.), calculando mermas y diferencias en dinero en tiempo real, y generando el archivo Excel listo para aplicar ajustes en eleventa.

---

## 🚀 Características Principales

- **📱 Escáner Móvil Profesional con Cámara:**
  - Lee códigos estándar de tiendas y abarrotes en México: EAN-13, UPC-A, UPC-E, Code 128, Code 39 y códigos QR.
  - Soporte para **Linterna / Flash** para escanear en estanterías o bodegas oscuras.
  - Alternador de cámaras (trasera principal / gran angular).
  - Feedback sensorial: **Bip sonoro agudo (Web Audio API)** idéntico a lectores físicos Zebra/Honeywell y **vibración háptica**.
- **⚡ Modos de Conteo:**
  - **Modo Unidad (+1):** Escaneo continuo y fluido para piezas individuales.
  - **Modo Caja (+N):** Suma paquetes o cajas completas (6, 12, 24 piezas) con un solo escaneo.
  - **Entrada Manual:** Permite teclear códigos dañados o usar pistolas de código de barras USB/Bluetooth.
- **🔄 Integración Directa con eleventa:**
  - **Carga de Excel:** Lee directamente el archivo exportado desde `F3 Productos` o `F4 Inventario` de eleventa.
  - **Detección inteligente de columnas:** Soporta variaciones de encabezados de eleventa y limpia la notación científica de Excel.
  - **Exportación con 1 Clic:** Genera el archivo Excel listo para el módulo de *Ajustes de Inventario* o *Importar Productos* en eleventa.
- **📊 Inteligencia de Negocio y Mermas:**
  - Calcula automáticamente el **costo monetario total de pérdidas/mermas** ($ MXN).
  - Identifica productos sobrantes, faltantes y cuadrados al 100%.
  - Alerta inmediata si se escanea un producto **no registrado en el catálogo**.
- **🛡️ 100% Seguro y Offline-First:**
  - Todo se guarda en el almacenamiento local del dispositivo (`LocalStorage`). Si se corta internet o se apaga la pantalla, **los conteos no se pierden**.
  - No envía datos sensibles de tu negocio a servidores externos no autorizados.

---

## 🛠️ Requisitos Previos

- [Node.js](https://nodejs.org/) v18 o superior instalado.
- Tu computadora con **eleventa punto de venta**.
- Un teléfono celular (Android o iPhone) con navegador moderno (Chrome o Safari).

---

## 💻 Instalación y Uso Local

1. Clona o entra a la carpeta del repositorio:
   ```bash
   cd auditor-inventario-eleventa
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

4. Verás en tu terminal algo similar a esto:
   ```
     ➜  Local:   http://localhost:5173/
     ➜  Network: http://192.168.1.XX:5173/
   ```

---

## 📱 ¿Cómo Abrir el Escáner en el Celular?

### Opción A: Despliegue en la Nube con HTTPS (Recomendado)
Para que los teléfonos móviles permitan acceder a la cámara sin advertencias de seguridad, los navegadores (Chrome y Safari) exigen **HTTPS**.

Puedes desplegar este repositorio **gratis en 2 minutos** en:
- **Vercel:** Conecta tu repositorio de GitHub en [vercel.com](https://vercel.com) y haz clic en *Deploy*. Te dará una URL HTTPS como `https://mi-auditor.vercel.app`.
- **Netlify:** Arrastra la carpeta `dist` resultante de ejecutar `npm run build` a [app.netlify.com/drop](https://app.netlify.com/drop).

### Opción B: Probar en Red Local Wi-Fi
Si estás conectado a la misma red Wi-Fi de tu casa/tienda:
- Abre en el navegador de tu celular la dirección **Network** que muestra la terminal (ej. `http://192.168.1.50:5173`).
- *Nota:* En Chrome para Android, si te bloquea la cámara por no ser HTTPS, puedes habilitar temporalmente la bandera en `chrome://flags/#unsafely-treat-insecure-origin-as-secure` agregando la IP de tu computadora. Por esta razón, el despliegue en la nube (Opción A) es mucho más cómodo y rápido.

---

## 🔄 Flujo de Trabajo con eleventa POS

```
[1. eleventa POS] ─── F3 / F4 Exportar a Excel ───> [2. Archivo .xlsx]
                                                            │
                                                            ▼
[4. eleventa POS] <─── F3 Importar / Ajustar <─── [3. Auditor Móvil]
(Inventario Cuadrado)   (Excel de Ajustes)        (Escaneo en pasillos)
```

1. **Paso 1 - Exportar desde eleventa:**
   - En tu computadora con eleventa, presiona **`F3 Productos`** o **`F4 Inventario`**.
   - Haz clic en el botón **"Exportar"** (abajo a la derecha).
   - Guarda el archivo Excel en tu computadora.
2. **Paso 2 - Cargar en el Auditor:**
   - Abre el Auditor en la computadora o mándate el archivo al celular.
   - En la pestaña **"eleventa"**, sube el archivo Excel (o haz clic en *"Cargar Catálogo de Prueba"* si solo quieres probar cómo funciona).
3. **Paso 3 - Escanear en la Tienda:**
   - Ve a la pestaña **"Escáner"**.
   - Pulsa **"Activar Cámara"** y apunta el celular a los códigos de barras.
   - Escucha el pitido y revisa el conteo en tiempo real.
4. **Paso 4 - Revisar y Exportar:**
   - En la pestaña **"Lista"** puedes filtrar por productos faltantes para ver qué mercancía falta en anaqueles.
   - Haz clic en **"Exportar"** y descarga el archivo `Ajuste_Inventario_eleventa.xlsx`.
5. **Paso 5 - Actualizar eleventa:**
   - En eleventa, ve a **`F3 Productos > Importar`** (o **`F4 Inventario > Ajustes de Inventario`**).
   - Selecciona el archivo descargado para actualizar automáticamente tus existencias físicas.

---

## 🌐 Cómo Subir este Proyecto a GitHub

Si deseas crear tu repositorio en GitHub para tenerlo guardado y conectarlo a Vercel/Netlify:

1. Crea un repositorio nuevo y vacío en [GitHub.com](https://github.com/new) (ej. `auditor-inventario-eleventa`).
2. En tu terminal, dentro de esta carpeta, ejecuta:
   ```bash
   git add .
   git commit -m "feat: auditor de inventario movil para eleventa"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/auditor-inventario-eleventa.git
   git push -u origin main
   ```

---

## 📄 Estructura del Código

```
auditor-inventario-eleventa/
├── src/
│   ├── components/
│   │   ├── BarcodeScanner.tsx  # Lector de cámara, linterna, modos +1/+N
│   │   ├── ExcelUploader.tsx   # Carga y validación de Excel de eleventa
│   │   ├── InventoryTable.tsx  # Lista de productos y diferencias
│   │   ├── AuditSummary.tsx    # Métricas monetarias de mermas y avance
│   │   └── ExportModal.tsx     # Generación de Excel para eleventa
│   ├── services/
│   │   ├── audioService.ts     # Pitido de escáner y vibración háptica
│   │   ├── eleventaParser.ts   # Lectura y normalización de Excel
│   │   └── eleventaExporter.ts # Creación de Excel para eleventa
│   ├── types/
│   │   └── index.ts            # Interfaces TypeScript
│   ├── App.tsx                 # Navegación y estado global
│   ├── index.css               # Estilos Tailwind v4
│   └── main.tsx
├── vite.config.ts
└── package.json
```
