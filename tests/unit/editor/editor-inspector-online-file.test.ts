import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive, ref } from 'vue'
import { useInspectorOnlineFile } from '../../../editor/core/app/composables/inspector/useInspectorOnlineFile'

const online = reactive({ onlineAdvConfigFileUrl: '' })

beforeEach(() => {
  online.onlineAdvConfigFileUrl = ''
  vi.stubGlobal('useOnlineStore', () => online)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('ref', ref)
})

afterEach(() => vi.unstubAllGlobals())

describe('online file inspector', () => {
  it.each(['', '   ', 'not a URL', 'https://'])('keeps the panel renderable with an absent or invalid URL: %j', (url) => {
    online.onlineAdvConfigFileUrl = url
    const info = useInspectorOnlineFile()

    // Both fields are read while rendering the file panel, even in local mode.
    expect(info.name.value).toBe('')
    expect(info.language.value).toBe('plaintext')
  })

  it('reads the filename and language from a valid URL without query or hash', () => {
    online.onlineAdvConfigFileUrl = 'https://example.com/story/game.adv.json?version=2#chapter'
    const info = useInspectorOnlineFile()

    expect(info.name.value).toBe('game.adv.json')
    expect(info.language.value).toBe('json')
  })

  it('updates after loading, clearing, and replacing the online file', () => {
    const info = useInspectorOnlineFile()
    expect(info.name.value).toBe('')
    online.onlineAdvConfigFileUrl = 'https://example.com/game.adv.json'
    expect(info.name.value).toBe('game.adv.json')
    expect(info.language.value).toBe('json')
    online.onlineAdvConfigFileUrl = ''
    expect(info.name.value).toBe('')
    expect(info.language.value).toBe('plaintext')
    online.onlineAdvConfigFileUrl = 'https://example.com/chapter.adv.md'
    expect(info.name.value).toBe('chapter.adv.md')
    expect(info.language.value).toBe('plaintext')
  })
})
