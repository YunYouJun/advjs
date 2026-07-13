import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

interface PackageManifest {
  dependencies?: Record<string, string>
}

describe('@advjs/core package', () => {
  it('declares dayjs as a runtime dependency', async () => {
    const manifestPath = path.resolve(import.meta.dirname, '../package.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as PackageManifest

    expect(manifest.dependencies?.dayjs).toBeDefined()
  })
})
