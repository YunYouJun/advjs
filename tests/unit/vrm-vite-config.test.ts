// @vitest-environment node

import type { ConfigEnv, UserConfig } from 'vite'
import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import createVrmViteConfig from '../../editor/vrm/vite.config'

const buildEnv: ConfigEnv = {
  command: 'build',
  mode: 'production',
  isSsrBuild: false,
  isPreview: false,
}

async function resolveVrmConfig(): Promise<UserConfig> {
  if (typeof createVrmViteConfig !== 'function')
    return createVrmViteConfig
  return await createVrmViteConfig(buildEnv)
}

describe('vrm Vite config', () => {
  it('keeps shared aliases in Vite array form', async () => {
    const config = await resolveVrmConfig()

    expect(config.resolve?.alias).toBeInstanceOf(Array)
    expect(config.resolve?.alias).toEqual(expect.arrayContaining([
      expect.objectContaining({ find: 'advjs', replacement: expect.any(String) }),
    ]))
  })

  it('uses a Rolldown-compatible manual chunk function', async () => {
    const config = await resolveVrmConfig()
    const output = config.build?.rollupOptions?.output
    if (!output || Array.isArray(output))
      throw new TypeError('Expected a single VRM output configuration')

    expect(output.manualChunks).toBeTypeOf('function')
    if (typeof output.manualChunks !== 'function')
      return

    expect(output.manualChunks('/repo/node_modules/@babylonjs/core/index.js', {} as never))
      .toBe('babylonjs-core')
  })

  it('resolves workspace plugin aliases to existing directories', async () => {
    const config = await resolveVrmConfig()
    const aliases = config.resolve?.alias
    if (!Array.isArray(aliases))
      throw new TypeError('Expected VRM aliases in array form')

    const pluginAlias = aliases.find(alias => (
      typeof alias === 'object'
      && alias.find === '@advjs/plugin-babylon'
    ))

    expect(pluginAlias).toBeDefined()
    expect(pluginAlias && existsSync(pluginAlias.replacement)).toBe(true)
  })
})
