import extractorMdc from '@unocss/extractor-mdc'
import { defineConfig, presetAttributify, presetIcons, presetTypography, presetWind3, transformerDirectives, transformerVariantGroup } from 'unocss'
import { safelist } from '../../packages/gui/unocss'
import { presetAdv } from '../../packages/unocss/src'

export default defineConfig({
  presets: [
    presetWind3(),
    presetAdv(),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
    }),
    presetTypography(),
  ],
  transformers: [
    transformerDirectives(),
    transformerVariantGroup(),
  ],
  extractors: [
    extractorMdc(),
  ],

  safelist: [
    ...safelist,
  ],
})
