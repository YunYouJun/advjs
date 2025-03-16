import type { Plugin } from 'vite'
import type { AdvPluginOptions, ResolvedAdvOptions } from '../options'
import Vue from '@vitejs/plugin-vue'

const customElements = new Set([
  'font',

  // katex
  'annotation',
  'math',
  'menclose',
  'mfrac',
  'mglyph',
  'mi',
  'mlabeledtr',
  'mn',
  'mo',
  'mover',
  'mpadded',
  'mphantom',
  'mroot',
  'mrow',
  'mspace',
  'msqrt',
  'mstyle',
  'msub',
  'msubsup',
  'msup',
  'mtable',
  'mtd',
  'mtext',
  'mtr',
  'munder',
  'munderover',
  'semantics',
])

export async function createVuePlugin(
  _options: ResolvedAdvOptions,
  pluginOptions: AdvPluginOptions,
): Promise<Plugin> {
  const {
    vue: vueOptions = {},
  } = pluginOptions

  const VuePlugin = Vue({
    include: [/\.vue$/, /\.vue\?vue/, /\.vue\?v=/, /\.md$/, /\.md\?vue/],
    exclude: [],
    ...vueOptions,
    template: {
      ...vueOptions?.template,
      compilerOptions: {
        ...vueOptions?.template?.compilerOptions,
        isCustomElement(tag) {
          return customElements.has(tag) || vueOptions?.template?.compilerOptions?.isCustomElement?.(tag)
        },
      },
    },
  })

  return VuePlugin
}
