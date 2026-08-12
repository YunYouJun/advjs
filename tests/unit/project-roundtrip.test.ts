// @vitest-environment node

import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadProject } from '../../packages/advjs/node/project'
import { applyProjectPatches, compileProject } from '../../packages/core/src'

const originalFiles = {
  'adv.config.json': `{
  "format": "adv-md",
  "root": "adv",
  "theme": "default",
  "futureConfig": { "keep": true }
}
`,
  'adv/settings/game.json': `{
  "title": "原始标题",
  "entryChapterId": "chapter-1",
  "futureGame": { "keep": [1, 2, 3] }
}
`,
  'adv/characters/xiaoyu.character.md': `---
id: xiaoyu
name: 小雨
aliases: [小雨]
customLore: 永远保留
---

## 人物正文

这段无关 Markdown 必须保持原样。
`,
  'adv/scenes/room.md': `---
id: room
name: 房间
customScene: keep
---

# 房间
`,
  'adv/chapters/chapter-1.adv.md': `【房间】

@小雨
你好。
`,
}

const expectedChapter = `【房间】

@小雨
你好。

> 新增但明确授权的原文编辑。
`

const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(root => rm(root, { force: true, recursive: true })))
})

describe('standard project lossless roundtrip', () => {
  it('changes only authorized fields and keeps unknown source bytes', async () => {
    const result = applyProjectPatches(originalFiles, [
      { kind: 'json-set', path: 'adv.config.json', key: 'theme', value: 'night' },
      { kind: 'json-set', path: 'adv/settings/game.json', key: 'title', value: '雨夜来信' },
      { kind: 'frontmatter-set', path: 'adv/characters/xiaoyu.character.md', key: 'name', value: '小雨（编辑）' },
      { kind: 'raw-text', path: 'adv/chapters/chapter-1.adv.md', content: expectedChapter },
    ])

    expect(result.files['adv.config.json']).toContain('"futureConfig": { "keep": true }')
    expect(result.files['adv/settings/game.json']).toContain('"futureGame": { "keep": [1, 2, 3] }')
    expect(result.files['adv/characters/xiaoyu.character.md']).toContain('customLore: 永远保留')
    expect(result.files['adv/characters/xiaoyu.character.md']).toContain('这段无关 Markdown 必须保持原样。')
    expect(result.files['adv/scenes/room.md']).toBe(originalFiles['adv/scenes/room.md'])
    expect(result.changedPaths).toEqual([
      'adv.config.json',
      'adv/chapters/chapter-1.adv.md',
      'adv/characters/xiaoyu.character.md',
      'adv/settings/game.json',
    ])

    const changedSnapshot = result.changedPaths.map(path => `${path}\n${result.files[path]}`).join('\n---\n')
    expect(createHash('sha256').update(changedSnapshot).digest('hex')).toBe('0c89b2b9ab8c8f3270d286cf41e25685db9ae205147aa04753d738dff338556c')
  })

  it('recompiles to the same normalized project through browser and Node loaders', async () => {
    const result = applyProjectPatches(originalFiles, [
      { kind: 'json-set', path: 'adv/settings/game.json', key: 'title', value: '雨夜来信' },
      { kind: 'frontmatter-set', path: 'adv/characters/xiaoyu.character.md', key: 'name', value: '小雨（编辑）' },
    ])
    const browser = await compileProject({ files: result.files })
    expect(browser.diagnostics.filter(item => item.severity === 'error')).toEqual([])

    const root = await mkdtemp(join(tmpdir(), 'advjs-roundtrip-'))
    temporaryRoots.push(root)
    for (const [path, content] of Object.entries(result.files)) {
      const filename = join(root, path)
      await mkdir(dirname(filename), { recursive: true })
      await writeFile(filename, content)
    }
    const node = await loadProject({ root })

    expect(node.result).toEqual(browser)
  })

  it('rejects structured edits outside the documented allowlist', () => {
    expect(() => applyProjectPatches(originalFiles, [
      { kind: 'json-set', path: 'adv.config.json', key: 'futureConfig', value: false },
    ])).toThrow(/structured patch is not allowed/u)
    expect(() => applyProjectPatches(originalFiles, [
      { kind: 'raw-text', path: 'adv.config.json', content: '{}' },
    ])).toThrow(/raw-text/u)
  })
})
