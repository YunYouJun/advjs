import type { AdvCharacter } from '@advjs/types'
import type { App } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, effectScope, h, nextTick, reactive, ref } from 'vue'
import CharacterAvatar from '../../../editor/core/app/components/character/CharacterAvatar.vue'
import CharacterCard from '../../../editor/core/app/components/character/CharacterCard.vue'
import CharacterDetail from '../../../editor/core/app/components/character/CharacterDetail.vue'
import CharacterList from '../../../editor/core/app/components/character/CharacterList.vue'
import RelationshipEditor from '../../../editor/core/app/components/character/RelationshipEditor.vue'
import TachieManager from '../../../editor/core/app/components/character/TachieManager.vue'
import AEAudioLibraryItem from '../../../editor/core/app/components/panel/audio/AEAudioLibraryItem.vue'
import { audioLibrarySrc, parseAudioLibrary, useAudioLibrary } from '../../../editor/core/app/composables/useAudioLibrary'
import AGUIDetails from '../../../packages/gui/client/components/AGUIDetails.vue'
import AGUIProperty from '../../../packages/gui/client/components/AGUIProperty.vue'
import AGUIButton from '../../../packages/gui/client/components/button/AGUIButton.vue'
import AGUIIconButton from '../../../packages/gui/client/components/button/AGUIIconButton.vue'
import AGUIInput from '../../../packages/gui/client/components/input/AGUIInput.vue'
import AGUIToolbar from '../../../packages/gui/client/components/toolbar/AGUIToolbar.vue'

vi.mock('../../../editor/core/app/stores/useProjectAssets', () => ({ useProjectAssets: () => ({}) }))
beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubGlobal('useProjectStore', () => ({ workspace: undefined, resourceRevision: 0, projectAssetUrl: async (src: string) => src }))
  vi.stubGlobal('useCharacterStore', () => ({}))
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }))
})

