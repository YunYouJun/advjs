// @vitest-environment node

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { runCheck } from '../../packages/advjs/node/commands/check'
import { validateSceneFrontmatter } from '../../packages/parser/src/scene'

describe('validateSceneFrontmatter', () => {
  it('accepts a well-formed scene', () => {
    const md = `---
id: classroom
name: 教室
imagePrompt: anime classroom, afternoon light
tags:
  - 内景
  - 学校
---

# 教室
`
    expect(validateSceneFrontmatter(md)).toEqual({ success: true })
  })

  it('rejects an invalid type enum (typo)', () => {
    const md = `---
id: bg
type: img
---
`
    const res = validateSceneFrontmatter(md)
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/type/)
  })

  it('rejects a missing id', () => {
    const md = `---
name: 无名场景
---
`
    const res = validateSceneFrontmatter(md)
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/id/)
  })

  it('rejects tags given as a string instead of an array', () => {
    const md = `---
id: x
tags: 学校
---
`
    expect(validateSceneFrontmatter(md).success).toBe(false)
  })

  it('treats a file without frontmatter as missing id', () => {
    expect(validateSceneFrontmatter('# just a heading\n').success).toBe(false)
  })
})

describe('adv check — scene frontmatter integration', () => {
  function makeProject(sceneFile: string, sceneContent: string): string {
    const root = mkdtempSync(join(tmpdir(), 'advjs-scene-fm-'))
    const adv = join(root, 'adv')
    mkdirSync(join(adv, 'chapters'), { recursive: true })
    mkdirSync(join(adv, 'scenes'), { recursive: true })
    // A minimal chapter that references the scene so refs resolve.
    writeFileSync(join(adv, 'chapters', '01.adv.md'), `---\nplotSummary: t\n---\n\n【房间，白天，内景】\n\n（旁白。）\n`, 'utf-8')
    writeFileSync(join(adv, 'scenes', sceneFile), sceneContent, 'utf-8')
    return root
  }

  it('flags a malformed scene with a scene-frontmatter warning', async () => {
    const root = makeProject('room.md', `---\nid: 房间\nname: 房间\ntype: img\n---\n`)
    try {
      const result = await runCheck({ root: join(root, 'adv'), cwd: root })
      const fm = result.issues.filter(i => i.category === 'scene-frontmatter')
      expect(fm.length).toBe(1)
      expect(fm[0].message).toMatch(/type/)
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('passes a well-formed scene', async () => {
    const root = makeProject('room.md', `---\nid: 房间\nname: 房间\nimagePrompt: a room\n---\n`)
    try {
      const result = await runCheck({ root: join(root, 'adv'), cwd: root })
      expect(result.issues.filter(i => i.category === 'scene-frontmatter')).toEqual([])
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
