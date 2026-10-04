import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { useEditorLocale } from '../../editor/core/app/composables/useEditorLocale'
import { resolveEditorLocale } from '../../editor/core/app/utils/editor-locale'
import en from '../../editor/core/i18n/locales/en.json'
import zh from '../../editor/core/i18n/locales/zh-CN.json'

const storageKey = 'advjs:editor:locale'
const scopes: ReturnType<typeof effectScope>[] = []

beforeEach(() => localStorage.clear())
afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

function createLocale(languages = ['zh-CN', 'en-US']) {
  const locale = ref('en')
  const setLocale = vi.fn(async (code: string) => {
    locale.value = code
  })
  vi.stubGlobal('useI18n', () => ({ locale, setLocale, locales: ref(['en', 'zh-CN']) }))
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages)
  const scope = effectScope()
  scopes.push(scope)
  return { ...scope.run(useEditorLocale)!, setLocale, scope }
}

describe('editor language preferences', () => {
  it.each([
    [undefined, ['zh-CN'], 'zh-CN'],
    ['auto', ['zh-TW'], 'zh-CN'],
    ['auto', ['zh-HK'], 'zh-CN'],
    ['auto', ['ZH_hans_CN'], 'zh-CN'],
    ['auto', ['en-GB', 'zh-CN'], 'en'],
    ['auto', ['fr-FR', 'zh-CN'], 'zh-CN'],
    ['auto', ['ja-JP'], 'en'],
    ['auto', [], 'en'],
    ['invalid', ['zh'], 'zh-CN'],
    ['en', ['zh-CN'], 'en'],
    ['zh-CN', ['en-US'], 'zh-CN'],
  ])('resolves preference %s with languages %j to %s', (preference, languages, expected) => {
    expect(resolveEditorLocale(preference, languages as string[])).toBe(expected)
  })

  it('follows the browser on first use without persisting a guessed language', async () => {
    const state = createLocale()
    await state.initLocale()
    expect(state.locale.value).toBe('zh-CN')
    expect(state.savedLocale.value).toBe('auto')
    expect(localStorage.getItem(storageKey)).toBeNull()
  })

  it('remembers manual choices on a fresh instance and can return to automatic mode', async () => {
    const state = createLocale(['en-US'])
    await state.changeLocale('zh-CN')
    await nextTick()
    expect(localStorage.getItem(storageKey)).toBe('zh-CN')
    state.scope.stop()
    const reloaded = createLocale(['en-US'])
    await reloaded.initLocale()
    expect(reloaded.locale.value).toBe('zh-CN')
    await reloaded.changeLocale('auto')
    await nextTick()
    expect(reloaded.locale.value).toBe('en')
    expect(localStorage.getItem(storageKey)).toBe('auto')
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['zh-TW'])
    await reloaded.initLocale()
    expect(reloaded.locale.value).toBe('zh-CN')
  })

  it('preserves an existing explicit preference and recovers from unsupported stored values', async () => {
    localStorage.setItem(storageKey, 'en')
    const state = createLocale(['zh-CN'])
    await state.initLocale()
    expect(state.locale.value).toBe('en')
    state.scope.stop()
    localStorage.setItem(storageKey, 'invalid')
    const recovered = createLocale(['zh-CN'])
    await recovered.initLocale()
    expect(recovered.savedLocale.value).toBe('auto')
    expect(recovered.locale.value).toBe('zh-CN')
  })

  it('does not persist a preference if loading the language fails', async () => {
    const state = createLocale()
    state.setLocale.mockRejectedValueOnce(new Error('Load failed'))
    await expect(state.changeLocale('zh-CN')).rejects.toThrow('Load failed')
    expect(localStorage.getItem(storageKey)).toBeNull()
  })
})

it('keeps English and Chinese translation keys aligned and resolves context labels', () => {
  function keys(value: Record<string, unknown>, prefix = ''): string[] {
    return Object.entries(value).flatMap(([key, item]) => typeof item === 'object' && item !== null
      ? keys(item as Record<string, unknown>, `${prefix}${key}.`)
      : [`${prefix}${key}`]).sort()
  }
  expect(keys(en)).toEqual(keys(zh))
  const i18n = createI18n({ legacy: false, locale: 'zh-CN', messages: { en, 'zh-CN': zh } })
  expect(i18n.global.t('workspace.sections.chapters_index')).toBe('章节索引')
  expect(i18n.global.t('workspace.chapterCount', { count: 3 })).toBe('3 个章节')
  expect(i18n.global.t('characters.visual.title')).toBe('视觉设定')
  i18n.global.locale.value = 'en'
  expect(i18n.global.t('characters.visual.title')).toBe('Visual identity')
})
