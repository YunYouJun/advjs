// @vitest-environment node

import type { UserConfig } from 'vite'
import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import createStudioViteConfig from '../../apps/studio/vite.config'

async function resolveStudioConfig(): Promise<UserConfig> {
  return await createStudioViteConfig()
}

describe('studio Vite config', () => {
  it('uses the client embed entry for exact top-level imports', async () => {
    const config = await resolveStudioConfig()
    const aliases = config.resolve?.alias

    expect(aliases).toBeInstanceOf(Array)
    if (!Array.isArray(aliases))
      return

    const clientAlias = aliases.find(alias => (
      typeof alias === 'object'
      && alias.find instanceof RegExp
      && alias.find.test('@advjs/client')
      && !alias.find.test('@advjs/client/runtime')
    ))

    expect(clientAlias).toBeDefined()
    expect(clientAlias && existsSync(clientAlias.replacement)).toBe(true)
  })
})
