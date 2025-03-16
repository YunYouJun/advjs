import extractorMdc from '@unocss/extractor-mdc'
import { defineConfig, presetAttributify, presetIcons, presetTypography, presetWind3, transformerDirectives, transformerVariantGroup } from 'unocss'

export default defineConfig({
  shortcuts: [
    [
      'adv-animated-faster',
      'animate-fill-mode-both animate-duration-100',
    ],
    [
      'adv-animated-fast',
      'animate-fill-mode-both animate-duration-$adv-animation-duration-fast',
    ],
    [
      'adv-animated',
      'animate-fill-mode-both animate-duration-$adv-animation-duration',
    ],
    [
      'adv-animated-slow',
      'animate-fill-mode-both animate-duration-$adv-animation-duration-slow',
    ],
    ['font-serif', 'font-$adv-font-serif'],
    ['font-sans', 'font-$adv-font-sans'],
    ['font-mono', 'font-$adv-font-mono'],
  ],
  presets: [
    presetWind3(),
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
  safelist: [
    'm-auto',
    // for cur font size
    'text-xl',
    'text-2xl',
    'text-3xl',
    'text-4xl',

    'grid-cols-1',
    'grid-cols-2',
    'grid-cols-3',

    'i-ri-archive-line',
    'i-ri-folder-2-line',
    'i-ri-price-tag-3-line',
    'i-ri-cloud-line',
  ],

  extractors: [
    extractorMdc(),
  ],
})
