// import Inspect from 'vite-plugin-inspect'
import { defineConfig } from 'vite'

// import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    // https://github.com/antfu/vite-plugin-pwa
    // VitePWA({
    //   registerType: 'autoUpdate',
    //   includeAssets: ['favicon.svg', 'robots.txt', 'safari-pinned-tab.svg'],
    //   manifest: {
    //     name: 'ADV.JS',
    //     short_name: 'ADV',
    //     theme_color: '#000',
    //   },
    // }),

    // Inspect({
    //   enabled: true,
    // }),
  ],
})
