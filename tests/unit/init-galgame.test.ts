// @vitest-environment node

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runCheck } from '../../packages/advjs/node/commands/check'
import { advInit, AVAILABLE_TEMPLATES } from '../../packages/advjs/node/commands/init'

// The galgame template is a real, shippable project: initializing it must
// produce a structure that passes `adv check`. This guards against template
// rot (a broken character/scene ref slipping into the bundled template).

describe('adv init --template galgame', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'advjs-init-galgame-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('lists galgame among available templates', () => {
    expect(AVAILABLE_TEMPLATES).toContain('default')
    expect(AVAILABLE_TEMPLATES).toContain('galgame')
  })

  it('scaffolds a project that passes adv check', async () => {
    await advInit({ root: dir, template: 'galgame', name: '樱丘之恋' })

    // Core files exist
    expect(existsSync(join(dir, 'adv.config.json'))).toBe(true)
    expect(existsSync(join(dir, 'adv', 'world.md'))).toBe(true)
    expect(existsSync(join(dir, 'adv', 'characters', 'kokone.character.md'))).toBe(true)

    // --name placeholder was applied
    expect(readFileSync(join(dir, 'adv', 'world.md'), 'utf-8')).toContain('樱丘之恋')

    // Structurally valid — no syntax/character/scene issues
    const result = await runCheck({ root: join(dir, 'adv'), cwd: dir })
    expect(result.passed).toBe(true)
    expect(result.issues).toEqual([])
  })

  it('rejects an unknown template name', async () => {
    await expect(advInit({ root: dir, template: 'nope' })).rejects.toThrow(/Unknown template/)
  })
})
