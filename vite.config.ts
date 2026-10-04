import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { writeServiceWorker } from './scripts/sw-manifest.mjs'

// Versiona el service worker y su lista de precarga en cada build, sin depender del servidor que lo entregue.
function serviceWorkerManifest(): Plugin {
  let outDir = ''
  return {
    name: 'auditor-service-worker',
    apply: 'build',
    configResolved(config) { outDir = resolve(config.root, config.build.outDir) },
    // Si el build falló no hay sw.js que versionar; no ocultar el error original.
    closeBundle() { if (existsSync(resolve(outDir, 'sw.js'))) writeServiceWorker(outDir) },
  }
}

// https://vite.dev/config/
export default defineConfig({
  cacheDir: './.cache/vite',
  resolve: { preserveSymlinks: true },
  plugins: [
    react(),
    tailwindcss(),
    serviceWorkerManifest(),
  ],
  server: {
    host: true, // Allow local network access (e.g. testing from mobile phone in same wifi)
    port: 5173,
    strictPort: true,
  },
})

