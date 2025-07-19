import Vue from '@vitejs/plugin-vue'
import { presetAttributify, presetIcons, presetWind4 } from 'unocss'
import UnoCSS from 'unocss/vite'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    UnoCSS({
      presets: [
        presetWind4(),
        presetAttributify(),
        presetIcons({
          scale: 1.2,
          // warn: true,
        }),
      ],
    }),
    Vue(),
  ],
})
