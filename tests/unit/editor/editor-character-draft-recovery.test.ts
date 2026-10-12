import type { AdvCharacter } from '@advjs/types'
import type { App } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, createApp, defineComponent, h, nextTick, onBeforeUnmount, reactive, ref, useId, watch } from 'vue'
import CharacterForm from '../../../editor/core/app/components/character/CharacterForm.vue'
import en from '../../../editor/core/i18n/locales/en.json'
import zhCN from '../../../editor/core/i18n/locales/zh-CN.json'

const drafts = vi.hoisted(() => ({ projectId: 'a', recoveryError: '', register: vi.fn(), remove: vi.fn(), formDraft: vi.fn(), saveFormDraft: vi.fn() }))
vi.mock('../../../editor/core/app/stores/useProjectDrafts', () => ({ useProjectDrafts: () => drafts }))
vi.mock('@advjs/gui', () => ({ Toast: vi.fn() }))
let app: App | undefined
let project: { workspace: object }
const source = vi.fn(() => 'external source')
beforeEach(() => {
  vi.clearAllMocks()
  project = reactive({ workspace: {} })
  for (const [key, value] of Object.entries({ computed, reactive, ref, watch, useId, onBeforeUnmount }))
    vi.stubGlobal(key, value)
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }))
  vi.stubGlobal('useProjectStore', () => project)
  vi.stubGlobal('useCharacterStore', () => ({ characterSource: source, characters: [{ id: 'hero', name: 'External' }] }))
})
afterEach(() => {
  app?.unmount()
  app = undefined
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})
function mount(save: ReturnType<typeof vi.fn>, translate = (key: string) => key, character: Partial<AdvCharacter> = { id: 'hero', name: 'External' }) {
  vi.stubGlobal('useI18n', () => ({ t: translate }))
  const host = document.createElement('div')
  document.body.append(host)
  app = createApp({ render: () => h(CharacterForm, { mode: 'edit', character, save }) })
  app.config.globalProperties.$t = translate
  const wrapper = defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) })
  for (const name of ['AGUIForm', 'AGUIDetails', 'AGUIProperty', 'AGUIFormItem'])
    app.component(name, wrapper)
  app.component('AGUIButton', defineComponent({ setup: (_, { slots }) => () => h('button', slots.default?.()) }))
  const input = defineComponent({ props: ['modelValue'], emits: ['update:modelValue'], setup: (props, { emit }) => () => h('input', { value: props.modelValue, onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value) }) })
  app.component('AGUIInput', input)
  app.component('AGUITextarea', input)
  app.mount(host)
  return host
}
async function click(host: HTMLElement, label: string) {
  Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes(label))!.click()
  await nextTick()
  await nextTick()
}
describe('character draft recovery', () => {
  it('loads the original base and retains metadata, requiring explicit keep-local after an external conflict', async () => {
    drafts.formDraft.mockReturnValue({ base: 'original source', content: JSON.stringify({ form: { id: 'hero', name: 'Recovered', voice: { speakerId: 'voice-a' }, visual: { version: 1 } }, tags: 'friend', aliases: 'Alias' }) })
    const save = vi.fn(async (_data, expected) => {
      if (expected !== 'external source')
        throw new Error('Conflict')
    })
    const host = mount(save)
    expect(drafts.saveFormDraft).not.toHaveBeenCalled()
    await click(host, 'characters.form.loadDraft')
    expect(host.textContent).toContain('characters.draft.conflict')
    await click(host, 'characters.form.save')
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Recovered', voice: { speakerId: 'voice-a' }, visual: { version: 1 } }), 'original source')
    await click(host, 'characters.draft.keepDraft')
    expect(save).toHaveBeenLastCalledWith(expect.anything(), 'external source')
    expect(drafts.saveFormDraft).toHaveBeenLastCalledWith('character:edit:hero', undefined, 'a', expect.stringContaining('Recovered'))
  })
  it('blocks a stale character form from writing into a different project', async () => {
    drafts.formDraft.mockReturnValue(undefined)
    const save = vi.fn()
    const host = mount(save)
    project.workspace = {}
    await click(host, 'characters.form.save')
    expect(save).not.toHaveBeenCalled()
    expect(host.textContent).toContain('characters.draft.projectChanged')
  })
})

