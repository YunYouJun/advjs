import type { ResolvedAdvOptions } from '@advjs/types'
import type { Plugin } from 'vite'
import type { AdvPluginOptions } from '../options'
import Vue from '@vitejs/plugin-vue'
import * as VueCompiler from 'vue/compiler-sfc'
import { customElements } from '../constants'

const vueIncludePatterns = [/\.vue$/, /\.vue\?vue/, /\.vue\?v=/, /\.md$/, /\.md\?vue/]

export async function createVuePlugin(
  _options: ResolvedAdvOptions,
  pluginOptions: AdvPluginOptions,
): Promise<Plugin> {
  const {
    vue: vueOptions = {},
  } = pluginOptions

  const VuePlugin = Vue({
    compiler: VueCompiler,
    include: vueIncludePatterns,
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
