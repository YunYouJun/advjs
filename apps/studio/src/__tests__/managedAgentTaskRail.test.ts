import type { AgentRun, AgentRuntime, AgentTaskSnapshot } from '@advjs/agent'
import { AGENT_PROTOCOL_VERSION, parseManagedAgentPointsAccount } from '@advjs/agent'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import ManagedAgentConsole from '../components/agent/ManagedAgentConsole.vue'
import {
  resolveManagedAgentApplicationId,
  resolveManagedAgentProtocol,
  resolveManagedAgentRuntimeUrl,
} from '../composables/useManagedAgentSession'
import en from '../i18n/locales/en.json'
import { useManagedAgentStore } from '../stores/useManagedAgentStore'

function snapshot(status: AgentTaskSnapshot['status']): AgentTaskSnapshot {
  return {
    protocolVersion: AGENT_PROTOCOL_VERSION,
    taskId: 'task_ui_fixture',
    capability: 'generate-outline',
    status,
    billingStatus: status === 'completed' ? 'settled' : status === 'cancelled' ? 'released' : 'reserved',
    projectId: 'project_fixture',
    projectRevision: 'revision_fixture',
    streamText: status === 'running' ? 'A city wakes beneath a violet sky.' : '',
    streamRevision: status === 'running' ? 1 : 0,
    reservedMicroPoints: 12_000,
    ...(status === 'completed'
      ? {
          usage: {
            inputTokens: 10,
            outputTokens: 20,
            totalTokens: 30,
            providerCostMicroCny: 7_000,
            chargedMicroPoints: 7_000,
          },
        }
      : {}),
    points: {
      reservedMicroPoints: ['completed', 'cancelled'].includes(status) ? 0 : 12_000,
      chargedMicroPoints: status === 'completed' ? 7_000 : 0,
    },
    createdAt: 1,
    updatedAt: 2,
  }
}

function runWithSnapshot(task: AgentTaskSnapshot): AgentRun {
  return {
    taskId: task.taskId,
    events: (async function* () {
      yield {
        protocolVersion: AGENT_PROTOCOL_VERSION,
        id: 'event_ui_fixture',
        cursor: 'cursor_ui_fixture',
        event: { type: 'state.snapshot', task } as const,
      }
      await new Promise(() => {})
    })(),
    result: new Promise(() => {}),
  }
}

