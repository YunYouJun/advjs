import type { ProjectWorkspace, ProjectWorkspaceSnapshot } from '../../../editor/core/app/workspaces/project'
import type { EditorBridge } from '../../../packages/advjs/node/editor'
import { webcrypto } from 'node:crypto'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { markRaw, reactive } from 'vue'
import { createLocalBridgeAdapter } from '../../../editor/core/app/adapters/local'
import { createLocalProjectWorkspace } from '../../../editor/core/app/adapters/local/workspace'
import AEVoiceJobItem from '../../../editor/core/app/components/panel/audio/AEVoiceJobItem.vue'
import AEVoiceJobPlanForm from '../../../editor/core/app/components/panel/audio/AEVoiceJobPlanForm.vue'
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
  it('groups scope, budget review and generation progress in workflow order with an explicit next action', async () => {
    const wrapper = await open()
    const sections = ['jobs-scope-section', 'jobs-budget-section', 'jobs-progress-section']
    expect(wrapper.findAll('.agui-section').map(section => section.attributes('data-testid'))).toEqual(sections)
    expect(wrapper.get('[data-testid="jobs-scope-section"]').findAll('select')).toHaveLength(4)
    expect(wrapper.get('[data-testid="jobs-budget-section"]').find('[data-testid="jobs-character-budget"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="jobs-next-step"]').text()).toContain('先在上方勾选台词')
    expect(wrapper.get('[data-testid="jobs-scope-section"]').text()).toContain('最多 5000 句')
    expect(wrapper.get('[data-testid="jobs-scope-section"]').text()).toContain('每批 200 句')
    expect(wrapper.get('[data-testid="jobs-progress-section"]').text()).toContain('关闭面板后仍可恢复')
    expect(fixture.calls).toHaveLength(0)
  })

  it('keeps long-job progress and recovery actions visible while lazily expanding paginated results', async () => {
    const reviewed = await workspace.voiceJobs!.plan({ lineIds: [editorJobLineIds[0]!], locale: 'zh-CN', providerId: 'fixture-tts', budget: { maxCharacters: 100, concurrency: 1, allowUnknownCost: true } })
    const job = structuredClone(reviewed.plan)
    job.tasks = Array.from({ length: 201 }, (_, index) => ({ ...job.tasks[0]!, id: `job_019d137e-7abc-7000-8000-${String(index + 1).padStart(12, '0')}`, lineId: `line_019d137e-7abc-7000-8000-${String(index + 1).padStart(12, '0')}` }))
    job.tasks[0]!.status = 'running'
    job.tasks[1]!.status = 'generated'
    job.tasks[150]!.status = 'failed'
    job.summary.lines = 201
    const wrapper = mount(AEVoiceJobItem, { props: { job, pending: false, batchSize: 200 } })
    mounted.push(wrapper)
    expect(wrapper.get('[data-testid="jobs-batch-progress"]').text()).toContain('第 1 / 2 批')
    expect(wrapper.text()).toContain('1 句失败')
    expect(wrapper.text()).toContain('fixture-tts · zh-CN')
    expect(wrapper.get('[aria-label="任务执行状态"]').text()).toContain('生成中 1 句')
    expect(wrapper.get('[aria-label="任务执行状态"]').text()).toContain('待登记 1 句')
    expect(wrapper.get('[aria-label="任务执行状态"]').text()).toContain('排队 198 句')
    expect(wrapper.get('progress').attributes('value')).toBe('0')
    expect(wrapper.get('progress').attributes('max')).toBe('201')
    expect(wrapper.get('[data-testid="jobs-run"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="jobs-retry"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.findAll('[data-task-status]')).toHaveLength(0)
    const results = wrapper.get('[data-testid="jobs-results"]')
    expect(results.attributes('open')).toBeUndefined()
    ;(results.element as HTMLDetailsElement).open = true
    await results.trigger('toggle')
    expect(wrapper.findAll('[data-task-status]')).toHaveLength(100)
    await wrapper.findAll('button').find(button => button.text() === '下一页结果')!.trigger('click')
    expect(wrapper.findAll('[data-task-status="failed"]')).toHaveLength(1)
    expect(wrapper.findAll('.ae-job-task-order')[0]!.text()).toBe('第 101 句')
    expect(wrapper.findAll('[aria-label="稳定台词 ID"]')[0]!.text()).toBe(job.tasks[100]!.lineId)
    await wrapper.get('[data-testid="jobs-retry"]').trigger('click')
    expect(wrapper.emitted('command')![0]![1]).toBe('retry')
    await wrapper.setProps({ job: { ...job, cancelled: true } })
    await wrapper.get('[data-testid="jobs-resume"]').trigger('click')
    expect(wrapper.emitted('command')![1]![1]).toBe('resume')
    expect(fixture.calls).toHaveLength(0)
  })

  it('shows a long-job capacity block and its safe reason outside collapsed result pages', async () => {
    const reviewed = await workspace.voiceJobs!.plan({ lineIds: [editorJobLineIds[0]!], locale: 'zh-CN', providerId: 'fixture-tts', budget: { maxCharacters: 100, concurrency: 1, allowUnknownCost: true } })
    const job = structuredClone(reviewed.plan)
    job.tasks = Array.from({ length: 201 }, (_, index) => ({ ...job.tasks[0]!, id: `job_019d137e-7abc-7000-8000-${String(index + 1).padStart(12, '0')}` }))
    job.tasks[150]!.status = 'blocked'
    job.tasks[150]!.errorCode = 'STORE_CAPACITY_EXCEEDED'
    job.summary.lines = 201
    const wrapper = mount(AEVoiceJobItem, { props: { job, pending: false, batchSize: 200 } })
    mounted.push(wrapper)
    expect(wrapper.get('[data-testid="jobs-results"]').attributes('open')).toBeUndefined()
    expect(wrapper.findAll('[data-task-status]')).toHaveLength(0)
    expect(wrapper.text()).toContain('1 句已阻断')
    expect(wrapper.get('[data-testid="jobs-blocked-reason"]').text()).toBe('恢复记录空间不足，尚未调用模型')
    expect(wrapper.get('[data-testid="jobs-batch-progress"]').text()).toContain('第 1 / 2 批')
    const unknown = structuredClone(job)
    unknown.tasks[150]!.errorCode = 'sensitive provider /private/path'
    await wrapper.setProps({ job: unknown })
    expect(wrapper.get('[data-testid="jobs-blocked-reason"]').text()).toContain('请检查项目配置或输入')
    expect(wrapper.text()).not.toContain('sensitive provider')
    expect(fixture.calls).toHaveLength(0)
  })

  it('stops polling when the host has no active promise, even if queued tasks remain after a run command', async () => {
    const port = workspace.voiceJobs!
    const initial = await port.read()
    const reviewed = await port.plan({ lineIds: editorJobLineIds, locale: 'zh-CN', providerId: 'fixture-tts', budget: { maxCharacters: 100, concurrency: 1, allowUnknownCost: true } })
    const read = vi.spyOn(port, 'read').mockResolvedValue({ ...initial, jobs: [reviewed.plan], activeJobIds: [] })
    vi.spyOn(port, 'command').mockResolvedValue(reviewed.plan)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const wrapper = mount(AEVoiceJobsPanel, { global: { stubs: { AGUISelect: field } } })
    try {
      await flushPromises()
      expect(read).toHaveBeenCalledTimes(1)
      await wrapper.get('[data-testid="jobs-run"]').trigger('click')
      await flushPromises()
      expect(read).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(3000)
      expect(read).toHaveBeenCalledTimes(2)
      expect(fixture.calls).toHaveLength(0)
    }
    finally {
      wrapper.unmount()
      vi.useRealTimers()
    }
  })

  it('keeps polling an active host promise across transient task states and stops when that promise finishes', async () => {
    const port = workspace.voiceJobs!
    const initial = await port.read()
    const reviewed = await port.plan({ lineIds: editorJobLineIds, locale: 'zh-CN', providerId: 'fixture-tts', budget: { maxCharacters: 100, concurrency: 1, allowUnknownCost: true } })
    const job = structuredClone(reviewed.plan)
    job.tasks[0]!.status = 'failed'
    const read = vi.spyOn(port, 'read').mockResolvedValue({ ...initial, jobs: [job], activeJobIds: [job.id] })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const wrapper = mount(AEVoiceJobsPanel, { global: { stubs: { AGUISelect: field } } })
    try {
      await flushPromises()
      expect(read).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1000)
      expect(read).toHaveBeenCalledTimes(2)
      read.mockResolvedValue({ ...initial, jobs: [job], activeJobIds: [] })
      await vi.advanceTimersByTimeAsync(1000)
      expect(read).toHaveBeenCalledTimes(3)
      await vi.advanceTimersByTimeAsync(3000)
      expect(read).toHaveBeenCalledTimes(3)
      expect(fixture.calls).toHaveLength(0)
    }
    finally {
      wrapper.unmount()
      vi.useRealTimers()
    }
  })

  it('selects a chapter and reviews the missing filter without calling a model, clearing approval when the mode changes', async () => {
    const extra = 'line_019d137e-7abc-7000-8000-000000000003'
    await writeFile(join(fixture.root, 'adv/chapters/ending.adv.md'), `（新的结尾。） {#${extra}}`)
    await refresh()
    const wrapper = await open()
    await wrapper.get('[aria-label="配音章节范围"]').setValue('ending')
    expect(wrapper.findAll('[data-line-id]').map(item => item.attributes('data-line-id'))).toEqual([extra])
    await wrapper.get('[aria-label="配音状态筛选"]').setValue('missing')
    await wrapper.get('[data-testid="jobs-select-all"]').trigger('click')
    await wrapper.get('[data-testid="jobs-unknown-cost"] input').setValue(true)
    await wrapper.get('[data-testid="jobs-plan"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('[data-testid="jobs-plan-review"]').exists()).toBe(true))
    expect(wrapper.get('[data-testid="jobs-plan-review"]').text()).toContain('从 1 句中筛出 1 句')
    expect(fixture.calls).toHaveLength(0)
    await wrapper.get('[data-testid="jobs-budget-reviewed"] input').setValue(true)
    await wrapper.get('[aria-label="配音状态筛选"]').setValue('stale')
    expect(wrapper.find('[data-testid="jobs-plan-review"]').exists()).toBe(false)
    await wrapper.get('[data-testid="jobs-plan"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.get('[role="alert"]').text()).toContain('ADV_AUDIO_JOB_NO_TARGETS'))
    await wrapper.get('[aria-label="配音章节范围"]').setValue('intro')
    expect(wrapper.findAll('[data-line-id]').map(item => item.attributes('data-line-id'))).toEqual(editorJobLineIds)
    expect(wrapper.get('[data-testid="jobs-plan"]').attributes('disabled')).toBeDefined()
  })

  it('selects all 201 dialogues across list pages without truncating to the 200-task window', async () => {
    const lines = Array.from({ length: 201 }, (_, index) => ({ id: `line-${index}`, speakerId: 'narrator', text: `台词 ${index}` }))
    const wrapper = mount(AEVoiceJobPlanForm, { props: { modelValue: { providerId: 'fixture-tts', locale: 'zh-CN', chapterId: 'all', mode: 'all', lineIds: [], maxCharacters: '10000', concurrency: '1', allowUnknownCost: true }, providers: [], locales: ['zh-CN'], chapters: [{ value: 'all', label: '全部章节' }], lines, maxLines: 5000, batchSize: 200, disabled: false } })
    mounted.push(wrapper)
    expect(wrapper.findAll('[data-line-id]')).toHaveLength(100)
    await wrapper.get('[data-testid="jobs-select-all"]').trigger('click')
    const selected = wrapper.emitted('update:modelValue')![0]![0] as { lineIds: string[] }
    expect(selected.lineIds).toEqual(lines.map(line => line.id))
    await wrapper.findAll('button').find(button => button.text() === '下一页台词')!.trigger('click')
    expect(wrapper.find('[data-line-id="line-100"]').exists()).toBe(true)
    await wrapper.findAll('button').find(button => button.text() === '下一页台词')!.trigger('click')
    expect(wrapper.findAll('[data-line-id]')).toHaveLength(1)
    expect(wrapper.find('[data-line-id="line-200"]').exists()).toBe(true)
    await wrapper.setProps({ maxLines: 200 })
    expect(wrapper.get('[data-testid="jobs-select-all"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('不会截断全选')
  })

  it('keeps a reviewed plan across equivalent native snapshots, but invalidates it when authored bytes change', async () => {
    const wrapper = await open()
    await wrapper.get(`[data-line-id="${editorJobLineIds[0]}"] input`).setValue(true)
    await wrapper.get('[data-testid="jobs-unknown-cost"] input').setValue(true)
    await wrapper.get('[data-testid="jobs-plan"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('[data-testid="jobs-plan-review"]').exists()).toBe(true))
    await wrapper.get('[data-testid="jobs-budget-reviewed"] input').setValue(true)
    await refresh()
    await flushPromises()
    expect(wrapper.find('[data-testid="jobs-plan-review"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="jobs-budget-reviewed"] input').element).toHaveProperty('checked', true)
    expect(wrapper.get('[data-testid="jobs-enqueue"]').attributes('disabled')).toBeUndefined()
    const path = 'adv/settings/game.json'
    const original = state.project.project.files[path]!
    const changed = JSON.parse(original)
    changed.title = 'Changed native input'
    state.project.project = (await workspace.writeFiles!([{ path, expected: original, content: JSON.stringify(changed) }])).project
    await flushPromises()
    expect(wrapper.find('[data-testid="jobs-plan-review"]').exists()).toBe(false)
    expect(fixture.calls).toHaveLength(0)
  })

  it('limits a character entry to that actor and clears draft approval when the actor scope changes', async () => {
    const audio = useAudioStore()
    audio.requestWorkspace('jobs', 'hero')
    const wrapper = await open()
    expect(wrapper.findAll('[data-line-id]').map(item => item.attributes('data-line-id'))).toEqual([editorJobLineIds[0]])
    await wrapper.get(`[data-line-id="${editorJobLineIds[0]}"] input`).setValue(true)
    await wrapper.get('[data-testid="jobs-unknown-cost"] input').setValue(true)
    await wrapper.get('[data-testid="jobs-plan"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('[data-testid="jobs-plan-review"]').exists()).toBe(true))
    await wrapper.get('[data-testid="jobs-budget-reviewed"] input').setValue(true)
    audio.requestWorkspace('jobs', 'narrator')
    await flushPromises()
    expect(wrapper.find('[data-testid="jobs-plan-review"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-line-id]').map(item => item.attributes('data-line-id'))).toEqual([editorJobLineIds[1]])
    expect(wrapper.get('[data-testid="jobs-plan"]').attributes('disabled')).toBeDefined()
    expect(fixture.calls).toHaveLength(0)
  })
  it('reviews budgets, enqueues and executes through the real authenticated local workspace, without selecting generated takes', async () => {
    const wrapper = await open()
    expect(fixture.calls).toHaveLength(0)
    await wrapper.get(`[data-line-id="${editorJobLineIds[0]}"] input`).setValue(true)
    await wrapper.get('[data-testid="jobs-plan"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.get('[role="alert"]').text()).toContain('AUDIO_JOB_UNKNOWN_COST'))
    expect(fixture.calls).toHaveLength(0)
    await wrapper.get('[data-testid="jobs-unknown-cost"] input').setValue(true)
    await wrapper.get('[data-testid="jobs-character-budget"]').setValue('1')
    await wrapper.get('[data-testid="jobs-plan"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.get('[role="alert"]').text()).toContain('整个计划的新生成字符超过总预算'))
    expect(wrapper.get('[role="alert"]').text()).toContain('AUDIO_JOB_CHARACTER_LIMIT')
    expect(fixture.calls).toHaveLength(0)
    await wrapper.get('[data-testid="jobs-character-budget"]').setValue('10000')
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
