import { fileURLToPath } from 'node:url'
import Vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  root: fileURLToPath(new URL('./client', import.meta.url)),
  base: './',
  plugins: [Vue()],
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        panel: fileURLToPath(new URL('./client/index.html', import.meta.url)),
        runtime: fileURLToPath(new URL('./client/runtime.ts', import.meta.url)),
      },
      external: ['/@vite/client'],
      output: { entryFileNames: chunk => chunk.name === 'runtime' ? 'runtime.js' : 'assets/[name]-[hash].js' },
    },
  },
})
