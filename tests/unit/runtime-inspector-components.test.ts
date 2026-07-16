import type { RuntimeInspectorModel } from '../../packages/client/runtime/inspector'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RuntimeInspectorPanel from '../../packages/client/components/devtools/RuntimeInspectorPanel.vue'

const model: RuntimeInspectorModel = {
  address: { chapterId: 'chapter-1', nodeId: 'choice' },
  status: 'waiting-choice',
  current: { id: 'choice', kind: 'choices' },
  variables: { profile: { mood: 'curious' }, score: 2 },
  stage: { background: 'night.svg', bgm: 'ambient.wav', tachies: {} },
  choices: [],
  visited: ['chapter-1#line', 'chapter-1#choice'],
  checkpointCount: 2,
  trace: [
    {
      sequence: 1,
      command: 'start',
      from: { chapterId: 'chapter-1', nodeId: 'line' },
      to: { chapterId: 'chapter-1', nodeId: 'line' },
      status: 'playing',
      effects: [],
      variableChanges: [],
    },
    {
      sequence: 2,
      command: 'next',
      from: { chapterId: 'chapter-1', nodeId: 'line' },
      to: { chapterId: 'chapter-1', nodeId: 'choice' },
      status: 'waiting-choice',
      effects: [{ type: 'stage.background', payload: { url: 'night.svg' } }],
      variableChanges: [],
    },
    {
      sequence: 3,
      command: 'choose',
      input: { choiceId: 'observe' },
      from: { chapterId: 'chapter-1', nodeId: 'choice' },
      to: { chapterId: 'chapter-2', nodeId: 'result' },
      status: 'playing',
      effects: [],
      variableChanges: [{ path: 'score', before: 1, after: 2 }],
    },
  ],
}

describe('runtimeInspectorPanel', () => {
  it('shows the runtime overview and exports exactly once', async () => {
    const wrapper = mount(RuntimeInspectorPanel, { props: { model } })

    expect(wrapper.text()).toContain('chapter-1#choice')
    expect(wrapper.text()).toContain('waiting-choice')
    expect(wrapper.text()).toContain('choices')
    expect(wrapper.text()).toContain('2 checkpoints')
    await wrapper.get('button[aria-label="Export runtime report"]').trigger('click')
    expect(wrapper.emitted('export')).toHaveLength(1)
  })

  it('expands nested variables with accessible controls', async () => {
    const wrapper = mount(RuntimeInspectorPanel, { props: { model } })
    await wrapper.get('[role="tab"][aria-controls="runtime-variables"]').trigger('click')

    const expand = wrapper.get('button[aria-label="Expand profile"]')
    await expand.trigger('click')
    expect(wrapper.text()).toContain('mood')
    expect(wrapper.text()).toContain('curious')
    expect(wrapper.get('button[aria-label="Collapse profile"]').exists()).toBe(true)
  })

  it('filters and inspects trace entries', async () => {
    const wrapper = mount(RuntimeInspectorPanel, { props: { model } })
    await wrapper.get('[role="tab"][aria-controls="runtime-trace"]').trigger('click')
    await wrapper.get('select[aria-label="Filter trace command"]').setValue('choose')

    expect(wrapper.findAll('[data-trace-entry]')).toHaveLength(1)
    expect(wrapper.text()).toContain('#3 choose')
    expect(wrapper.text()).not.toContain('#2 next')
    await wrapper.get('[data-trace-entry]').trigger('click')
    expect(wrapper.text()).toContain('chapter-1#choice → chapter-2#result')
    expect(wrapper.text()).toContain('score')
    expect(wrapper.text()).toContain('1 → 2')
  })

  it('exposes all tabs and controls with accessible roles and labels', () => {
    const wrapper = mount(RuntimeInspectorPanel, { props: { model } })
    expect(wrapper.get('[role="tablist"]').attributes('aria-label')).toBe('Runtime inspector sections')
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(4)
    expect(wrapper.get('[role="tab"][aria-selected="true"]').text()).toBe('Overview')
  })

  it('lets an embedding host provide its own export action and empty-trace label', async () => {
    const wrapper = mount(RuntimeInspectorPanel, {
      props: {
        model: { ...model, trace: [] },
        showExport: false,
        emptyTraceLabel: '尚无运行轨迹',
      },
    })

    expect(wrapper.find('button[aria-label="Export runtime report"]').exists()).toBe(false)
    await wrapper.get('[role="tab"][aria-controls="runtime-trace"]').trigger('click')
    expect(wrapper.text()).toContain('尚无运行轨迹')
  })
})
