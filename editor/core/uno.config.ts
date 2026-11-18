import { presetAdv } from '@advjs/unocss'
import extractorMdc from '@unocss/extractor-mdc'
import { defineConfig, presetAttributify, presetIcons, presetTypography, presetWind4, transformerDirectives, transformerVariantGroup } from 'unocss'
import { safelist } from '../../packages/gui/unocss'
import { editorIconSafelist } from './app/extensions/icons'

export default defineConfig({
  presets: [
    presetWind4(),
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
    ...editorIconSafelist,
  ],
})
