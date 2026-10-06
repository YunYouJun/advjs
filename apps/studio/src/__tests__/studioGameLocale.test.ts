import { describe, expect, it } from 'vitest'
import i18n from '../i18n'

describe('studio and embedded game translations', () => {
  it.each(['en', 'zh-CN'] as const)('keeps nested game and authoring copy available in %s', (locale) => {
    for (const key of [
      'menu.save_game',
      'save.quick_load',
      'ui.history',
      'settings.play_speed',
      'settings.colorMode',
      'runtimeInspector.open',
      'runtimeInspector.returnToPlay',
    ]) {
      expect(i18n.global.te(key, locale), key).toBe(true)
      expect(i18n.global.t(key, {}, { locale }), key).not.toBe(key)
    }
  })
})
