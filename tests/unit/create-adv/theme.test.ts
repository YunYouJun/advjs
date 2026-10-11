// @vitest-environment node

import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { execa } from 'execa'
import prompts from 'prompts'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { init } from '../../../packages/create-adv/src/cli'
import { THEME_HELPER } from '../../../packages/create-adv/src/theme'

vi.mock('execa', () => ({ execa: vi.fn() }))
vi.mock('prompts', () => ({ default: vi.fn() }))

let root = ''
let target = ''
let originalArgv: string[]

beforeEach(async () => {
  vi.clearAllMocks()
  root = await mkdtemp(join(tmpdir(), 'create-adv-theme-'))
  target = join(root, 'theme')
  originalArgv = process.argv
  process.argv = [process.execPath, 'create-adv', target, '--template', 'theme']
})

afterEach(async () => {
  process.argv = originalArgv
  await rm(root, { recursive: true, force: true })
})

describe('remote theme approval', () => {
  it('defaults to no and leaves a nonempty target untouched when declined', async () => {
    await mkdir(target)
    await writeFile(join(target, 'keep.txt'), 'keep')
    vi.mocked(prompts).mockResolvedValueOnce({ download: false })
    await expect(init()).rejects.toThrow('Operation cancelled')
    expect(prompts).toHaveBeenCalledTimes(1)
    expect(prompts).toHaveBeenCalledWith(expect.objectContaining({
      name: 'download',
      initial: false,
      message: expect.stringContaining(THEME_HELPER),
    }), expect.any(Object))
    expect(await readFile(join(target, 'keep.txt'), 'utf8')).toBe('keep')
    expect(execa).not.toHaveBeenCalled()
  })

  it('treats a dismissed approval as cancellation without creating the target', async () => {
    vi.mocked(prompts).mockResolvedValueOnce({})
    await expect(init()).rejects.toThrow('Operation cancelled')
    expect(existsSync(target)).toBe(false)
    expect(execa).not.toHaveBeenCalled()
  })

  it('executes only the pinned helper after explicit approval', async () => {
    vi.mocked(prompts)
      .mockResolvedValueOnce({ download: true })
      .mockResolvedValueOnce({ install: false })
    await init()
    expect(execa).toHaveBeenCalledExactlyOnceWith('npx', [
      '--yes',
      THEME_HELPER,
      'https://github.com/advjs/advjs-theme-starter',
      target,
    ], { stdio: 'inherit' })
  })
})
