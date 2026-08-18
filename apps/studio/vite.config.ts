/// <reference types="vitest" />

import path from 'node:path'
import process from 'node:process'

const legacyPluginPackage: string = '@vitejs/plugin-legacy'
const vuePluginPackage: string = '@vitejs/plugin-vue'
const unocssPluginPackage: string = 'unocss/vite'
const pwaPluginPackage: string = 'vite-plugin-pwa'
const componentsPluginPackage: string = 'unplugin-vue-components/vite'

// https://vitejs.dev/config/
export default async function createViteConfig() {
  // Keep Vite plugin imports dynamic so editors using legacy moduleResolution do not fail on package .d.ts/.d.mts exports.
  const [
    { default: legacy },
    { default: vue },
    { default: UnoCSS },
    { VitePWA },
    { default: Components },
  ] = await Promise.all([
    import(legacyPluginPackage),
    import(vuePluginPackage),
    import(unocssPluginPackage),
    import(pwaPluginPackage),
    import(componentsPluginPackage),
  ])

  // The embedded `@advjs/client` runtime (Play tab) renders `AdvGame.vue`,
  // whose template references game components (AdvContainer / AdvDialogBox /
  // AdvChoice / AdvGameUI / ...) **without importing them** — the main advjs
  // app resolves these via unplugin-vue-components auto-import over both the
  // client component tree and the active theme's components (AdvIcon et al.
  // live in theme-default). Studio embeds the runtime directly, so without the
  // same auto-import those children fail to resolve and the game renders blank.
  const advComponentDirs = [
    path.join(import.meta.dirname, '../../packages/client/components'),
    path.join(import.meta.dirname, '../../themes/theme-default/components'),
  ]

  return {
    // `__DEV__` is referenced inside `@advjs/client` and `@advjs/parser` source
    // (originally meant for their own Vite-driven builds). When those packages
    // are consumed via path aliases here, the constant is unresolved unless we
    // declare it ourselves. `import.meta.env.DEV` resolves to true in dev /
    // false in build. Under Vitest the config is loaded outside a module
    // context where `import.meta` cannot be evaluated ("Cannot use 'import.meta'
    // outside a module"), so fall back to a plain literal there.
    define: {
      __DEV__: process.env.VITEST ? 'true' : 'import.meta.env.DEV',
    },
    plugins: [
      // `/@advjs/locales` is a virtual module owned by `@advjs/vite-plugin-adv`,
      // which Studio does not load (Studio has its own i18n via vue-i18n + JSON
      // locales). The embedded `@advjs/client` runtime still imports it inside
      // `modules/i18n.ts`, so we stub it to an empty messages map to satisfy
      // the bundler.
      {
        name: 'advjs-studio:stub-virtual-locales',
        resolveId(id: string) {
          if (id === '/@advjs/locales')
            return '\0virtual:advjs-locales'
        },
        load(id: string) {
          if (id === '\0virtual:advjs-locales')
            return 'export default { "zh-CN": {}, en: {} }'
        },
      },
      UnoCSS(),
      Components({
        // Scope strictly to the @advjs/client component tree. Studio's own
        // components are explicitly imported, so we deliberately do NOT scan
        // src/components here to avoid surprise global auto-registration.
        dirs: advComponentDirs,
        extensions: ['vue'],
        include: [/\.vue$/, /\.vue\?vue/],
        dts: false,
      }),
      vue(),
      ...(process.env.VITE_LEGACY_BUILD === 'false' ? [] : [legacy()]),
      VitePWA({
        registerType: 'prompt',
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
    build: {
      chunkSizeWarningLimit: 5000,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            // Monaco Editor — largest dependency, cache separately
            if (id.includes('monaco-editor'))
              return 'monaco-editor'
            // Ionic UI — shared across almost every page
            if (id.includes('@ionic/vue') || id.includes('@ionic/core') || id.includes('ionicons'))
              return 'ionic'
          },
        },
      },
    },
    resolve: {
      alias: [
        // Client and theme components still use the package's public barrel.
        // Point only that exact import at the embed-safe surface; subpath
        // imports continue to resolve through the package exports normally.
        {
          find: /^@advjs\/client$/,
          replacement: path.join(import.meta.dirname, '../../packages/client/embed.ts'),
        },
        { find: '@', replacement: path.join(import.meta.dirname, 'src') },
        { find: '@advjs/types', replacement: path.join(import.meta.dirname, '../../packages/types/src/index.ts') },
        { find: '@advjs/parser', replacement: path.join(import.meta.dirname, '../../packages/parser/src/index.ts') },
      ],
    },
    test: {
      globals: true,
      environment: 'jsdom',
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      exclude: ['tests/**', 'src/**/*.e2e.*'],
    },
  }
}
