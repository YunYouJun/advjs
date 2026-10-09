import type { AdvData } from '@advjs/types'
import { describe, expect, it, vi } from 'vitest'
import { computed, shallowRef } from 'vue'
import { initAdvContext } from '../../../packages/client/compiler'
import fixture from '../../fixtures/adv-data'

vi.mock('../../../packages/client/setup/context', () => ({ setupAdvContext: (context: unknown) => context }))

describe('client theme configuration', () => {
  it('uses standalone configuration while preserving inline defaults after refresh', () => {
    const data = shallowRef<AdvData>({
      ...fixture,
      config: { ...fixture.config, themeConfig: { ui: { colorScheme: 'dark', tokens: { '--adv-theme-start-title-gap': '36px', '--adv-theme-start-menu-size': '18px' } } } },
      themeConfig: { ui: { colorScheme: 'light', tokens: { '--adv-theme-start-title-gap': '48px' } } },
    })
    const context = initAdvContext(computed(() => data.value))
    expect(context.themeConfig.value.ui).toEqual({ colorScheme: 'light', tokens: { '--adv-theme-start-title-gap': '48px', '--adv-theme-start-menu-size': '18px' } })
    data.value = { ...data.value, themeConfig: { ui: { tokens: { '--adv-theme-start-title-gap': '52px' } } } }
    expect(context.themeConfig.value.ui).toEqual({ colorScheme: 'dark', tokens: { '--adv-theme-start-title-gap': '52px', '--adv-theme-start-menu-size': '18px' } })
  })

  it('keeps projects with only inline configuration compatible', () => {
    const data = { ...fixture, config: { ...fixture.config, themeConfig: { ui: { colorScheme: 'light' as const } } } }
    expect(initAdvContext(computed(() => data)).themeConfig.value.ui?.colorScheme).toBe('light')
  })
})
