import { compileMarkdownProgram, compileProject, createAdvRuntime, createProjectGameConfig } from '@advjs/core'
import { projectGlossarySource } from '@advjs/parser'
import { describe, expect, it } from 'vitest'

const glossary = '# 私密作者资料\n\n| 术语 | 定义 | 备注 |\n| --- | --- | --- |\n| 星 | 作者剧透 | 不能公开 |\n\n[^星之记忆]: 封存的**关键记忆**。[说明](https://example.invalid/private)\n\n[^unused]: 未引用剧透\n'
const chapter = '@小雨\n星之记忆[^星之记忆]，再次[^星之记忆]。'

describe('player glossary projection', () => {
  it('reuses shared author material while publishing only referenced plain text', async () => {
    const result = await compileProject({ files: {
      'adv.config.json': '{"root":"adv"}',
      'adv/glossary.md': glossary,
      'adv/chapters/intro.adv.md': chapter,
      'adv/chapters/later.adv.md': chapter,
    } }, { validateContentReferences: false })
    expect(result.diagnostics).toEqual([])
    const program = result.project.program!
    const published = JSON.stringify(program)
    expect(published).toContain('封存的关键记忆。说明')
    for (const privateText of ['作者剧透', '不能公开', '未引用剧透', 'https://', '私密作者资料'])
      expect(published).not.toContain(privateText)
    for (const chapter of Object.values(program.chapters)) {
      const node = Object.values(chapter.nodes).find(node => node.kind === 'dialog')!
      expect(node.data?.text).toBe('星之记忆[星之记忆]，再次[星之记忆]。')
      expect(node.data?.glossary).toHaveLength(2)
    }
    const runtime = createAdvRuntime({ program })
    await runtime.start()
    const current = JSON.stringify(runtime.current)
    const snapshot = runtime.snapshot()
    await runtime.go({ chapterId: 'later', nodeId: 'node-0' })
    expect(runtime.state.cursor?.chapterId).toBe('later')
    expect(runtime.current?.data?.glossary).toHaveLength(2)
    runtime.restore(snapshot)
    expect(JSON.stringify(runtime.current)).toBe(current)
    expect(JSON.stringify(runtime.snapshot())).not.toContain('未引用剧透')
  })

  it('round-trips the same references through Editor/export Markdown data URLs', async () => {
    const files = {
      'adv.config.json': '{"root":"adv"}',
      'adv/glossary.md': glossary.replace('封存的**关键记忆**。', '封存的**关键记忆**。`<tag>` 与 `&copy;`。'),
      'adv/chapters/intro.adv.md': chapter,
    }
    const result = await compileProject({ files }, { validateContentReferences: false })
    const config = createProjectGameConfig(result, files)
    const source = config.chapters[0].nodes[0]
    expect(source.type).toBe('fountain')
    const content = decodeURIComponent(('src' in source ? source.src : '').split(',')[1])
    expect(content).not.toContain('作者剧透')
    expect(content).not.toContain('未引用剧透')
    expect(content).not.toContain('https://')
    const rebuilt = await compileMarkdownProgram({ id: 'preview', chapters: [{ id: 'intro', content }] })
    expect(rebuilt.diagnostics).toEqual([])
    expect(rebuilt.program!.chapters.intro.nodes['node-0'].data).toEqual(result.project.program!.chapters.intro.nodes['node-0'].data)
  })

  it('supports chapter-local definitions, normalized identifiers and deterministic recompilation', async () => {
    const source = { id: 'local', chapters: [{ id: 'one', content: '@Host\nTerm[^Foo].\n\n[^foo]: Local explanation' }, { id: 'two', content: '@Host\nTerm[^foo].\n\n[^foo]: Second chapter explanation' }] }
    const first = await compileMarkdownProgram(source)
    const second = await compileMarkdownProgram(source)
    expect(first.diagnostics).toEqual([])
    expect(first.program).toEqual(second.program)
    expect(first.program!.chapters.one.nodes['node-0'].data?.glossary).toMatchObject([{ identifier: 'foo', definition: 'Local explanation' }])
    expect(first.program!.chapters.two.nodes['node-0'].data?.glossary).toMatchObject([{ definition: 'Second chapter explanation' }])
  })

  it.each([
    ['missing', '@Host\nUnknown[^missing]', '', 'ADV_RUNTIME_MISSING_GLOSSARY_DEFINITION'],
    ['empty', '@Host\nEmpty[^empty]\n\n[^empty]: ', '', 'ADV_RUNTIME_MISSING_GLOSSARY_DEFINITION'],
    ['duplicate local', '@Host\nTerm[^x]\n\n[^x]: One\n\n[^X]: Two', '', 'ADV_RUNTIME_DUPLICATE_GLOSSARY_DEFINITION'],
    ['conflicting shared', '@Host\nTerm[^x]\n\n[^x]: One', '[^x]: Two', 'ADV_RUNTIME_DUPLICATE_GLOSSARY_DEFINITION'],
  ])('diagnoses %s definitions rather than silently overriding', async (_name, content, glossary, code) => {
    const result = await compileMarkdownProgram({ id: 'invalid', glossary, chapters: [{ id: 'one', content }] })
    expect(result.program).toBeUndefined()
    expect(result.diagnostics.some(item => item.code === code)).toBe(true)
  })

  it('does not interpret escaped markers, inline code, ordinary links or HTML as references', async () => {
    const content = '@Host\nEscaped \\[^missing], `[^code]`, [link](https://example.invalid), **strong**.'
    const result = await compileMarkdownProgram({ id: 'safe', chapters: [{ id: 'one', content }] })
    expect(result.diagnostics).toEqual([])
    expect(result.program!.chapters.one.nodes['node-0'].data?.glossary).toBeUndefined()
  })

  it('projects chapter-local definitions as referenced plain text without unused definitions or URLs', async () => {
    const files = {
      'adv.config.json': '{"root":"adv"}',
      'adv/chapters/intro.adv.md': '---\ntitle: Preserve frontmatter\n---\n\n@Host\nTerm[^x]\n\n[^x]: [Public](https://secret-url.invalid)\n\n[^unused]: PRIVATE-LOCAL-DEFINITION 😀\n\n~~~\nunclosed example',
    }
    const result = await compileProject({ files }, { validateContentReferences: false })
    expect(result.diagnostics).toEqual([])
    const source = createProjectGameConfig(result, files).chapters[0].nodes[0]
    const content = decodeURIComponent(('src' in source ? source.src : '').split(',')[1])
    expect(content).toMatch(/^---\ntitle: Preserve frontmatter\n---/u)
    expect(content).toContain('~~~\nunclosed example')
    expect(content).not.toContain('secret-url')
    expect(content).not.toContain('PRIVATE-LOCAL-DEFINITION')
    expect(files['adv/chapters/intro.adv.md']).toContain('PRIVATE-LOCAL-DEFINITION')
    const rebuilt = await compileMarkdownProgram({ id: 'roundtrip', chapters: [{ id: 'intro', content }] })
    expect(rebuilt.diagnostics).toEqual([])
    expect(rebuilt.program!.chapters.intro.nodes['node-0'].data).toEqual(result.project.program!.chapters.intro.nodes['node-0'].data)
  })

  it('resolves references before unclosed fences and preserves native reference links and emphasis', async () => {
    const content = '@Host\n[Guide][url] **Term[^x]**\n\n[url]: https://example.invalid\n\n~~~\nexample'
    const result = await compileMarkdownProgram({ id: 'fence', glossary: '[^x]: Explanation', chapters: [{ id: 'one', content }] })
    expect(result.diagnostics).toEqual([])
    expect(result.program!.chapters.one.nodes['node-0'].data).toMatchObject({ text: 'Guide Term[x]', glossary: [{ definition: 'Explanation' }] })
    const missing = await compileMarkdownProgram({ id: 'missing', chapters: [{ id: 'one', content }] })
    expect(missing.program).toBeUndefined()
    expect(missing.diagnostics).toMatchObject([{ code: 'ADV_RUNTIME_MISSING_GLOSSARY_DEFINITION', source: { line: 2 } }])
  })

  it('lets Markdown determine even and odd backslash escaping of missing references', async () => {
    for (const count of [1, 2, 3, 4]) {
      const content = `@Host\nTerm${'\\'.repeat(count)}[^missing]`
      const result = await compileMarkdownProgram({ id: 'escape', chapters: [{ id: 'one', content }] })
      expect(result.diagnostics.some(item => item.code === 'ADV_RUNTIME_MISSING_GLOSSARY_DEFINITION')).toBe(count % 2 === 0)
    }
  })

  it('strips definitions continued across chapter source files without changing unrelated source', async () => {
    const files = {
      'adv.config.json': '{"root":"adv"}',
      'adv/chapters/intro/a.adv.md': '@Host\nTerm[^x]\n\n[^x]: Public\n\n[^unused]: PRIVATE-START 😀',
      'adv/chapters/intro/b.adv.md': '    PRIVATE-CONTINUATION 😀\n\n@Host\nUnrelated next line.',
    }
    const result = await compileProject({ files }, { validateContentReferences: false })
    expect(result.diagnostics).toEqual([])
    const sources = createProjectGameConfig(result, files).chapters[0].nodes.map(node => decodeURIComponent(('src' in node ? node.src : '').split(',')[1]))
    expect(sources).toHaveLength(2)
    expect(sources.join('\n\n')).not.toContain('PRIVATE-')
    expect(sources[1]).toContain('@Host\nUnrelated next line.')
    const rebuilt = await compileMarkdownProgram({ id: 'multi-source', chapters: [{ id: 'intro', content: sources.join('\n\n') }] })
    expect(rebuilt.diagnostics).toEqual([])
    expect(rebuilt.program!.chapters.intro.nodes['node-0'].data).toEqual(result.project.program!.chapters.intro.nodes['node-0'].data)
  })

  it('keeps malformed markers literal and resolves valid escaped-bracket identifiers', async () => {
    for (const marker of ['[^a[b]', '[^foo bar]', '[^]', '[^unfinished']) {
      const result = await compileMarkdownProgram({ id: 'literal', chapters: [{ id: 'one', content: `@Host\nLiteral ${marker}` }] })
      expect(result.diagnostics).toEqual([])
      expect(result.program!.chapters.one.nodes['node-0'].data?.text).toBe(`Literal ${marker}`)
    }
    const result = await compileMarkdownProgram({ id: 'escaped-label', glossary: String.raw`[^a\]b]: Explanation`, chapters: [{ id: 'one', content: `@Host\n${String.raw`Term[^a\]b]`}` }] })
    expect(result.diagnostics).toEqual([])
    expect(result.program!.chapters.one.nodes['node-0'].data).toMatchObject({ text: 'Term[a]b]', glossary: [{ definition: 'Explanation' }] })
  })

  it.each([
    '> [^unused]: PRIVATE-BLOCKQUOTE',
    '- Visible item\n\n  [^unused]: PRIVATE-LIST',
    '[^outer]: PRIVATE-OUTER\n\n    > [^inner]: PRIVATE-INNER',
    '> Visible quote\n>\n> [^unused]: PRIVATE-START 😀\n>\n>     PRIVATE-CONTINUATION',
  ])('removes nested definition spans from player source: %s', async (nested) => {
    const original = `@Host\nHello\n\n${nested}\n\n@Host\nUnrelated ending.`
    const files = { 'adv.config.json': '{"root":"adv"}', 'adv/chapters/intro.adv.md': original }
    const result = await compileProject({ files }, { validateContentReferences: false })
    expect(result.diagnostics).toEqual([])
    expect(JSON.stringify(result.project.program)).not.toContain('PRIVATE-')
    const source = createProjectGameConfig(result, files).chapters[0].nodes[0]
    const projected = decodeURIComponent(('src' in source ? source.src : '').split(',')[1])
    expect(projected).not.toContain('PRIVATE-')
    expect(projected).toHaveLength(original.length)
    expect(projected.indexOf('@Host\nUnrelated ending.')).toBe(original.indexOf('@Host\nUnrelated ending.'))
    expect(projected.match(/\n/gu)?.length).toBe(original.match(/\n/gu)?.length)
    expect(files['adv/chapters/intro.adv.md']).toBe(original)
    const rebuilt = await compileMarkdownProgram({ id: 'nested-roundtrip', chapters: [{ id: 'intro', content: projected }] })
    expect(rebuilt.diagnostics).toEqual([])
    expect(rebuilt.program).toBeDefined()
    expect(JSON.stringify(rebuilt.program)).not.toContain('PRIVATE-')
    if (nested.includes('Visible item'))
      expect(projected).toContain('- Visible item')
    if (nested.includes('Visible quote'))
      expect(projected).toContain('> Visible quote')
  })

  it('preserves malformed, escaped and code examples while recursively stripping actual definitions', () => {
    const unchanged = String.raw`> \[^escaped]: literal

- [^invalid label]: ordinary link definition

~~~md
> [^code]: literal example
~~~

> Visible 😀`
    const content = `${unchanged}\r\n\r\n> [^secret]: PRIVATE-CRLF 😀\r\n>\r\n>     PRIVATE-CONTINUATION\r\n\r\nAfter`
    const projected = projectGlossarySource(content, new Map())
    expect(projected).toHaveLength(content.length)
    expect(projected.startsWith(unchanged)).toBe(true)
    expect(projected).not.toContain('PRIVATE-')
    expect(projected.match(/\r\n/gu)).toEqual(content.match(/\r\n/gu))
    expect(projected.indexOf('After')).toBe(content.indexOf('After'))
  })

  it('does not flatten a nested unused definition into its referenced parent explanation', async () => {
    const files = {
      'adv.config.json': '{"root":"adv"}',
      'adv/chapters/intro.adv.md': '@Host\nTerm[^outer]\n\n[^outer]: Public explanation\n\n    > [^unused]: PRIVATE-NESTED-DEFINITION',
    }
    const result = await compileProject({ files }, { validateContentReferences: false })
    expect(result.diagnostics).toEqual([])
    expect(JSON.stringify(result.project.program)).not.toContain('PRIVATE-')
    const source = createProjectGameConfig(result, files).chapters[0].nodes[0]
    const projected = decodeURIComponent(('src' in source ? source.src : '').split(',')[1])
    expect(projected).not.toContain('PRIVATE-')
    expect(projected).toContain('Public explanation')
  })
})
