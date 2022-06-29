import defu from 'defu'
import Unocss from 'unocss/vite'

import {
  presetAttributify,
  presetIcons,
  presetTypography,
  presetUno,
  presetWebFonts,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'
import type { VitePluginConfig } from 'unocss/vite'
import type { AdvConfig } from '@advjs/types'
import type { AdvPluginOptions, ResolvedAdvOptions } from '..'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const createSafelist = async (config: AdvConfig) => {
  const safeIcons: string[] = [
    'i-ri-archive-line',
    'i-ri-folder-2-line',
    'i-ri-price-tag-3-line',

    'i-ri-cloud-line',
  ]

  const safelist = [
    'm-auto',
    // for cur font size
    'text-xl',
    'text-2xl',
    'text-3xl',

    'grid-cols-1',
    'grid-cols-2',
    'grid-cols-3',
  ].concat(safeIcons)

  return safelist
}

export const createUnocssConfig = async (options: ResolvedAdvOptions, unocssOptions: AdvPluginOptions['unocss'] = {}) => {
  const unocssConfig: VitePluginConfig | string = {
    shortcuts: [],
    presets: [
      presetUno(),
      presetAttributify(),
      presetIcons({
        scale: 1.2,
        // warn: true,
      }),
      presetTypography(),
      // todo, add unocss config it
      presetWebFonts({
        fonts: {
          ZCOOL: 'ZCOOL XiaoWei',
          serif: [
            {
              name: 'Noto Serif SC',
              weights: [900],
            },
          ],
        },
      }),
    ],
    rules: [
      // ['font-serif', {
      //   'font-family': 'var(--adv-font-serif)',
      // }],
      // ['font-sans', {
      //   'font-family': 'var(--adv-font-sans)',
      // }],
      // ['font-mono', {
      //   'font-family': 'var(--adv-font-mono)',
      // }],
    ],
    transformers: [
      transformerDirectives(),
      transformerVariantGroup(),
    ],
    safelist: await createSafelist(options.data.config),
  }

  if (typeof unocssOptions !== 'string')
    return defu(unocssOptions, unocssConfig)
  else
    return unocssOptions
}

export const createUnocssPlugin = async (options: ResolvedAdvOptions, pluginOptions: AdvPluginOptions) => {
  const config = await createUnocssConfig(options, pluginOptions.unocss)
  return Unocss(config)
}
