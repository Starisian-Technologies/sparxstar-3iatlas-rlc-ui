import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

/** Builds the Vite configuration with mode-specific environment variables. */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'SPARXSTAR 3iAtlas RLC',
          short_name: 'RLC',
          description: 'Rapid Language Collection — classroom word game',
          theme_color: '#1B3A6B',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          icons: [
            { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          ],
        },
      }),
    ],
    server: {
      // Proxy /api/* to the Node backend during local development.
      // Set VITE_RLC_BACKEND_URL in .env.local to your Node backend URL.
      proxy: {
        '/api': {
          target: env.VITE_RLC_BACKEND_URL || 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  }
})
