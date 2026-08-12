// @vitest-environment node

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { editorBuildContract } from '../../editor/core/build-contract'

const root = resolve(import.meta.dirname, '../..')

describe('editor build contract', () => {
  it('pins reusable static and server artifacts', async () => {
    const packageJson = JSON.parse(await readFile(resolve(root, 'editor/core/package.json'), 'utf8'))
    const nuxtConfig = await readFile(resolve(root, 'editor/core/nuxt.config.ts'), 'utf8')

    expect(editorBuildContract).toEqual({
      outputDirectory: '.output',
      publicDirectory: '.output/public',
      serverDirectory: '.output/server',
      serverEntry: '.output/server/index.mjs',
      packagePublicDirectory: 'dist',
      packageServerEntry: 'bin/adv-editor.mjs',
      preset: 'node-server',
    })
    expect(packageJson.advjsEditor?.artifacts).toEqual(editorBuildContract)
    expect(packageJson.scripts.start).toBe(`node ${editorBuildContract.serverEntry}`)
    expect(packageJson.scripts['start:package']).toBe(`node ${editorBuildContract.packageServerEntry}`)
    expect(packageJson.scripts['start:generate']).toContain(editorBuildContract.publicDirectory)
    expect(nuxtConfig).toContain('import { editorBuildContract } from \'./build-contract\'')
    expect(nuxtConfig).toContain('preset: editorBuildContract.preset')
    expect(nuxtConfig).toContain('publicDir: editorBuildContract.publicDirectory')
  })
})
