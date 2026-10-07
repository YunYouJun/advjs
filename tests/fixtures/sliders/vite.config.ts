import { fileURLToPath } from 'node:url'
import Vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  define: { __DEV__: false },
  plugins: [Vue()],
  server: { host: '127.0.0.1', fs: { allow: [fileURLToPath(new URL('../../..', import.meta.url))] } },
})
