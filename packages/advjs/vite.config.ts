import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  // for '~/components'
  alias: {
    '~': path.resolve(__dirname, './src')
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        parser: path.resolve(__dirname, '/parser/index.html')
      }
    }
  }
});
