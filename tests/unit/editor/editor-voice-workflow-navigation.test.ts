import type { AdvCharacter } from '@advjs/types'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import CharacterVoiceWorkflowEntry from '../../../editor/core/app/components/character/CharacterVoiceWorkflowEntry.vue'
import AEAudioPanel from '../../../editor/core/app/components/panel/audio/AEAudioPanel.vue'
import { createEditorLayoutState, editorLayoutStateKey } from '../../../editor/core/app/extensions/layout-state'
import { useAudioStore } from '../../../editor/core/app/stores/useAudioStore'
import zh from '../../../editor/core/i18n/locales/zh-CN.json'

const state = vi.hoisted(() => ({ project: {} as any }))
vi.mock('../../../editor/core/app/stores/useProjectStore', () => ({ useProjectStore: () => state.project }))
vi.mock('@advjs/core', () => import('../../../packages/core/src/project'))
const actor: AdvCharacter = { id: 'hero', name: 'Hero', cv: 'Credit only' }
const wrappers: Array<{ unmount: () => void }> = []
const layout = createEditorLayoutState()
const unlock = vi.fn(async () => true)
const stubs = Object.fromEntries(['AEProjectAudioPanel', 'AEVoiceLedgerPanel', 'AEVoiceDesignPanel', 'AEAudioMixerPanel', 'AEVoiceJobsPanel', 'AEAudioVoiceProfilesPanel', 'AEAudioPronunciationPanel'].map(name => [name, true]))
const global = { provide: { [editorLayoutStateKey as symbol]: layout, '$advjs-context': { $audio: { unlock } } }, stubs }
beforeEach(() => {
  setActivePinia(createPinia())
  layout.reset()
  unlock.mockClear()
  state.project = reactive({ workspace: { writeFiles: vi.fn(), voiceDesign: {} }, project: { files: {}, compilation: { project: { root: 'adv', characters: [actor] } } } })
  vi.stubGlobal('useProjectStore', () => state.project)
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key.split('.').reduce((value: any, field) => value?.[field], zh) ?? key }))
})
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  vi.unstubAllGlobals()
})

describe('editor character voice workflow navigation', () => {
  it('distinguishes saved bindings from historical samples and consumes scoped requests in the existing audio tabs', async () => {
    const original = JSON.stringify(actor)
    const entry = mount(CharacterVoiceWorkflowEntry, { global, props: { character: actor } })
    wrappers.push(entry)
    expect(entry.text()).toContain('尚未保存角色')
    await entry.get('[data-testid="character-voice-design"]').trigger('click')
    const audio = useAudioStore()
    expect(layout.state.active.main).toBe('advjs.core/audio')
    expect(audio.workspaceRequest?.tab).toBe('design')
    expect(audio.workflowSpeakerId).toBe('hero')
    const panel = mount(AEAudioPanel, { global })
    wrappers.push(panel)
    await flushPromises()
    expect(panel.get('[role="tab"][aria-selected="true"]').text()).toBe('音色设计')
    expect(audio.workspaceRequest).toBeUndefined()
    await entry.get('[data-testid="character-voice-jobs"]').trigger('click')
    expect(panel.get('[role="tab"][aria-selected="true"]').text()).toBe('配音任务')
    await entry.get('[data-testid="character-voice-takes"]').trigger('click')
    expect(panel.get('[role="tab"][aria-selected="true"]').text()).toBe('对白配音')
    const preview = panel.findAll('button').find(button => button.text() === '游戏预览')!
    await preview.trigger('click')
    expect(unlock).toHaveBeenCalledOnce()
    expect(layout.state.active.main).toBe('advjs.core/game')
    expect(state.project.workspace.writeFiles).not.toHaveBeenCalled()
    expect(JSON.stringify(actor)).toBe(original)
  })

  it('reports the exact applied author version and drops requests and actor scope on project change', async () => {
    const character: AdvCharacter = { ...actor, voiceProfile: { intent: {}, locales: { 'zh-CN': { providers: { 'qwen-tts': { voiceId: 'design:actual', model: 'pinned/model', source: 'designed', projectVoiceId: 'project-voice', projectVoiceVersion: '2' } } } } } }
    const entry = mount(CharacterVoiceWorkflowEntry, { global, props: { character } })
    wrappers.push(entry)
    expect(entry.get('[data-testid="character-applied-voice"]').text()).toContain('project-voice / 2')
    await entry.get('[data-testid="character-voice-jobs"]').trigger('click')
    const audio = useAudioStore()
    expect(audio.workflowSpeakerId).toBe('hero')
    state.project.workspace = { writeFiles: vi.fn() }
    await flushPromises()
    expect(audio.workflowSpeakerId).toBeUndefined()
    expect(audio.workspaceRequest).toBeUndefined()
    expect(state.project.workspace.writeFiles).not.toHaveBeenCalled()
  })
})