let app: App | undefined
const scopes: ReturnType<typeof effectScope>[] = []
afterEach(() => {
  app?.unmount()
  scopes.splice(0).forEach(scope => scope.stop())
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
function mount(render: () => ReturnType<typeof h>) {
  const container = document.createElement('div')
  document.body.append(container)
  app = createApp({ render })
  app.config.globalProperties.$t = (key: string, params?: { name: string }) => `${key}${params ? ` ${params.name}` : ''}`
  Object.entries({ AGUIDetails, AGUIProperty, AGUIButton, AGUIIconButton, AGUIInput, AGUIToolbar, CharacterCard }).forEach(([name, component]) => app!.component(name, component))
  app.mount(container)
  return container
}
async function fill(input: HTMLInputElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}
const character = (id: string, tachies = {}): AdvCharacter => ({ id, name: id, tachies })

describe('editor character panels', () => {
  it('resolves project avatars in both the character list and inspector', async () => {
    const projectAssetUrl = vi.fn(async () => 'blob:portrait')
    vi.stubGlobal('useProjectStore', () => ({ workspace: {}, resourceRevision: 0, projectAssetUrl }))
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { revokeObjectURL })
    const guide = { ...character('guide'), avatar: '/img/characters/xiaoyun.webp' }
    const root = mount(() => h('div', [h(CharacterCard, { character: guide, mode: 'list' }), h(CharacterDetail, { character: guide, actions: false })]))
    expect(projectAssetUrl.mock.calls).toEqual([[guide.avatar], [guide.avatar]])
    await vi.waitFor(() => expect([...root.querySelectorAll('img')].map(image => image.getAttribute('src'))).toEqual(['blob:portrait', 'blob:portrait']))
    expect(root.querySelectorAll('.ae-character-avatar.list')).toHaveLength(2)
    app?.unmount()
    app = undefined
    expect(revokeObjectURL).toHaveBeenCalledTimes(2)
  })

  it('replaces missing or undecodable avatars with a placeholder and reloads changed resources', async () => {
    const projectAssetUrl = vi.fn().mockRejectedValueOnce(new Error('Missing asset')).mockResolvedValue('blob:recovered')
    const project = reactive({ workspace: {}, resourceRevision: 0, projectAssetUrl })
    vi.stubGlobal('useProjectStore', () => project)
    vi.stubGlobal('URL', { revokeObjectURL: vi.fn() })
    const root = mount(() => h(CharacterAvatar, { src: '/portrait.png' }))
    await vi.waitFor(() => expect(root.querySelector('.i-ri-image-line')).not.toBeNull())
    expect(root.querySelector('img')).toBeNull()
    project.resourceRevision++
    await vi.waitFor(() => expect(root.querySelector('img')?.getAttribute('src')).toBe('blob:recovered'))
    root.querySelector('img')!.dispatchEvent(new Event('error'))
    await nextTick()
    expect(root.querySelector('img')).toBeNull()
    expect(root.querySelector('.i-ri-image-line')).not.toBeNull()
    project.resourceRevision++
    await vi.waitFor(() => expect(root.querySelector('img')).not.toBeNull())
  })

  it('ignores stale project avatar reads and releases their object URLs', async () => {
    let resolveOld!: (url: string) => void
    const projectAssetUrl = vi.fn().mockImplementationOnce(() => new Promise<string>(resolve => resolveOld = resolve)).mockResolvedValue('blob:new')
    vi.stubGlobal('useProjectStore', () => ({ workspace: {}, resourceRevision: 0, projectAssetUrl }))
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { revokeObjectURL })
    const src = ref('/old.png')
    const root = mount(() => h(CharacterAvatar, { src: src.value }))
    src.value = '/new.png'
    await vi.waitFor(() => expect(root.querySelector('img')?.getAttribute('src')).toBe('blob:new'))
    resolveOld('blob:old')
    await nextTick()
    expect(root.querySelector('img')?.getAttribute('src')).toBe('blob:new')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:old')
    app?.unmount()
    app = undefined
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:new')
  })

  it('keeps standalone URLs and caller-owned blob avatars intact', async () => {
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { revokeObjectURL })
    const src = ref('https://example.test/portrait.png')
    const root = mount(() => h(CharacterAvatar, { src: src.value }))
    expect(root.querySelector('img')?.getAttribute('src')).toBe(src.value)
    src.value = 'blob:caller-owned'
    await nextTick()
    expect(root.querySelector('img')?.getAttribute('src')).toBe(src.value)
    app?.unmount()
    app = undefined
    expect(revokeObjectURL).not.toHaveBeenCalled()
  })

  it('uses named native buttons in both views and retains the selected character', async () => {
    const select = vi.fn()
    const root = mount(() => h(CharacterList, { characters: [character('Alice')], selected: 'Alice', onSelect: select }))
    root.querySelector<HTMLButtonElement>('.ae-character-card')!.click()
    expect(select).toHaveBeenCalledWith(expect.objectContaining({ id: 'Alice' }))
    root.querySelector<HTMLButtonElement>('[title="characters.list"]')!.click()
    await nextTick()
    const row = root.querySelector<HTMLButtonElement>('.ae-character-card.list')!
    expect(row.type).toBe('button')
    expect(row.getAttribute('aria-pressed')).toBe('true')
    expect(row.textContent).toContain('Alice')
  })

  it('rejects duplicate/blank tachies and emits an immutable trimmed update', async () => {
    const model = ref(character('Alice', { normal: { src: 'normal.png' } }))
    const update = vi.fn()
    const root = mount(() => h(TachieManager, { character: model.value, onUpdate: update }))
    const inputs = root.querySelectorAll('input')
    expect([...root.querySelectorAll('label')].map(label => label.control)).toEqual([...inputs])
    await fill(inputs[0], ' normal ')
    await fill(inputs[1], ' next.png ')
    expect(root.querySelector('[role=alert]')).not.toBeNull()
    expect(root.querySelector<HTMLButtonElement>('[type=submit]')!.disabled).toBe(true)
    await fill(inputs[0], ' smile ')
    root.querySelector<HTMLButtonElement>('[type=submit]')!.click()
    await nextTick()
    expect(update).toHaveBeenCalledWith({ normal: { src: 'normal.png' }, smile: { src: 'next.png' } })
    expect(model.value.tachies).toEqual({ normal: { src: 'normal.png' } })
    await fill(inputs[0], '   ')
    expect(root.querySelector<HTMLButtonElement>('[type=submit]')!.disabled).toBe(true)
  })

  it('switches tachie data and clears drafts when selecting another character', async () => {
    const model = ref(character('Alice', { normal: { src: 'a.png' } }))
    const update = vi.fn()
    const root = mount(() => h(TachieManager, { character: model.value, onUpdate: update }))
    await fill(root.querySelector('input')!, 'draft')
    model.value = character('Bob', { happy: { src: 'b.png' } })
    await nextTick()
    expect(root.querySelector('input')!.value).toBe('')
    expect(root.querySelector('img')!.getAttribute('src')).toBe('b.png')
    root.querySelector<HTMLButtonElement>('[title="characters.tachie.remove happy"]')!.click()
    expect(update).toHaveBeenCalledWith({})
    expect(model.value.tachies).toEqual({ happy: { src: 'b.png' } })
  })

  it('uses the latest relationship props for additions and removals without mutating them', async () => {
    const relationships = ref([{ targetId: 'Alice', type: 'friend' }])
    const update = vi.fn()
    const root = mount(() => h(RelationshipEditor, { relationships: relationships.value, onUpdate: update }))
    relationships.value = [{ targetId: 'Bob', type: 'rival' }]
    await nextTick()
    expect(root.textContent).not.toContain('Alice')
    const inputs = root.querySelectorAll('input')
    await fill(inputs[0], ' Carol ')
    await fill(inputs[1], ' colleague ')
    root.querySelector<HTMLButtonElement>('[type=submit]')!.click()
    expect(update).toHaveBeenLastCalledWith([{ targetId: 'Bob', type: 'rival' }, { targetId: 'Carol', type: 'colleague', description: '' }])
    root.querySelector<HTMLButtonElement>('[title="characters.relationship.remove Bob"]')!.click()
    expect(update).toHaveBeenLastCalledWith([])
    expect(relationships.value).toEqual([{ targetId: 'Bob', type: 'rival' }])
  })
})

