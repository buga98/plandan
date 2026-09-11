import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: here,
  base: '/app/',
  publicDir: false,
  plugins: [react()],
  build: {
    outDir: resolve(here, 'dist'),
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2020',
    cssCodeSplit: true
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:3600',
      '/icons': 'http://127.0.0.1:3600',
      '/languages': 'http://127.0.0.1:3600',
      '/manifest.webmanifest': 'http://127.0.0.1:3600',
      '/sw-app-v2.js': 'http://127.0.0.1:3600'
    }
  }
})
