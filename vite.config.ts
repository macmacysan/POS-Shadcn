import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// This config is used by Vite-aware tooling such as shadcn/ui.
// Electron builds continue to use electron.vite.config.ts.
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/src')
    }
  },
  server: {
    host: true
  },
  plugins: [react(), tailwindcss()]
})
