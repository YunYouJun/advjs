import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { applyFixes, runCheck } from '../../packages/advjs/node/commands/check'

describe('check --fix', () => {
  let root: string

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'advjs-fix-'))
    const adv = join(root, 'adv')
    const chapters = join(adv, 'chapters')
    mkdirSync(chapters, { recursive: true })
    // A chapter with an unresolved character ref and scene ref
    writeFileSync(join(chapters, '01.adv.md'), `---
plotSummary: 第一章
---

【神秘房间，深夜，内景】

@未定义角色
你好。
`, 'utf-8')
  })

  afterAll(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('creates character + scene stubs without overwriting existing files', async () => {
    const result = await runCheck({ root: join(root, 'adv'), cwd: root })
    expect(result.passed).toBe(false)

    const summary = await applyFixes(result, join(root, 'adv'), root)
    expect(summary.created.length).toBeGreaterThanOrEqual(2)

    const charStub = join(root, 'adv/characters/未定义角色.character.md')
    const sceneStub = join(root, 'adv/scenes/神秘房间.md')
    expect(existsSync(charStub)).toBe(true)
    expect(existsSync(sceneStub)).toBe(true)

    const charContent = readFileSync(charStub, 'utf-8')
    expect(charContent).toContain('name: 未定义角色')

    // Re-running should skip existing files (idempotent)
    const second = await applyFixes(result, join(root, 'adv'), root)
    expect(second.created.length).toBe(0)
    expect(second.skipped.length).toBeGreaterThanOrEqual(2)
  })
})
