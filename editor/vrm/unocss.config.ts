import { presetAdv } from '@advjs/unocss'
import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetTypography,
  presetWind4,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

const safelist = 'm-auto text-left'.split(' ')

export default defineConfig({
  content: {
    pipeline: {
      include: ['**/*.{md,vue}', '../../themes/theme-default/**/*.{md,vue}'],
    },
  },

  presets: [
    presetWind4(),
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
