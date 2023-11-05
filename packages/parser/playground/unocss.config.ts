import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetTypography,
  presetUno,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

import { presetAdv } from '../../unocss/src'

const safelist = [
  'i-ri-file-text-line',
  'i-ri-video-chat-line',
  'i-ri-html5-line',
  'i-ri-markdown-line',
].concat('prose prose-sm m-auto text-left'.split(' '))

export default defineConfig({
  presets: [
    presetUno(),
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
