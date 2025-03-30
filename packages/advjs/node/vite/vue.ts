import type { Plugin } from 'vite'
import type { AdvPluginOptions, ResolvedAdvOptions } from '../options'
import Vue from '@vitejs/plugin-vue'
import { customElements } from '../constants'

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
