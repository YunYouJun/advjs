import type { LocaleMessage } from 'vue-i18n'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { createI18n, useI18n } from 'vue-i18n'
import { parse } from 'yaml'
import AdvFullscreenBtn from '../../../packages/client/components/menu/AdvFullscreenBtn.vue'

vi.mock('../../../packages/advjs/node/options/utils', () => ({ resolveOptions: async () => ({}) }))
vi.mock('../../../packages/vite-plugin-adv/src', () => ({
  default: (_options: unknown, pluginOptions: unknown) => ({ name: 'test:adv', pluginOptions }),
}))
vi.mock('../../../editor/core/app/constants/index', () => ({
  appDescription: 'Editor',
  appName: 'Editor',
}))
vi.mock('simple-git', () => ({ simpleGit: () => ({ log: async () => ({ all: [] }) }) }))

interface EditorLocale {
  code: 'en' | 'zh-CN'
  files: string[]
}

interface EditorConfig {
  i18n: {
    strategy: string
    defaultLocale: string
    detectBrowserLanguage: boolean
    langDir: string
    locales: EditorLocale[]
  }
  modules: string[]
  vite: { plugins: unknown[] }
}

let config: EditorConfig

beforeAll(async () => {
  vi.stubGlobal('defineNuxtConfig', (value: EditorConfig) => value)
  config = (await import('../../../editor/core/nuxt.config')).default as EditorConfig
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('editor embedded-player translations', () => {
  it('uses Nuxt as the single locale compiler and keeps locale choice with the editor', () => {
    expect(config.vite.plugins).toContainEqual({ name: 'test:adv', pluginOptions: { i18n: false } })
    expect(config.modules.filter(module => module === '@nuxtjs/i18n')).toHaveLength(1)
    expect(config.i18n.strategy).toBe('no_prefix')
    expect(config.i18n.defaultLocale).toBe('en')
    expect(config.i18n.detectBrowserLanguage).toBe(false)
  })

  it('merges player and editor messages in both languages into the same reactive composer', async () => {
    const i18n = createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en' })
    const localeDir = resolve(import.meta.dirname, '../../../editor/core/i18n', config.i18n.langDir)

    expect(config.i18n.locales.map(locale => locale.code)).toEqual(['en', 'zh-CN'])
    for (const locale of config.i18n.locales) {
      expect(locale.files).toHaveLength(2)
      // Nuxt loads files in order, deep-merging later editor messages over shared player messages.
      for (const file of locale.files) {
        const source = await readFile(resolve(localeDir, file), 'utf8')
        const messages: LocaleMessage<string> = file.endsWith('.json') ? JSON.parse(source) : parse(source)
        i18n.global.mergeLocaleMessage(locale.code, messages)
      }
    }

    const Host = defineComponent({
      setup() {
        const { t } = useI18n()
        return () => h('div', [
          h('span', { 'data-editor': '' }, t('menu.newProject')),
          h('span', { 'data-player': '' }, t('save.quick_save')),
          h(AdvFullscreenBtn),
        ])
      },
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = mount(Host, {
      global: {
        plugins: [i18n],
        stubs: { AdvIconButton: { template: '<button><slot /></button>' } },
      },
    })

    try {
      expect(wrapper.get('[data-editor]').text()).toBe('New Project')
      expect(wrapper.get('[data-player]').text()).toBe('Quick Save')
      expect(wrapper.get('button').attributes('title')).toBe('Toggle full screen')
      expect(i18n.global.t('menu.new_game')).toBe('New Game')

      i18n.global.locale.value = 'zh-CN'
      await nextTick()

      expect(wrapper.get('[data-editor]').text()).toBe('新建项目')
      expect(wrapper.get('[data-player]').text()).toBe('快速存档')
      expect(wrapper.get('button').attributes('title')).toBe('切换全屏')
      expect(i18n.global.t('menu.new_game')).toBe('开始游戏')
      expect(warn).not.toHaveBeenCalled()
    }
    finally {
      wrapper.unmount()
      warn.mockRestore()
    }
  })
})
