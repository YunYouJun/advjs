import { compileMarkdownProgram, compileProject, createAdvRuntime, createProjectGameConfig } from '@advjs/core'
import { readGlossaryContent } from '@advjs/parser'
import { describe, expect, it } from 'vitest'

async function roundtrip(glossary: string) {
  const files = {
    'adv.config.json': '{"root":"adv"}',
    'adv/glossary.md': glossary,
    'adv/chapters/intro.adv.md': '@Host\nTerm[^term]',
  }
  const first = await compileProject({ id: 'markdown-glossary', files }, { validateContentReferences: false })
  expect(first.diagnostics).toEqual([])
  const config = createProjectGameConfig(first, files)
  const chapters = config.chapters.map(chapter => ({ id: chapter.id, title: chapter.title, content: chapter.nodes.map(node => decodeURIComponent(('src' in node ? node.src : '').split(',')[1])).join('\n\n') }))
  const second = await compileMarkdownProgram({ id: first.project.program!.id, chapters })
  expect(second.diagnostics).toEqual([])
  expect(second.program!.chapters).toEqual(first.project.program!.chapters)
  expect(second.program!.hash).toBe(first.project.program!.hash)
  expect(files['adv/glossary.md']).toBe(glossary)
  return { program: second.program!, transport: chapters[0].content }
}

describe('safe glossary Markdown projection', () => {
  it('preserves paragraphs, marks, inline code and nested/ordered lists through projection and save/load', async () => {
    const { program } = await roundtrip('[^term]: **中文** and *English* with `.adv.md`.\n\n    Second paragraph.\n\n    - First item\n    - Second item\n      - Nested **item**\n\n    3. Third\n    4. Fourth')
    const reference = (program.chapters.intro.nodes['node-0'].data!.glossary as Array<Record<string, unknown>>)[0]
    expect(reference.definition).toBeTypeOf('string')
    const content = readGlossaryContent(reference.definitionContent)!
    expect(content.map(node => node.type)).toEqual(['paragraph', 'paragraph', 'list', 'list'])
    expect(content[0]).toMatchObject({ children: [{ type: 'strong' }, { type: 'text' }, { type: 'emphasis' }, { type: 'text' }, { type: 'inlineCode', value: '.adv.md' }, { type: 'text', value: '.' }] })
    expect(content[3]).toMatchObject({ type: 'list', ordered: true, start: 3 })
    const runtime = createAdvRuntime({ program })
    await runtime.start()
    const saved = runtime.snapshot()
    await runtime.next()
    runtime.restore(saved)
    expect(runtime.current?.data?.glossary).toEqual([reference])
  })

  it('strips HTML, scripts, image destinations, link destinations and nested/unused author notes', async () => {
    const { program, transport } = await roundtrip('[^term]: **Public** [label](javascript:alert%281%29) ![alt](https://private-image.invalid/x) <img src="https://private-html.invalid">\n\n    <script>PRIVATE_SCRIPT</script>\n\n    > [^nested]: PRIVATE_NESTED\n\n[^unused]: PRIVATE_UNUSED')
    for (const secret of ['javascript:', 'https://', '<img', '<script', 'PRIVATE_']) {
      expect(JSON.stringify(program)).not.toContain(secret)
      expect(transport).not.toContain(secret)
    }
    expect(transport).toContain('**Public**')
    const content = (program.chapters.intro.nodes['node-0'].data!.glossary as Array<Record<string, unknown>>)[0].definitionContent
    expect(JSON.stringify(content)).toContain('label')
    expect(JSON.stringify(content)).toContain('alt')
    expect(JSON.stringify(content)).not.toContain('"url"')
  })

  it('escapes literal Markdown punctuation so reserialization cannot create links, HTML or new definitions', async () => {
    const { program, transport } = await roundtrip('[^term]: **Public** literal \\[x\\]\\(javascript:alert\\(1\\)\\) and \\<b\\> and \\# heading and \\- item.\n\n    Code: `[^secret]: do not register` and ``a ` b``.\n\n    Literal \\[\\^other\\]: harmless.')
    const content = (program.chapters.intro.nodes['node-0'].data!.glossary as Array<Record<string, unknown>>)[0].definitionContent
    expect(JSON.stringify(content)).toContain('[x](javascript:alert(1))')
    expect(JSON.stringify(content)).not.toContain('"type":"link"')
    expect(JSON.stringify(content)).not.toContain('"type":"html"')
    expect(transport).toContain('`[^secret]: do not register`')
  })

  it.each([
    '**First**  \n    next',
    '**First** ![alt][img]\n\n[img]: https://secret.invalid',
    '**First**\n\n    <script>SECRET</script>\n\n    Last',
    '**A**__B__',
    '**A**<i></i>**B**',
    '*A*_B_',
    '`A`<i></i>`B`',
    '**A **B** C**',
    '**Table**\n\n    | A | B |\n    | - | - |\n    | C | D |',
  ])('keeps canonical text, formatting and hash through export: %s', async (definition) => {
    await roundtrip(`[^term]: ${definition}`)
  })

  it('keeps the legacy plain-text data shape for unformatted definitions', async () => {
    const { program } = await roundtrip('[^term]: Plain explanation 中文')
    expect(program.chapters.intro.nodes['node-0'].data).toEqual({ character: 'Host', speakerId: 'Host', status: '', text: 'Term[term]', glossary: [{ identifier: 'term', label: '[term]', definition: 'Plain explanation 中文', start: 4, end: 10 }] })
  })

  it('falls back as a whole when authored formatting exceeds the safe AST budget', async () => {
    const text = Array.from({ length: 600 }).fill('**word**').join(' ')
    const result = await compileMarkdownProgram({ id: 'bounded', glossary: `[^term]: ${text}`, chapters: [{ id: 'intro', content: '@Host\nTerm[^term]' }] })
    expect(result.diagnostics).toEqual([])
    const reference = (result.program!.chapters.intro.nodes['node-0'].data!.glossary as Array<Record<string, unknown>>)[0]
    expect(reference.definitionContent).toBeUndefined()
    expect(reference.definition).toBe(Array.from({ length: 600 }).fill('word').join(' '))
  })
})
