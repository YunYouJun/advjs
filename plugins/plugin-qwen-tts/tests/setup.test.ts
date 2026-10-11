// @vitest-environment node
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ execute: vi.fn() }))
vi.mock('../src/runtime', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/runtime')>()
  return { ...original, executeCommand: mocks.execute }
})

const { createQwenTtsProvider } = await import('../src/index')
const platform = Object.getOwnPropertyDescriptor(process, 'platform')!
const architecture = Object.getOwnPropertyDescriptor(process, 'arch')!
const requirements = fileURLToPath(new URL('../python/requirements.txt', import.meta.url))
const versions = { 'mlx-audio': '0.5.8', 'mlx': '0.32.3', 'transformers': '5.19.0', 'numpy': '2.5.3' }
let root: string
let stamp: string
let python: string
let requirementsHash: string

beforeEach(async () => {
  Object.defineProperty(process, 'platform', { value: 'darwin' })
  Object.defineProperty(process, 'arch', { value: 'arm64' })
  mocks.execute.mockReset()
  root = await realpath(await mkdtemp(join(tmpdir(), 'advjs-qwen-setup-')))
  stamp = join(root, '.advjs/voice/requirements.sha256')
  python = join(root, '.advjs/voice/.venv/bin/python')
  requirementsHash = createHash('sha256').update(await readFile(requirements)).digest('hex')
})

afterEach(async () => {
  Object.defineProperty(process, 'platform', platform)
  Object.defineProperty(process, 'arch', architecture)
  await rm(root, { recursive: true, force: true })
})

async function stampedEnvironment() {
  await mkdir(join(python, '..'), { recursive: true })
  await writeFile(python, '')
  await writeFile(stamp, requirementsHash)
}

describe('explicit Qwen environment repair', () => {
  it('reuses a healthy pinned runtime without installing or changing the model cache', async () => {
    await stampedEnvironment()
    const cache = join(root, '.advjs/voice/huggingface/hub')
    await mkdir(cache, { recursive: true })
    await writeFile(join(cache, 'cached-evidence'), 'immutable model evidence')
    mocks.execute.mockResolvedValue(JSON.stringify(versions))
    expect(await createQwenTtsProvider().setup({ root })).toMatchObject({ ready: true })
    expect(mocks.execute.mock.calls).toHaveLength(1)
    expect(mocks.execute.mock.calls[0]![0]).toBe(python)
    expect(await readFile(stamp, 'utf8')).toBe(requirementsHash)
    expect(await readFile(join(cache, 'cached-evidence'), 'utf8')).toBe('immutable model evidence')
  })

  it.each(['missing package', 'incorrect version'])('diagnoses %s read-only, then repairs it only after explicit setup', async (problem) => {
    await stampedEnvironment()
    let repaired = false
    mocks.execute.mockImplementation(async (command: string, args: string[]) => {
      if (command === 'uv') {
        if (args[0] === '--version')
          return 'uv test'
        expect(await readFile(stamp, 'utf8').catch(() => null)).toBeNull()
        repaired = true
        return ''
      }
      if (!repaired && problem === 'missing package')
        throw new Error('Missing runtime package')
      return JSON.stringify(repaired ? versions : { ...versions, mlx: 'incorrect' })
    })
    const provider = createQwenTtsProvider()
    expect((await provider.doctor({ root })).ready).toBe(false)
    expect(repaired).toBe(false)
    expect(await readFile(stamp, 'utf8')).toBe(requirementsHash)
    expect(await provider.setup({ root })).toMatchObject({ ready: true })
    expect(mocks.execute.mock.calls.filter(([command, args]) => command === 'uv' && args[0] === 'pip')).toHaveLength(1)
    expect(mocks.execute.mock.calls.some(([command, args]) => command === 'uv' && args[0] === 'venv')).toBe(false)
    expect(await readFile(stamp, 'utf8')).toBe(requirementsHash)
    expect((await provider.doctor({ root })).ready).toBe(true)
  })

  it('creates a cold environment and stamps it only after checking installed versions', async () => {
    mocks.execute.mockImplementation(async (command: string, args: string[]) => {
      if (command === 'uv' && args[0] === 'venv') {
        await mkdir(join(python, '..'), { recursive: true })
        await writeFile(python, '')
      }
      if (command === python) {
        expect(await readFile(stamp, 'utf8').catch(() => null)).toBeNull()
        return JSON.stringify(versions)
      }
      return ''
    })
    expect(await createQwenTtsProvider().setup({ root })).toMatchObject({ ready: true })
    expect(mocks.execute.mock.calls.map(([command, args]) => command === 'uv' ? args.slice(0, 2) : ['verify'])).toEqual([['venv', '--python'], ['pip', 'install'], ['verify']])
    expect(await readFile(stamp, 'utf8')).toBe(requirementsHash)
    expect(await readdir(join(root, '.advjs/voice'))).not.toContain('huggingface')
  })

  it('fails closed and removes a stale ready stamp when installation leaves incorrect versions', async () => {
    await stampedEnvironment()
    mocks.execute.mockImplementation(async (command: string) => command === 'uv' ? '' : JSON.stringify({ ...versions, numpy: 'incorrect' }))
    await expect(createQwenTtsProvider().setup({ root })).rejects.toThrow('VOICE_ENVIRONMENT_NOT_READY')
    expect(await readFile(stamp, 'utf8').catch(() => null)).toBeNull()
    expect(mocks.execute.mock.calls.filter(([command]) => command === python)).toHaveLength(2)
  })

  it.each(['failed', 'cancelled'])('keeps the ready stamp absent after a %s installation', async (outcome) => {
    await stampedEnvironment()
    const controller = new AbortController()
    mocks.execute.mockImplementation(async (command: string) => {
      if (command === 'uv') {
        if (outcome === 'failed')
          throw new Error('Failed repair')
        controller.abort(new Error('Cancelled repair'))
        return ''
      }
      throw new Error('Missing runtime package')
    })
    await expect(createQwenTtsProvider().setup({ root, signal: controller.signal })).rejects.toThrow(outcome === 'failed' ? 'Failed repair' : 'Cancelled repair')
    expect(await readFile(stamp, 'utf8').catch(() => null)).toBeNull()
  })
})
