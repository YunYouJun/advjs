// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { compileMarkdownProgram } from '../../packages/core/src'

async function compile(content: string) {
  return compileMarkdownProgram({
    id: 'choice-ids',
    chapters: [{
      id: 'chapter-1',
      sourcePath: 'choice-ids.adv.md',
      content,
    }],
  })
}

function options(result: Awaited<ReturnType<typeof compile>>) {
  const nodes = result.program?.chapters['chapter-1'].nodes ?? {}
  return Object.values(nodes).find(node => node.kind === 'choices')?.data?.options
}

describe('markdown choice ids', () => {
  it('uses an authored stable id from choice metadata', async () => {
    const result = await compile([
      '## 开始 {#start}',
      '',
      '- [继续观察](#star-map)',
      '',
      '  ```yaml',
      '  id: continue-observing',
      '  actions:',
      '    - type: variables/increment',
      '      key: curiosity',
      '  ```',
      '',
      '## 星图 {#star-map}',
      '',
      '抵达星图。',
    ].join('\n'))

    expect(result.diagnostics).toEqual([])
    expect(options(result)).toEqual([
      expect.objectContaining({
        id: 'continue-observing',
        label: '继续观察',
      }),
    ])
  })

  it('keeps the generated id when metadata omits one', async () => {
    const result = await compile([
      '- [继续](#finish)',
      '',
      '## 完成 {#finish}',
    ].join('\n'))

    expect(result.diagnostics).toEqual([])
    expect(options(result)).toEqual([
      expect.objectContaining({ id: 'choice-1', label: '继续' }),
    ])
  })

  it('reports an invalid authored id at the choice source', async () => {
    const result = await compile([
      '- [继续](#finish)',
      '',
      '  ```yaml',
      '  id: Not Valid',
      '  ```',
      '',
      '## 完成 {#finish}',
    ].join('\n'))

    expect(result.program).toBeUndefined()
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'ADV_RUNTIME_INVALID_CHOICE_ID',
      severity: 'error',
      source: expect.objectContaining({ file: 'choice-ids.adv.md', line: 1 }),
    }))
  })

  it('reports duplicate authored ids at the repeated choice source', async () => {
    const result = await compile([
      '- [第一次](#finish)',
      '',
      '  ```yaml',
      '  id: same-choice',
      '  ```',
      '',
      '- [第二次](#finish)',
      '',
      '  ```yaml',
      '  id: same-choice',
      '  ```',
      '',
      '## 完成 {#finish}',
    ].join('\n'))

    expect(result.program).toBeUndefined()
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'ADV_RUNTIME_DUPLICATE_CHOICE_ID',
      severity: 'error',
      source: expect.objectContaining({ file: 'choice-ids.adv.md', line: 7 }),
    }))
  })
})
