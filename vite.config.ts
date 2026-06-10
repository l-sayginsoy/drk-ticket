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
      output: {
        manualChunks(id) {
          // Firebase in eigenen Chunk
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            return 'vendor-firebase';
          }
          // PDF / Canvas Bibliotheken (schwer, selten gebraucht)
          if (
            id.includes('node_modules/jspdf') ||
            id.includes('node_modules/jspdf-autotable') ||
            id.includes('node_modules/html2canvas') ||
            id.includes('node_modules/dompurify') ||
            id.includes('node_modules/stackblur-canvas')
          ) {
            return 'vendor-pdf';
          }
          // React-Kern
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/scheduler')) {
            return 'vendor-react';
          }
          // Framer Motion
          if (id.includes('node_modules/framer-motion')) {
            return 'vendor-framer';
          }
        },
      },
    }
  }
})
