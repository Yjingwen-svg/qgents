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
     * TODO[后端联调] 关闭 MSW（VITE_USE_MOCK=false）后，把 /api 代理到后端：
     * - 本地演示服：http://localhost:8080（github-auth-demo-server）
     * - 或 Java 服务地址
     * 否则 fetch('/api/...') 可能打到 Vite 自己，返回 HTML → Unexpected token '<'
     */
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
