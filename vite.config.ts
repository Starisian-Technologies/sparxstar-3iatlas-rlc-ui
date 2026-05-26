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
        // Cache API responses for offline resilience
        runtimeCaching: [
          {
            urlPattern: /\/aiwa\/v1\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'aiwa-api',
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
    }),
  ],
  server: {
    // Proxy API calls to WordPress during local development
    // Set VITE_WP_URL in .env.local to your WordPress dev site
    proxy: {
      // The client calls /aiwa/v1/* but WordPress mounts REST routes under
      // /wp-json. Rewrite so dev requests reach the real route; in production
      // the plugin injects window.RLC_API_BASE with the correct prefix.
      '/aiwa': {
        target: process.env.VITE_WP_URL || 'http://localhost:8888',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/aiwa/, '/wp-json/aiwa'),
      },
      '/wp-json': {
        target: process.env.VITE_WP_URL || 'http://localhost:8888',
        changeOrigin: true,
      },
    },
  },
})
