import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetTypography,
  presetUno,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'
// @advjs/unocss
import { presetAdv } from '../unocss/src'

const safelist = 'm-auto text-left'.split(' ')

export default defineConfig({
  include: ['**/*.{md,vue}', '../theme-default/**/*.{md,vue}'],

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
