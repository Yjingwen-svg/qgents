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
     * 本地 GitHub 联调：/api → github-auth-demo-server
     * 公网恢复后再改回 api.qgents.dpdns.org + rewrite /api → /api/v1
     * 当前已切回公网；若 .env.local 直连 VITE_API_BASE_URL，本 proxy 不生效
     */
    proxy: {
      '/api': {
        target: 'https://api.qgents.dpdns.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api/v1'),
      },
    },
  },
})
