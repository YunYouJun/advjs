// @vitest-environment node

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  compileRuntimeChapterFiles,
  discoverRuntimeChapterFiles,
  resolveConfiguredRuntimeChapterFiles,
} from '../../packages/advjs/node/runtime/project'

describe('runtime project loader', () => {
  let directory: string

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'advjs-runtime-project-'))
  })

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
  })

  it('discovers numeric chapter folders with stable chapter ids', async () => {
    const chapters = join(directory, 'chapters')
    await mkdir(join(chapters, '1'), { recursive: true })
    await mkdir(join(chapters, '2'), { recursive: true })
    const one = join(chapters, '1', 'one.adv.md')
    const two = join(chapters, '2', 'two.adv.md')
    await writeFile(one, '第一章。')
    await writeFile(two, '第二章。')

    expect(await discoverRuntimeChapterFiles(one)).toEqual([
      { id: 'chapter-1', title: 'chapter-1', paths: [one] },
      { id: 'chapter-2', title: 'chapter-2', paths: [two] },
    ])
  })

  it('compiles all files and uses the requested chapter as program entry', async () => {
    const one = join(directory, 'one.adv.md')
    const two = join(directory, 'two.adv.md')
    await writeFile(one, [
      '## Start {#start}',
      '',
      '- [Go](chapter-2#result)',
    ].join('\n'))
    await writeFile(two, [
      '## Result {#result}',
      '',
      '抵达第二章。',
    ].join('\n'))

    const result = await compileRuntimeChapterFiles({
      id: 'project',
      entryChapterId: 'chapter-2',
      chapters: [
        { id: 'chapter-1', title: 'One', paths: [one] },
        { id: 'chapter-2', title: 'Two', paths: [two] },
      ],
    })

    expect(result.diagnostics).toEqual([])
    expect(result.program?.entry).toEqual({ chapterId: 'chapter-2', nodeId: 'result' })
    expect(result.program?.chapters['chapter-1'].nodes['node-1'].data?.options).toEqual([
      {
        id: 'choice-1',
        label: 'Go',
        target: { chapterId: 'chapter-2', nodeId: 'result' },
      },
    ])
  })

  it('maps configured fountain URLs to exact chapter ids', async () => {
    const publicRoot = join(directory, 'public')
    const one = join(publicRoot, 'md', 'chapters', '1', 'one.adv.md')
    const two = join(publicRoot, 'md', 'chapters', '2', 'two.adv.md')
    await mkdir(join(publicRoot, 'md', 'chapters', '1'), { recursive: true })
    await mkdir(join(publicRoot, 'md', 'chapters', '2'), { recursive: true })
    await writeFile(one, '第一章。')
    await writeFile(two, '第二章。')

    const result = resolveConfiguredRuntimeChapterFiles({
      cwd: directory,
      scriptPath: two,
      chapters: [
        { id: 'prologue', title: '序章', nodes: [{ id: 'one', type: 'fountain', src: '/md/chapters/1/one.adv.md' }] },
        { id: 'result', title: '结果', nodes: [{ id: 'two', type: 'fountain', src: '/md/chapters/2/two.adv.md' }] },
      ],
    })

    expect(result).toEqual({
      entryChapterId: 'result',
      chapters: [
        { id: 'prologue', title: '序章', paths: [one] },
        { id: 'result', title: '结果', paths: [two] },
      ],
    })
  })
})
