import { defineConfig, presetIcons } from 'unocss'
import { safelist } from '../../packages/gui/unocss'

export default defineConfig({
  presets: [
    presetIcons({
      scale: 1.2,
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
      },
    }),
  ],
  safelist: [
    ...safelist,
  ],
})
