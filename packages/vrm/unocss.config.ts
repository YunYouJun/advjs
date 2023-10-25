import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetTypography,
  presetUno,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

import { presetAdv } from '@advjs/unocss'

const safelist = 'm-auto text-left'.split(' ')

export default defineConfig({
  content: {
    pipeline: {
      include: ['**/*.{md,vue}', '../theme-default/**/*.{md,vue}'],
    },
  },

  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
      warn: true,
    }),
    presetTypography(),
    presetAdv(),
  ],
  transformers: [
    transformerDirectives(),
    transformerVariantGroup(),
  ],
  safelist,
})
