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
    /**
     * 开发联调代理：前端仍请求 /api/...，由 Vite 转到后端 /api/v1/...
     * 当前目标：https://api.qgents.dpdns.org/api/v1（后台组公网联调）
     *
     * 切回本地 demo：
     *   target: 'http://localhost:8080'
     *   并去掉 rewrite（demo 路径是 /api/... 不是 /api/v1）
     */
    proxy: {
      '/api': {
        target: 'https://api.qgents.dpdns.org',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, '/api/v1'),
      },
    },
  },
})
