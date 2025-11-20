import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth': { target: 'http://localhost:3000', changeOrigin: true },
      '/tasks': { target: 'http://localhost:3000', changeOrigin: true },
      '/blocks': { target: 'http://localhost:3000', changeOrigin: true },
      '/shares': { target: 'http://localhost:3000', changeOrigin: true },
      '/shared': { target: 'http://localhost:3000', changeOrigin: true },
      '/settings': { target: 'http://localhost:3000', changeOrigin: true },
      '/task-types': { target: 'http://localhost:3000', changeOrigin: true },
      '/tags': { target: 'http://localhost:3000', changeOrigin: true },
      '/push': { target: 'http://localhost:3000', changeOrigin: true },
      '/notifications': { target: 'http://localhost:3000', changeOrigin: true },
      '/classes': { target: 'http://localhost:3000', changeOrigin: true },
      '/openapi.json': { target: 'http://localhost:3000', changeOrigin: true },
      '/docs': { target: 'http://localhost:3000', changeOrigin: true },
      '/admin': { target: 'http://localhost:3000', changeOrigin: true }
    }
  }
})
