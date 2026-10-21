/**
 * SPIKE: standalone offline player for WKWebView.
 *
 * Mirrors the parts of `apps/studio/vite.config.ts` that embed `@advjs/client`
 * (game locales, UnoCSS, component auto-import, embed-safe client barrel) and
 * nothing from the authoring app.
 *
 * Usage: pnpm exec vite build --config apps/studio-ios/spike/player/vite.config.ts
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
import { parse as parseYaml } from 'yaml'

const here = import.meta.dirname
const repoRoot = path.resolve(here, '../../../..')

export default defineConfig({
  root: here,
  base: './',
  define: {
    __DEV__: 'false',
  },
  plugins: [
    {
      // Measure current workspace sources rather than whichever dist builds happen to exist.
      name: 'advjs-player:workspace-sources',
      enforce: 'pre',
      resolveId(id) {
        const match = /^@advjs\/([\w-]+)$/u.exec(id)
        if (!match || match[1] === 'client')
          return
        for (const candidate of [`packages/${match[1]}/src/index.ts`, `plugins/${match[1]}/src/index.ts`]) {
          const file = path.join(repoRoot, candidate)
          if (existsSync(file))
            return file
        }
      },
    },
    {
      name: 'advjs-player:game-locales',
      resolveId(id) {
        if (id === '/@advjs/locales' || id === 'virtual:advjs-game-locales')
          return '\0virtual:advjs-locales'
      },
      load(id) {
        if (id !== '\0virtual:advjs-locales')
          return
        const messages = Object.fromEntries(['en', 'zh-CN'].map(locale => [
          locale,
          parseYaml(readFileSync(path.join(repoRoot, `packages/client/locales/${locale}.yml`), 'utf8')),
        ]))
        return `export default ${JSON.stringify(messages)}`
      },
    },
    UnoCSS({ configFile: path.join(here, 'uno.config.ts') }),
    Components({
      dirs: [
        path.join(repoRoot, 'packages/client/components'),
        path.join(repoRoot, 'themes/theme-default/components'),
      ],
      extensions: ['vue'],
      include: [/\.vue$/, /\.vue\?vue/],
      dts: false,
    }),
    vue(),
  ],
  resolve: {
    alias: [
      { find: /^@advjs\/client$/, replacement: path.join(repoRoot, 'packages/client/embed.ts') },
      { find: /^@advjs\/core\/runtime$/, replacement: path.join(repoRoot, 'packages/core/src/runtime/headless.ts') },
      { find: /^@advjs\/core\/compiler$/, replacement: path.join(repoRoot, 'packages/core/src/compiler/index.ts') },
    ],
  },
  build: {
    outDir: path.resolve(here, '../out/player'),
    emptyOutDir: true,
    target: 'safari18',
    chunkSizeWarningLimit: 5000,
    reportCompressedSize: true,
    // One HTML entry, no service worker, no network origins: everything ships in the app bundle.
    modulePreload: { polyfill: false },
  },
})
