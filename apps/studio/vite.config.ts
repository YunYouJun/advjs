/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    UnoCSS(),
    vue(),
    legacy(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'ADV.JS Studio',
        short_name: 'ADV Studio',
        description: 'Visual novel creation studio',
        theme_color: '#8b5cf6',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Monaco editor ts.worker.js ~7MB, editor.api2 ~4MB
        maximumFileSizeToCacheInBytes: 10 * 1000 * 1000,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Cache app shell and static assets
            urlPattern: /^https:\/\/.*\.(js|css|html|png|svg|ico|woff2)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
            },
          },
          {
            // AI API calls: network first (never serve stale AI responses)
            urlPattern: /^https:\/\/api\.(deepseek|openai|siliconflow|openrouter)\./,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': `${import.meta.dirname}/src`,
      '@advjs/types': `${import.meta.dirname}/../../packages/types/src/index.ts`,
      '@advjs/parser': `${import.meta.dirname}/../../packages/parser/src/index.ts`,
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
})