function library() {
  const scope = effectScope()
  scopes.push(scope)
  const loaded = vi.fn()
  const state = scope.run(() => useAudioLibrary(loaded))!
  return { ...state, loaded, scope }
}
const response = (data: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => data })

describe('editor audio library', () => {
  it('offers retry after a media failure and pauses playback when leaving the panel', async () => {
    const load = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    const root = mount(() => h(AEAudioLibraryItem, { name: 'Calm', description: '', src: '/calm.mp3' }))
    const audio = root.querySelector('audio')!
    expect(audio.preload).toBe('none')
    expect(audio.getAttribute('aria-label')).toContain('Calm')
    audio.dispatchEvent(new Event('error'))
    await nextTick()
    expect(root.querySelector('[role=alert]')).not.toBeNull()
    root.querySelector<HTMLButtonElement>('button')!.click()
    await nextTick()
    expect(load).toHaveBeenCalledTimes(1)
    expect(root.querySelector('[role=alert]')).toBeNull()
    app?.unmount()
    app = undefined
    expect(pause).toHaveBeenCalledTimes(1)
  })

  it('validates the complete library before publishing and safely encodes audio filenames', () => {
    expect(parseAudioLibrary({ calm: { name: ' Calm ' } })).toEqual({ calm: { name: 'Calm', description: '' } })
    for (const invalid of [null, [], { a: { name: '' } }, { a: { name: 'A', description: 1 } }, { a: { name: 'A' }, b: {} }])
      expect(() => parseAudioLibrary(invalid)).toThrow()
    expect(audioLibrarySrc('https://cdn.test/', 'a/b #1')).toBe('https://cdn.test/bgms/library/a%2Fb%20%231.mp3')
  })

  it('retains the existing library after HTTP/format failures and allows retry', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(response({}, false))
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response({ calm: { name: 'Calm' } })))
    const state = library()
    await state.load('https://library.test/music.json')
    expect(state.failed.value).toBe(true)
    expect(state.loaded).not.toHaveBeenCalled()
    await state.load('https://library.test/music.json')
    expect(state.failed.value).toBe(true)
    await state.load(' https://library.test/music.json ')
    expect(state.failed.value).toBe(false)
    expect(state.loading.value).toBe(false)
    expect(state.loaded).toHaveBeenCalledWith({ calm: { name: 'Calm', description: '' } }, 'https://library.test/music.json')
  })

  it('ignores stale requests and aborts outstanding requests when disposed', async () => {
    let resolveFirst!: (value: ReturnType<typeof response>) => void
    let resolveLast!: (value: ReturnType<typeof response>) => void
    const fetch = vi.fn().mockImplementationOnce(() => new Promise(resolve => resolveFirst = resolve)).mockResolvedValueOnce(response({ new: { name: 'New' } })).mockImplementationOnce(() => new Promise(resolve => resolveLast = resolve))
    vi.stubGlobal('fetch', fetch)
    const state = library()
    const first = state.load('old.json')
    await state.load('new.json')
    resolveFirst(response({ old: { name: 'Old' } }))
    await first
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true)
    expect(state.loaded).toHaveBeenCalledTimes(1)
    expect(state.loaded.mock.calls[0][1]).toBe('new.json')
    const last = state.load('last.json')
    state.scope.stop()
    expect(fetch.mock.calls[2][1].signal.aborted).toBe(true)
    resolveLast(response({ last: { name: 'Last' } }))
    await last
    expect(state.loaded).toHaveBeenCalledTimes(1)
  })
})
