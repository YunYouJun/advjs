import { compileFlowProgram, compileMarkdownProgram, compileProject } from '@advjs/core'
import { describe, expect, it } from 'vitest'

describe('runtime authoring source map', () => {
  it('keeps source locations separate from program identity and remaps joined Markdown sources', async () => {
    const first = '# 开始 {#start}\n\n第一段。'
    const second = '第二段。'
    const chapters = [{ id: 'intro', content: `${first}\n\n${second}`, sourcePath: 'joined.md', sourceFiles: [{ path: 'adv/chapters/one.adv.md', content: first }, { path: 'adv/chapters/two.adv.md', content: second }] }]
    const mapped = await compileMarkdownProgram({ id: 'source-map', chapters })
    const unmapped = await compileMarkdownProgram({ id: 'source-map', chapters: chapters.map(({ sourceFiles: _, ...chapter }) => ({ ...chapter, sourcePath: 'other.md' })) })
    expect(mapped.program?.hash).toBe(unmapped.program?.hash)
    expect(Object.values(mapped.sourceMap ?? {})).toContainEqual({ file: 'adv/chapters/two.adv.md', line: 1, column: 1 })
    expect(JSON.stringify(mapped.program)).not.toContain('adv/chapters/two.adv.md')
  })

  it('makes compiled project and Flow node locations available without inventing JSON line numbers', async () => {
    const compiled = await compileProject({ files: { 'adv.config.json': '{"format":"adv-md","root":"adv"}', 'adv/chapters/intro.adv.md': '# 标题 {#start}\n\n真实文本。' } })
    expect(compiled.sourceMap.nodes?.['intro#node-1']).toEqual({ path: 'adv/chapters/intro.adv.md', line: 3, column: 1 })
    const flow = await compileFlowProgram({ id: 'flow-source-map', sourcePaths: { intro: 'adv/flows/intro.json' }, chapters: [{ id: 'intro', title: 'Intro', startNodeId: 'end', nodes: [{ id: 'end', type: 'end', next: null }] }] })
    expect(flow.sourceMap?.['intro#end']).toEqual({ file: 'adv/flows/intro.json' })
  })
})
