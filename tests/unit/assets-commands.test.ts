import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  acceptAssetGenerationCandidate,
  ingestAssetGenerationCandidate,
  planBackgroundAssetGeneration,
  rejectAssetGenerationCandidate,
} from '../../packages/advjs/node/commands/assets'

const roots: string[] = []

function makeVp8x(width: number, height: number) {
  const bytes = Buffer.alloc(30)
  bytes.write('RIFF', 0, 'ascii')
  bytes.writeUInt32LE(22, 4)
  bytes.write('WEBP', 8, 'ascii')
  bytes.write('VP8X', 12, 'ascii')
  bytes.writeUInt32LE(10, 16)
  bytes.writeUIntLE(width - 1, 24, 3)
  bytes.writeUIntLE(height - 1, 27, 3)
  return bytes
}

async function project() {
  const root = await mkdtemp(join(tmpdir(), 'advjs-assets-'))
  roots.push(root)
  await mkdir(join(root, 'adv/scenes'), { recursive: true })
  await writeFile(join(root, 'adv.config.json'), JSON.stringify({ id: 'asset-test', format: 'adv-md', root: './adv' }))
  await writeFile(join(root, 'adv/scenes/library.md'), [
    '---',
    'id: library',
    'name: Library',
    'imagePrompt: A quiet library at dusk, no people, 16:9',
    '---',
    '',
    'Keep this body.',
    '',
  ].join('\n'))
  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('asset authoring commands', () => {
  it('plans, ingests, explicitly accepts, registers, and binds a background', async () => {
    const root = await project()
    const planned = await planBackgroundAssetGeneration({
      root,
      sceneId: 'library',
      taskId: 'library-task',
      now: '2026-08-13T08:00:00.000Z',
    })
    const candidatePath = `${planned.candidateDirectory}/candidate-1.webp`
    await writeFile(join(root, candidatePath), makeVp8x(1536, 864))
    const ingested = await ingestAssetGenerationCandidate({
      root,
      taskId: planned.task.id,
      candidatePath,
      executor: { id: 'codex-imagegen', model: 'imagegen-built-in' },
      now: '2026-08-13T08:01:00.000Z',
    })
    const accepted = await acceptAssetGenerationCandidate({
      root,
      taskId: planned.task.id,
      candidateId: ingested.candidate!.id,
      now: '2026-08-13T08:02:00.000Z',
    })

    const scene = await readFile(join(root, 'adv/scenes/library.md'), 'utf8')
    const manifest = JSON.parse(await readFile(join(root, 'adv/assets.json'), 'utf8'))
    const fragment = JSON.parse(await readFile(join(root, 'adv/assets/backgrounds.json'), 'utf8'))
    expect(accepted.task.status).toBe('registered')
    expect(scene).toContain('assetId: "background/library"')
    expect(scene).toContain('Keep this body.')
    expect(manifest.includes).toEqual(['assets/backgrounds.json'])
    expect(fragment.assets[0]).toMatchObject({
      id: 'background/library',
      path: expect.stringMatching(/^backgrounds\/library\.[a-f0-9]{12}\.webp$/u),
    })
    await expect(readFile(join(root, accepted.receipt.registration.receiptPath), 'utf8')).resolves.toContain('codex-imagegen')
    await expect(readFile(join(root, '.gitignore'), 'utf8')).resolves.toContain('.adv/generated/')
  })

  it('records rejection without creating formal assets or a manifest', async () => {
    const root = await project()
    const planned = await planBackgroundAssetGeneration({
      root,
      sceneId: 'library',
      taskId: 'rejected-task',
      now: '2026-08-13T08:00:00.000Z',
    })
    const candidatePath = `${planned.candidateDirectory}/bad.webp`
    await writeFile(join(root, candidatePath), makeVp8x(1024, 1024))
    const ingested = await ingestAssetGenerationCandidate({
      root,
      taskId: planned.task.id,
      candidatePath,
      executor: { id: 'codex-imagegen' },
      now: '2026-08-13T08:01:00.000Z',
    })
    const rejected = await rejectAssetGenerationCandidate({
      root,
      taskId: planned.task.id,
      candidateId: ingested.candidate!.id,
      reason: 'Composition does not leave room for dialogue UI',
      now: '2026-08-13T08:02:00.000Z',
    })

    expect(rejected.task.status).toBe('reviewed')
    await expect(readFile(join(root, 'adv/assets.json'))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(readFile(join(root, 'adv/generations/rejected-task.json'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('refuses to create generated files through an escaping symbolic link', async () => {
    const root = await project()
    const outside = await mkdtemp(join(tmpdir(), 'advjs-assets-outside-'))
    roots.push(outside)
    await symlink(outside, join(root, '.adv'), 'dir')

    await expect(planBackgroundAssetGeneration({
      root,
      sceneId: 'library',
      taskId: 'unsafe-task',
      now: '2026-08-13T08:00:00.000Z',
    })).rejects.toThrow('Project write parent escapes the project root')
    await expect(readdir(outside)).resolves.toEqual([])
  })
})
