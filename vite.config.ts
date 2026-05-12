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
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react'
          }
          if (id.includes('node_modules/firebase')) {
            return 'vendor-firebase'
          }
          if (id.includes('node_modules/@supabase')) {
            return 'vendor-supabase'
          }
          if (id.includes('node_modules/html2canvas') || id.includes('node_modules/dompurify')) {
            return 'vendor-pdf-renderers'
          }
          if (id.includes('node_modules/jspdf') || id.includes('node_modules/jspdf-autotable')) {
            return 'vendor-pdf'
          }
        },
      },
    }
  }
})
