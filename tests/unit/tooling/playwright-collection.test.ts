// @vitest-environment node

import { execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { expect, it } from 'vitest'

const execFileAsync = promisify(execFile)
const require = createRequire(import.meta.url)

it('collects every browser suite through native ESM without excluding editor imports', async () => {
  const { stdout, stderr } = await execFileAsync(process.execPath, [
    require.resolve('@playwright/test/cli'),
    'test',
    '--list',
    '--reporter=list',
  ], { cwd: resolve(import.meta.dirname, '../../..'), timeout: 30_000, maxBuffer: 4 * 1024 * 1024 })
  expect(stderr).not.toContain('needs an import attribute')
  expect(stdout).toContain('new-game.spec.ts')
  expect(stdout).toContain('editor-local.spec.ts')
  expect(stdout).toContain('editor-security.spec.ts')
  expect(stdout).toContain('editor-character-migration.spec.ts')
  expect(stdout).toMatch(/Total: [1-9]\d* tests in [1-9]\d* files/u)
}, 35_000)
