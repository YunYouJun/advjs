import extractorMdc from '@unocss/extractor-mdc'
import { defineConfig, presetAttributify, presetIcons, presetTypography, presetWind3, transformerDirectives, transformerVariantGroup } from 'unocss'
import { presetAdv } from '../unocss/src'

export default defineConfig({
  presets: [
    presetWind3(),
    presetAdv(),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
      // warn: true,
    }),
    presetTypography(),
    // todo, add unocss config it
    // web font is too big
    // presetWebFonts({
    //   fonts: {
    //     ZCOOL: 'ZCOOL XiaoWei',
    //     serif: [
    //       {
    //         name: 'Noto Serif SC',
    //         weights: [900],
    //       },
    //     ],
    //   },
    // }),
  ],
  transformers: [transformerDirectives(), transformerVariantGroup()],

  extractors: [
    extractorMdc(),
  ],
})
