import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetTypography,
  presetWind3,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

import { presetAdv } from '../../packages/unocss/src'

const safelist = 'm-auto text-left'.split(' ')

export default defineConfig({
  content: {
    pipeline: {
      include: ['**/*.{md,vue}', '../../themes/theme-default/**/*.{md,vue}'],
    },
  },

  presets: [
    presetWind3(),
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
