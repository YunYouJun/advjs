// @vitest-environment node
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getRoots } from '../../../packages/advjs/node/resolver'
import { defaultAdvConfig } from '../../../packages/advjs/shared'

describe('project build root isolation', () => {
  it('resolves each project, content root and theme independently in one process', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'advjs-project-roots-'))
    const firstRoot = join(directory, 'first')
    const secondRoot = join(directory, 'second')
    try {
      await mkdir(firstRoot)
      await mkdir(secondRoot)
      const first = await getRoots({ userRoot: firstRoot, theme: '@advjs/theme-default' }, { ...defaultAdvConfig, root: 'adv' })
      const second = await getRoots({ userRoot: secondRoot, theme: '@advjs/theme-default' }, { ...defaultAdvConfig, root: 'stories' })
      expect(second.userRoot).toBe(secondRoot)
      expect(second.gameRoot).toBe(join(secondRoot, 'stories'))
      expect(second.tempRoot).toBe(join(secondRoot, '.adv'))
      expect(first.userRoot).toBe(firstRoot)
      expect(first.gameRoot).toBe(join(firstRoot, 'adv'))
      expect(first).not.toBe(second)
      const changed = await getRoots({ userRoot: firstRoot, theme: '@advjs/theme-starter' }, { ...defaultAdvConfig, root: 'episodes' })
      expect(changed.gameRoot).toBe(join(firstRoot, 'episodes'))
      expect(changed.themeRoot).toContain('theme-starter')
      expect(changed.themeRoot).not.toBe(first.themeRoot)
    }
    finally { await rm(directory, { recursive: true, force: true }) }
  })
})
