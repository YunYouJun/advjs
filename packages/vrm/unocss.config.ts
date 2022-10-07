import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetTypography,
  presetUno,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'
import { presetAdv } from 'advjs'

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
