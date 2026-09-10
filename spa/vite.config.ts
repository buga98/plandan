import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  root: resolve(__dirname),
  base: '/v2/',
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, '../public/v2'),
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2022',
    cssCodeSplit: true
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:3600',
      '/icons': 'http://127.0.0.1:3600'
    }
  }
})
