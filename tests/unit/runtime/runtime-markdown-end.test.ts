import { compileMarkdownProgram, createAdvRuntime } from '@advjs/core'
import { describe, expect, it } from 'vitest'

describe('explicit Markdown endings', () => {
  it('ends a selected branch before later branches and their actions execute', async () => {
    const compiled = await compileMarkdownProgram({
      id: 'branch-end',
      chapters: [{
        id: 'intro',
        content: ['- [Finish](#finish)', '', '## Finish {#finish}', '', '@Host', 'Goodbye.', '', '```yaml', 'type: end', 'text: Finished', '```', '', '## Another branch {#other}', '', '```yaml', 'type: actions', 'actions:', '  - type: variables/set', '    key: leaked', '    value: true', '```', '', 'Should not display.'].join('\n'),
      }],
    })
    expect(compiled.diagnostics.filter(d => d.severity === 'error')).toEqual([])
    const runtime = createAdvRuntime({ program: compiled.program! })
    await runtime.start()
    await runtime.choose('choice-1')
    expect(runtime.current?.data?.text).toBe('Goodbye.')
    await runtime.next()
    expect(runtime.state.status).toBe('ended')
    expect(runtime.current?.data?.text).toBe('Finished')
    expect(runtime.state.variables.leaked).toBeUndefined()
    const saved = runtime.snapshot()
    runtime.restore(saved)
    expect(runtime.state.status).toBe('ended')
  })

  it('respects an ending condition without terminating the other path', async () => {
    const compiled = await compileMarkdownProgram({
      id: 'conditional-end',
      chapters: [{ id: 'intro', content: '```yaml\ntype: when\ncondition: shouldEnd\n```\n\n```yaml\ntype: end\n```\n\n@Host\nContinue.' }],
    })
    for (const shouldEnd of [true, false]) {
      const runtime = createAdvRuntime({ program: compiled.program!, initialVariables: { shouldEnd } })
      await runtime.start()
      expect(runtime.state.status).toBe(shouldEnd ? 'ended' : 'playing')
    }
  })
})
