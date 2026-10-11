import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, ref } from 'vue'
import { useEditorLocale } from '../../../editor/core/app/composables/useEditorLocale'
import { resolveEditorLocale } from '../../../editor/core/app/utils/editor-locale'

afterEach(() => {
  localStorage.clear()
  delete window.advDesktop
  vi.unstubAllGlobals()
})
function fixture() {
  const locale = ref('en')
  const setLocale = vi.fn(async (code: string) => {
    locale.value = code
  })
  vi.stubGlobal('useI18n', () => ({ locale, setLocale, locales: ref(['en', 'zh-CN']) }))
  vi.stubGlobal('computed', computed)
  const scope = effectScope()
  const editor = scope.run(useEditorLocale)!
  return { editor, setLocale, scope }
}
describe('editor locale recovery', () => {
  it('honors a valid choice and otherwise uses the first supported browser language', () => {
    expect(resolveEditorLocale('en', ['zh-TW'])).toBe('en')
    expect(resolveEditorLocale(undefined, ['fr', 'zh-Hant'])).toBe('zh-CN')
    expect(resolveEditorLocale('bad', ['en-GB', 'zh-CN'])).toBe('en')
    expect(resolveEditorLocale(undefined, ['ja'])).toBe('en')
  })
  it('resolves a fresh web visit without persisting an incompatible auto value', async () => {
    vi.stubGlobal('navigator', { languages: ['zh-CN'], language: 'zh-CN' })
    const { editor, scope } = fixture()
    await editor.initLocale()
    expect(editor.savedLocale.value).toBe('zh-CN')
    scope.stop()
  })
  it('retains desktop preferences, origin migration, onboarding and explicit host updates', async () => {
    vi.stubGlobal('navigator', { languages: ['zh-CN'] })
    const preferences = vi.fn(async () => ({ locale: 'en', onboarded: false }))
    const setPreferences = vi.fn(async () => {})
    window.advDesktop = { preferences, setPreferences } as unknown as NonNullable<Window['advDesktop']>
    localStorage.setItem('advjs:editor:onboarded', 'true')
    const { editor, scope } = fixture()
    await editor.initLocale()
    expect(editor.savedLocale.value).toBe('en')
    expect(editor.onboarded.value).toBe(true)
    expect(setPreferences).toHaveBeenCalledWith({ locale: 'en', onboarded: true })
    await editor.completeOnboarding('zh-CN')
    expect(setPreferences).toHaveBeenCalledWith({ locale: 'zh-CN' })
    expect(setPreferences).toHaveBeenCalledWith({ onboarded: true })
    scope.stop()
  })
})
