// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { compileRuntimeChapterFiles } from '../../../packages/advjs/node/runtime/project'

it('loads local author glossary for CLI compilation and reports its exact duplicate location', async () => {
  const root = await mkdtemp(join(tmpdir(), 'adv-glossary-'))
  try {
    const path = join(root, 'intro.adv.md')
    const glossaryPath = join(root, 'glossary.md')
    await writeFile(path, '@Host\nTerm[^term]')
    await writeFile(glossaryPath, '# Private author note\n\n[^term]: Public definition')
    const options = { id: 'cli', chapters: [{ id: 'intro', paths: [path] }], glossaryPath }
    const compiled = await compileRuntimeChapterFiles(options)
    expect(compiled.diagnostics).toEqual([])
    expect(JSON.stringify(compiled.program)).toContain('Public definition')
    expect(JSON.stringify(compiled.program)).not.toContain('Private author note')
    await writeFile(glossaryPath, '[^term]: First\n\n[^TERM]: Duplicate')
    const invalid = await compileRuntimeChapterFiles(options)
    expect(invalid.program).toBeUndefined()
    expect(invalid.diagnostics).toMatchObject([{ code: 'ADV_RUNTIME_DUPLICATE_GLOSSARY_DEFINITION', source: { file: glossaryPath, line: 3 } }])
    const absent = await compileRuntimeChapterFiles({ ...options, glossaryPath: join(root, 'absent.md') })
    expect(absent.diagnostics).toMatchObject([{ code: 'ADV_RUNTIME_MISSING_GLOSSARY_DEFINITION', source: { file: path, line: 2, column: 5 } }])
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
