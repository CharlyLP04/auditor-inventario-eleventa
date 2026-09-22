import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  resolve: { preserveSymlinks: true },
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: true, // Allow local network access (e.g. testing from mobile phone in same wifi)
    port: 5173,
    strictPort: true,
  },
})
