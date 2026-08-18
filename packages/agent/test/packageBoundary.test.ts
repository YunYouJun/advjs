import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const packageRoot = resolve(import.meta.dirname, '..')

describe('@advjs/agent package boundary', () => {
  it('remains a private workspace package with explicit BYOK access', async () => {
    const packageJson = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'))

    expect(packageJson.private).toBe(true)
    expect(packageJson.publishConfig).toBeUndefined()
    expect(packageJson.exports['./byok-dev']).toBeDefined()
  })
})
