import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://api.qgents.dpdns.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api/v1'),
        configure: (proxy) => {
          // 删掉浏览器带来的 Origin 头，后端就不会把它当跨域请求（避免 Spring 抛 "Invalid CORS request"）
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('origin')
          })
        },
      },
    },
  },
})
