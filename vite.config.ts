import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    /** true = 0.0.0.0 — vermeidet oft „localhost geht nicht“ (IPv4/IPv6) und erlaubt Zugriff im LAN */
    host: true,
    port: 5173,
    strictPort: false,
    open: true,
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: './index.html',
      },
    }
  }
})
