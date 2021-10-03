import { defineConfig } from 'windicss/helpers'

import colors from 'windicss/colors'

export default defineConfig({
  // https://windicss.org/guide/extractions.html
  extract: {
    include: [
      '**/*.md',
      '.vitepress/theme/**/*.{md,vue}',
      '../packages/advjs/src/client/app/components/global/PressButton.vue',
    ],
  },
  darkMode: 'class',
  // https://windicss.org/posts/v30.html#attributify-mode
  attributify: true,

  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: colors.blue[600],
          deep: colors.blue[700],
        },
      },
    },
  },
})