it('removes autosaved draft when all edits are reverted', async () => {
  drafts.formDraft.mockReturnValue(undefined)
  const host = mount(vi.fn())
  const name = host.querySelectorAll('input')[1]
  name.value = 'temporary edit'
  name.dispatchEvent(new Event('input'))
  await nextTick()
  expect(drafts.saveFormDraft).toHaveBeenLastCalledWith('character:edit:hero', expect.objectContaining({ content: expect.stringContaining('temporary edit') }), 'a')
  name.value = 'External'
  name.dispatchEvent(new Event('input'))
  await nextTick()
  expect(drafts.saveFormDraft).toHaveBeenLastCalledWith('character:edit:hero', undefined, 'a', expect.stringContaining('temporary edit'))
})

it('retains a newer draft typed while an earlier save is pending', async () => {
  drafts.formDraft.mockReturnValue(undefined)
  let finish!: () => void
  const save = vi.fn(() => new Promise<void>(resolve => finish = resolve))
  const host = mount(save)
  const name = host.querySelectorAll('input')[1]
  name.value = 'first edit'
  name.dispatchEvent(new Event('input'))
  await nextTick()
  await click(host, 'characters.form.save')
  name.value = 'second edit'
  name.dispatchEvent(new Event('input'))
  await nextTick()
  finish()
  await nextTick()
  await nextTick()
  expect(drafts.saveFormDraft).toHaveBeenLastCalledWith('character:edit:hero', expect.objectContaining({ content: expect.stringContaining('second edit') }), 'a')
})

it('an unmounted pending form cannot overwrite a newer form draft', async () => {
  drafts.formDraft.mockReturnValue(undefined)
  let finish!: () => void
  const host = mount(vi.fn(() => new Promise<void>(resolve => finish = resolve)))
  const name = host.querySelectorAll('input')[1]
  name.value = 'first submitted'
  name.dispatchEvent(new Event('input'))
  await nextTick()
  await click(host, 'characters.form.save')
  name.value = 'older unsaved followup'
  name.dispatchEvent(new Event('input'))
  await nextTick()
  app!.unmount()
  const fresh = mount(vi.fn())
  const nextName = fresh.querySelectorAll('input')[1]
  nextName.value = 'newer form work'
  nextName.dispatchEvent(new Event('input'))
  await nextTick()
  finish()
  await nextTick()
  await nextTick()
  expect(drafts.saveFormDraft).toHaveBeenLastCalledWith('character:edit:hero', expect.objectContaining({ content: expect.stringContaining('newer form work') }), 'a')
})

it.each([['en', en], ['zh-CN', zhCN]] as const)('localizes recovery conflict text and actions in %s', async (_locale, messages) => {
  drafts.formDraft.mockReturnValue({ base: 'original source', content: JSON.stringify({ form: { id: 'hero', name: 'Recovered' }, tags: '', aliases: '' }) })
  const translate = (key: string) => key.startsWith('characters.draft.')
    ? (messages.characters.draft as Record<string, string>)[key.slice('characters.draft.'.length)] ?? key
    : key
  const host = mount(vi.fn(), translate)
  await click(host, 'characters.form.loadDraft')
  expect(host.querySelector('[role="alert"]')?.textContent).toContain(messages.characters.draft.conflict)
  expect(Array.from(host.querySelectorAll('button')).map(button => button.textContent?.trim())).toEqual(expect.arrayContaining([
    messages.characters.draft.reloadExternal,
    messages.characters.draft.keepDraft,
  ]))
})

it('persists an explicitly cleared voice profile through partial saves and recovered drafts', async () => {
  drafts.formDraft.mockReturnValue(undefined)
  const character = { id: 'hero', name: 'External', cv: 'Actor', voiceProfile: { intent: { speakingStyle: 'Calm' } } }
  const save = vi.fn(async (_data: Partial<AdvCharacter>) => {})
  const host = mount(save, undefined, character)
  host.querySelector<HTMLButtonElement>('[data-testid="character-voice-clear"]')!.click()
  await nextTick()
  const recovered = drafts.saveFormDraft.mock.calls.at(-1)![1]
  await click(host, 'characters.form.save')
  expect(save).toHaveBeenCalledOnce()
  expect(Object.hasOwn(save.mock.calls[0]![0], 'voiceProfile')).toBe(true)
  app!.unmount()
  drafts.formDraft.mockReturnValue(recovered)
  const reopened = mount(save, undefined, character)
  await click(reopened, 'characters.form.loadDraft')
  await click(reopened, 'characters.form.save')
  expect(save).toHaveBeenCalledTimes(2)
  for (const [data] of save.mock.calls) {
    expect(Object.hasOwn(data, 'voiceProfile')).toBe(true)
    expect({ ...character, ...data }.voiceProfile).toBeUndefined()
    expect(data.cv).toBe('Actor')
  }
})
