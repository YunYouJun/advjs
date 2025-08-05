import { presetAdv } from '@advjs/unocss'
import extractorMdc from '@unocss/extractor-mdc'
import { defineConfig, presetAttributify, presetIcons, presetTypography, presetWind4, transformerDirectives, transformerVariantGroup } from 'unocss'

export default defineConfig({
  presets: [
    presetWind4(),
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
