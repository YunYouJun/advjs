import type { ProjectWorkspace, ProjectWorkspaceSnapshot } from '../../../editor/core/app/workspaces/project'
import type { EditorBridge } from '../../../packages/advjs/node/editor'
import { webcrypto } from 'node:crypto'
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { markRaw, reactive } from 'vue'
import { createLocalBridgeAdapter } from '../../../editor/core/app/adapters/local'
import { createLocalProjectWorkspace } from '../../../editor/core/app/adapters/local/workspace'
import AEVoiceJobsPanel from '../../../editor/core/app/components/panel/audio/AEVoiceJobsPanel.vue'
import { useAudioStore } from '../../../editor/core/app/stores/useAudioStore'
import { createEditorBridge } from '../../../packages/advjs/node/editor'
import { createEditorVoiceJobsFixture, editorJobLineIds } from '../../fixtures/audio/editor-voice-jobs'

interface TestProject {
  workspace?: ProjectWorkspace
  project: ProjectWorkspaceSnapshot['project']
  refreshProject: () => Promise<void>
}
const state = vi.hoisted(() => ({ project: undefined as unknown as TestProject }))
vi.mock('../../../editor/core/app/stores/useProjectStore', () => ({ useProjectStore: () => state.project }))
vi.mock('@advjs/core', () => import('../../../packages/core/src/project'))
const field = { props: ['modelValue', 'options', 'disabled', 'label'], emits: ['update:modelValue'], template: '<select :value="modelValue" :disabled="disabled" :aria-label="label" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="option in options" :value="typeof option === \'string\' ? option : option.value">{{ typeof option === \'string\' ? option : option.label }}</option></select>' }
const mounted: Array<{ unmount: () => void }> = []
let fixture: Awaited<ReturnType<typeof createEditorVoiceJobsFixture>>
let bridge: EditorBridge
let workspace: ProjectWorkspace
let refresh: ReturnType<typeof vi.fn>

beforeEach(async () => {
  setActivePinia(createPinia())
  vi.stubGlobal('crypto', webcrypto)
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:editor-job'), revokeObjectURL: vi.fn() }))
  fixture = await createEditorVoiceJobsFixture()
  bridge = await createEditorBridge({ host: '127.0.0.1', port: 0, projectRoot: fixture.root, publicRoot: fixture.publicRoot, audioJobs: { config: fixture.config, storeDirectory: fixture.storeDirectory } })
  const ready = await bridge.start()
  workspace = markRaw(createLocalProjectWorkspace(createLocalBridgeAdapter({ origin: new URL(ready.url).origin, token: bridge.token })))
  const initial = await workspace.snapshot()
  refresh = vi.fn(async () => {
    state.project.project = (await workspace.snapshot()).project
  })
  state.project = reactive({ workspace, project: initial.project, refreshProject: refresh })
})
afterEach(async () => {
  for (const wrapper of mounted.splice(0))
    wrapper.unmount()
  workspace.dispose()
  await bridge.stop()
  await rm(fixture.directory, { recursive: true, force: true })
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function open() {
  const wrapper = mount(AEVoiceJobsPanel, { global: { stubs: { AGUISelect: field } } })
  mounted.push(wrapper)
  await vi.waitFor(() => expect(wrapper.get('[aria-label="配音生成任务"]').attributes('aria-busy')).toBe('false'))
  return wrapper
}

describe('editor durable voice job authoring UI', () => {
  it('reviews budgets, enqueues and executes through the real authenticated local workspace, without selecting generated takes', async () => {
    const wrapper = await open()
    expect(fixture.calls).toHaveLength(0)
    await wrapper.get(`[data-line-id="${editorJobLineIds[0]}"] input`).setValue(true)
    await wrapper.get('[data-testid="jobs-plan"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.get('[role="alert"]').text()).toContain('AUDIO_JOB_UNKNOWN_COST'))
    expect(fixture.calls).toHaveLength(0)
    await wrapper.get('[data-testid="jobs-unknown-cost"] input').setValue(true)
    await wrapper.get('[data-testid="jobs-plan"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('[data-testid="jobs-plan-review"]').exists()).toBe(true))
    expect(wrapper.get('[data-testid="jobs-enqueue"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="jobs-budget-reviewed"] input').setValue(true)
    await wrapper.get('[data-testid="jobs-enqueue"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.findAll('[data-job-id]')).toHaveLength(1))
    expect(fixture.calls).toHaveLength(0)
    expect(wrapper.findAll('[data-task-status="queued"]')).toHaveLength(1)
    await wrapper.get('[data-testid="jobs-run"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.findAll('[data-task-status="committed"]')).toHaveLength(1), { timeout: 10000 })
    expect(fixture.calls).toHaveLength(1)
    expect(refresh).toHaveBeenCalled()
    const ledger = JSON.parse(await readFile(join(fixture.root, 'adv/audio/voice-ledger.json'), 'utf8'))
    expect(ledger.lines[editorJobLineIds[0]!].locales['zh-CN']).toMatchObject({ selectedTake: null, takes: [expect.objectContaining({ source: 'system', model: 'fixture-model' })] })
    expect(wrapper.text()).toContain('已登记 · 未自动选用')
  })

  it('invalidates a reviewed plan when its draft changes and clears injected transports when switching projects', async () => {
    const wrapper = await open()
    await wrapper.get(`[data-line-id="${editorJobLineIds[0]}"] input`).setValue(true)
    await wrapper.get('[data-testid="jobs-unknown-cost"] input').setValue(true)
    await wrapper.get('[data-testid="jobs-plan"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('[data-testid="jobs-plan-review"]').exists()).toBe(true))
    await wrapper.get('[data-testid="jobs-character-budget"]').setValue('200')
    expect(wrapper.find('[data-testid="jobs-plan-review"]').exists()).toBe(false)
    useAudioStore().setVoiceJobsTransport(workspace.voiceJobs)
    state.project.workspace = markRaw({ ...workspace, kind: 'browser', voiceJobs: undefined })
    await flushPromises()
    expect(useAudioStore().voiceJobs()).toBeUndefined()
    expect(wrapper.text()).toContain('当前工作区未配置配音任务服务')
    expect(wrapper.get('[data-testid="jobs-plan"]').attributes('disabled')).toBeDefined()
    expect(fixture.calls).toHaveLength(0)
  })
})
