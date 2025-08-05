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

const safelist = [
  'i-ri-file-text-line',
  'i-ri-video-chat-line',
  'i-ri-html5-line',
  'i-ri-markdown-line',
].concat('prose prose-sm m-auto text-left'.split(' '))

export default defineConfig({
  presets: [
    presetWind4(),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
      warn: true,
    }),
    presetTypography(),
    // advjs
    presetAdv(),
  ],
  transformers: [
    transformerDirectives(),
    transformerVariantGroup(),
  ],
  safelist,
})
