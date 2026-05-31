import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

export default defineConfig({
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
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /\/api\/v1\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'rlc-api',
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
    }),
  ],
  server: {
    // Proxy /api/* to the Node backend during local development.
    // Set VITE_RLC_BACKEND_URL in .env.local to your Node backend URL.
    proxy: {
      '/api': {
        target: process.env.VITE_RLC_BACKEND_URL || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
