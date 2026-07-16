import { describe, expect, it } from 'vitest'
import { compileMarkdownProgram } from '../../src/compiler'

const chapter = `---
title: Runtime Demo
---

\`\`\`yaml
type: background
url: observatory.webp
\`\`\`

@我(smile)
星图已经展开。

- 继续观察
- 返回舱室
`

describe('compileMarkdownProgram', () => {
  it('normalizes narrative, choices, and code operations', async () => {
    const result = await compileMarkdownProgram({
      id: 'demo',
      chapters: [{ id: 'chapter-1', title: '第一章', content: chapter }],
    })

    expect(result.diagnostics).toEqual([])
    const runtimeChapter = result.program?.chapters['chapter-1']
    expect(runtimeChapter?.order.map(id => runtimeChapter.nodes[id].kind)).toEqual([
      'effects',
      'dialog',
      'choices',
      'end',
    ])
    expect(runtimeChapter?.nodes['node-0'].next).toEqual({
      chapterId: 'chapter-1',
      nodeId: 'node-1',
    })
  })

  it('rejects executable script blocks instead of compiling code strings', async () => {
    const result = await compileMarkdownProgram({
      id: 'unsafe',
      chapters: [{
        id: 'chapter-1',
        content: `\`\`\`js\nwindow.alert('unsafe')\n\`\`\``,
      }],
    })

    expect(result.program).toBeUndefined()
    expect(result.diagnostics[0]?.code).toBe('ADV_RUNTIME_EXECUTABLE_SCRIPT')
  })

  it('rejects executable choice actions before they reach the runtime', async () => {
    const result = await compileMarkdownProgram({
      id: 'unsafe-choice',
      chapters: [{
        id: 'chapter-1',
        content: `- Run\n\n  \`\`\`js\n  window.alert('unsafe')\n  \`\`\``,
      }],
    })

    expect(result.program).toBeUndefined()
    expect(result.diagnostics[0]?.code).toBe('ADV_RUNTIME_CHOICE_LINK_REQUIRED')
  })
})
