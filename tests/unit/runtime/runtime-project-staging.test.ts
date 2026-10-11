// @vitest-environment node

import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStudioVoiceService } from '../../../packages/advjs/node/audio/server'
import { loadProject } from '../../../packages/advjs/node/project'
import { createEditorVoiceJobsFixture } from '../../fixtures/audio/editor-voice-jobs'

const listing = vi.hoisted(() => ({ afterRead: undefined as undefined | ((path: string) => Promise<void>) }))
vi.mock('node:fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...original,
    readdir: async (...args: Parameters<typeof original.readdir>) => {
      const entries = await original.readdir(...args)
      await listing.afterRead?.(String(args[0]))
      return entries
    },
  }
})

describe('project discovery during atomic authoring writes', () => {
  let directory: string | undefined
  afterEach(async () => {
    listing.afterRead = undefined
    if (directory)
      await rm(directory, { recursive: true, force: true })
  })

  async function fixture() {
    directory = await mkdtemp(join(tmpdir(), 'advjs-project-staging-'))
    await mkdir(join(directory, 'adv', 'chapters'), { recursive: true })
    await writeFile(join(directory, 'adv.config.json'), '{"root":"adv"}')
    await writeFile(join(directory, 'adv', 'chapters', 'intro.adv.md'), '当前对白。\n')
    return directory
  }

  it.each([
    'assets.json.4b557112-7b83-46a7-bc4b-edca01f8a883.tmp',
    '.advjs-write-4b557112-7b83-46a7-bc4b-edca01f8a883',
  ])('does not stat vanished internal staging file %s after an atomic rename', async (name) => {
    const root = await fixture()
    const target = join(root, 'adv', 'author-metadata.json')
    const staging = join(dirname(target), name)
    await writeFile(staging, '{"future":"preserved"}')
    let interleaved = false
    listing.afterRead = async (path) => {
      if (path === dirname(staging) && !interleaved) {
        interleaved = true
        await rename(staging, target)
      }
    }
    const loaded = await loadProject({ root })
    expect(interleaved).toBe(true)
    expect(loaded.filePaths).not.toContain(`adv/${basename(staging)}`)
    expect(loaded.result.project.program?.chapters.intro).toBeDefined()
    expect(await readFile(target, 'utf8')).toBe('{"future":"preserved"}')
  })

  it('serves real HTTP jobs polling during a concurrent catalog atomic rename', async () => {
    const source = await createEditorVoiceJobsFixture()
    directory = source.directory
    const service = await createStudioVoiceService({
      port: 0,
      stateDirectory: source.storeDirectory,
      allowedOrigins: ['http://localhost:3388'],
      authenticate: async token => token === 'fixture-session' ? { accountId: 'fixture-account' } : undefined,
      projects: [{ accountId: 'fixture-account', projectId: 'fixture-project', root: source.root, config: source.config }],
    })
    try {
      const { url } = await service.start()
      const target = join(source.root, 'adv', 'assets.json')
      const staging = `${target}.4b557112-7b83-46a7-bc4b-edca01f8a883.tmp`
      await writeFile(staging, await readFile(target, 'utf8'))
      let interleaved = false
      listing.afterRead = async (path) => {
        if (path === dirname(staging) && !interleaved) {
          interleaved = true
          await rename(staging, target)
        }
      }
      const response = await fetch(`${url}/v1/audio/projects/fixture-project/jobs`, {
        headers: { authorization: 'Bearer fixture-session', origin: 'http://localhost:3388' },
      })
      const result = await response.json()
      expect(response.status, JSON.stringify(result)).toBe(200)
      expect(interleaved).toBe(true)
      expect(result.jobs).toEqual([])
      expect(source.calls).toEqual([])
    }
    finally {
      await service.stop()
    }
  })

  it('keeps ordinary tmp files and reports a disappearing authored chapter', async () => {
    const root = await fixture()
    const ordinary = ['author.tmp', 'author.json.draft.tmp', '.advjs-write-author-notes.md']
    for (const name of ordinary)
      await writeFile(join(root, 'adv', name), '保留作者文件。')
    const loaded = await loadProject({ root })
    expect(loaded.filePaths).toEqual(expect.arrayContaining(ordinary.map(name => `adv/${name}`)))
    const chapter = join(root, 'adv', 'chapters', 'intro.adv.md')
    listing.afterRead = async (path) => {
      if (path === dirname(chapter))
        await rm(chapter)
    }
    await expect(loadProject({ root })).rejects.toMatchObject({ code: 'ENOENT', path: chapter })
  })
})