describe('managed AI task state', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('strictly parses point balances and the server-owned active task id', () => {
    expect(parseManagedAgentPointsAccount({
      activeTask: 'task_ui_fixture',
      availableMicroPoints: 88_000,
      reservedMicroPoints: 12_000,
      chargedMicroPoints: 7_000,
    })).toEqual({
      activeTask: 'task_ui_fixture',
      availableMicroPoints: 88_000,
      reservedMicroPoints: 12_000,
      chargedMicroPoints: 7_000,
    })
    expect(() => parseManagedAgentPointsAccount({
      activeTask: { taskId: 'task_ui_fixture' },
      availableMicroPoints: 88_000,
      reservedMicroPoints: 12_000,
      chargedMicroPoints: 7_000,
    })).toThrow(/activeTask/)
  })

  it('accepts HTTPS runtime origins and local HTTP only', () => {
    expect(resolveManagedAgentRuntimeUrl('https://ai.yunle.fun/')).toBe('https://ai.yunle.fun')
    expect(resolveManagedAgentRuntimeUrl('http://advjs-ai.yunle.localhost:3100/')).toBe('http://advjs-ai.yunle.localhost:3100')
    expect(resolveManagedAgentRuntimeUrl('http://ai.example.com')).toBeUndefined()
    expect(resolveManagedAgentRuntimeUrl('javascript:alert(1)')).toBeUndefined()
  })

  it('keeps v1 as default and requires an exact application id for v2', () => {
    expect(resolveManagedAgentProtocol(undefined)).toBe('v1')
    expect(resolveManagedAgentProtocol('v2')).toBe('v2')
    expect(resolveManagedAgentProtocol('latest')).toBeUndefined()
    expect(resolveManagedAgentApplicationId(undefined, 'v1')).toBeUndefined()
    expect(resolveManagedAgentApplicationId('ai-runtime-dev-synthetic', 'v2')).toBe('ai-runtime-dev-synthetic')
    expect(resolveManagedAgentApplicationId('*', 'v2')).toBeUndefined()
  })

  it('recovers the account active task, resumes SSE, and enforces concurrency one', async () => {
    const resumed = vi.fn()
    const running = snapshot('running')
    const runtime: AgentRuntime = {
      start: async () => { throw new Error('not used') },
      resume: async (taskId) => {
        resumed(taskId)
        return runWithSnapshot(running)
      },
      getTask: async () => snapshot('queued'),
      cancel: async () => {},
    }
    const store = useManagedAgentStore()
    store.configure({
      runtime,
      points: {
        getPoints: async () => ({
          activeTask: running.taskId,
          availableMicroPoints: 88_000,
          reservedMicroPoints: 12_000,
          chargedMicroPoints: 0,
        }),
      },
    })

    await store.refreshPoints()
    await flushPromises()

    expect(resumed).toHaveBeenCalledWith(running.taskId)
    expect(store.task).toMatchObject({
      taskId: running.taskId,
      snapshot: { status: 'running' },
      streamText: running.streamText,
    })
    expect(store.hasActiveTask).toBe(true)
    expect(store.canStartTask).toBe(false)
  })

  it('cancels through the runtime and retains the terminal snapshot for feedback', async () => {
    let current = snapshot('running')
    let accountActive = true
    const cancel = vi.fn(async () => {
      current = snapshot('cancelled')
      accountActive = false
    })
    const runtime: AgentRuntime = {
      start: async () => { throw new Error('not used') },
      resume: async () => runWithSnapshot(current),
      getTask: async () => current,
      cancel,
    }
    const store = useManagedAgentStore()
    store.configure({
      runtime,
      points: {
        getPoints: async () => ({
          ...(accountActive ? { activeTask: current.taskId } : {}),
          availableMicroPoints: accountActive ? 88_000 : 100_000,
          reservedMicroPoints: accountActive ? 12_000 : 0,
          chargedMicroPoints: 0,
        }),
      },
    })
    await store.refreshPoints({ resume: false })

    await store.cancelActiveTask()

    expect(cancel).toHaveBeenCalledWith(current.taskId)
    expect(store.status).toBe('cancelled')
    expect(store.hasActiveTask).toBe(false)
    expect(store.points?.reservedMicroPoints).toBe(0)
  })
})

describe('managed AI console', () => {
  it('renders point conversion, streaming state, billing disclosure, and a live region', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useManagedAgentStore()
    store.isConfigured = true
    store.points = {
      activeTask: 'task_ui_fixture',
      availableMicroPoints: 88_000,
      reservedMicroPoints: 12_000,
      chargedMicroPoints: 0,
    }
    store.task = {
      taskId: 'task_ui_fixture',
      snapshot: snapshot('running'),
      streamText: 'A city wakes beneath a violet sky.',
      connecting: true,
      recovering: false,
    }
    const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })
    const wrapper = mount(ManagedAgentConsole, {
      props: { loggedIn: true },
      global: {
        plugins: [pinia, i18n],
        stubs: { IonIcon: true, RouterLink: true },
      },
    })

    expect(wrapper.text()).toContain('88')
    expect(wrapper.text()).toContain('12')
    expect(wrapper.text()).toContain('Generating')
    expect(wrapper.text()).toContain('A city wakes beneath a violet sky.')
    expect(wrapper.text()).toContain('A usable candidate is billable')
    expect(wrapper.find('[aria-live="polite"]').text()).toContain('Generating')
    expect(wrapper.find('button').text()).toContain('Cancel task')
  })

  it('explains insufficient balance without exposing internal details', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useManagedAgentStore()
    store.isConfigured = true
    store.points = { availableMicroPoints: 3_000, reservedMicroPoints: 0, chargedMicroPoints: 0 }
    store.error = {
      code: 'balance_insufficient',
      message: 'private upstream detail must not be shown',
      retryable: false,
      requestId: 'request_public_fixture',
    }
    const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })
    const wrapper = mount(ManagedAgentConsole, {
      props: { loggedIn: true },
      global: {
        plugins: [pinia, i18n],
        stubs: { IonIcon: true, RouterLink: true },
      },
    })

    expect(wrapper.text()).toContain('enough AI points')
    expect(wrapper.text()).toContain('request_public_fixture')
    expect(wrapper.text()).not.toContain('private upstream detail')
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
  })
})
