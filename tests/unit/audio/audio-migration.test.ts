// @vitest-environment node

import type { AdvAst } from '@advjs/types'
import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { parseAst } from '@advjs/parser'
import { join } from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyAudioMigration, planAudioMigration, readAudioMigrationInput, recoverAudioMigration, writeAudioMigrationReport } from '../../../packages/advjs/node/commands/migrate-audio'

const roots: string[] = []
const original = '## Intro\n\n```yaml\n# Explicit old music\ntype: bgm\nname: calm\nloop: true\nfade:\n  in: 500\n  out: 200\n```\n\n@hero\n你好。\n'
const mapping = { 'calm': 'bgm/calm', 'https://old.invalid/song.wav': 'bgm/calm' }

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'advjs-audio-migration-'))
  roots.push(root)
  await mkdir(join(root, 'adv/chapters'), { recursive: true })
  await writeFile(join(root, 'adv/assets.json'), JSON.stringify({ schemaVersion: 2, id: 'migration', defaultProfile: 'local', profiles: { local: { provider: 'project' } }, assets: [
    { id: 'bgm/calm', type: 'audio', kind: 'bgm', url: 'https://registered.invalid/calm.ogg' },
    { id: 'sfx/door', type: 'audio', kind: 'sfx', path: 'audio/door.ogg' },
  ] }))
  await writeFile(join(root, 'adv/chapters/a.adv.md'), original)
  return root
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('reviewable native audio migration', () => {
  it('defaults to a read-only deterministic plan and never guesses or fetches media', async () => {
    const root = await fixture()
    const fetch = vi.spyOn(globalThis, 'fetch')
    const missing = await planAudioMigration({ root })
    expect(missing.unresolved).toContainEqual(expect.objectContaining({ code: 'ADV_AUDIO_MIGRATION_UNRESOLVED' }))
    await expect(readFile(join(root, '.advjs/catalog-write.lock'))).rejects.toThrow()
    expect(await readFile(join(root, 'adv/chapters/a.adv.md'), 'utf8')).toBe(original)
    const planned = await planAudioMigration({ root, mapping })
    expect(planned).toEqual(await planAudioMigration({ root, mapping }))
    expect(planned.unresolved).toEqual([])
    expect(planned.sources[0]).toMatchObject({ path: 'adv/chapters/a.adv.md', bytes: Buffer.byteLength(original), sha256: expect.stringMatching(/^[a-f0-9]{64}$/u) })
    expect(planned.patches[0].operations).toEqual([{ line: 3, action: 'set', reference: 'calm', assetId: 'bgm/calm' }])
    expect(planned.snapshots).toBe('unsupported')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('requires a registered audio resource of the correct purpose', async () => {
    const root = await fixture()
    for (const assetId of ['missing', 'sfx/door']) {
      const report = await planAudioMigration({ root, mapping: { calm: assetId } })
      expect(report.unresolved).not.toEqual([])
      await expect(applyAudioMigration({ root, report })).rejects.toThrow(/no unresolved/u)
    }
  })

  it('preserves canonical options and the surrounding source while applying a reviewed plan', async () => {
    const root = await fixture()
    const report = await planAudioMigration({ root, mapping })
    const result = await applyAudioMigration({ root, report })
    expect(result.applied).toEqual(['adv/chapters/a.adv.md'])
    const updated = await readFile(join(root, result.applied[0]), 'utf8')
    expect(updated).toContain('@hero\n你好。')
    const ast = await parseAst(updated)
    expect((ast.children.find(node => node.type === 'code') as AdvAst.Code).value).toEqual([{ type: 'bgm', action: 'set', asset: 'bgm/calm', loop: true, fade: { in: 500, out: 200 } }])
    expect(JSON.parse(await readFile(join(root, result.journalPath), 'utf8'))).toMatchObject({ status: 'applied', revision: report.revision, files: [{ original }] })
    await expect(recoverAudioMigration({ root, revision: report.revision })).rejects.toThrow(/already applied/u)
  })

  it('migrates explicit stop and src without treating a URL as a new asset ID', async () => {
    const root = await fixture()
    await writeFile(join(root, 'adv/chapters/a.adv.md'), '```yaml\n- type: bgm\n  src: https://old.invalid/song.wav\n- type: bgm\n  stop: true\n  fade:\n    in: 700\n    out: 300\n```')
    const report = await planAudioMigration({ root, mapping })
    expect(report.unresolved).toEqual([])
    const ast = await parseAst(report.patches[0].content)
    expect((ast.children[0] as AdvAst.Code).value).toEqual([{ type: 'bgm', action: 'set', asset: 'bgm/calm' }, { type: 'bgm', action: 'clear', fade: { out: 300 } }])
  })

  it('keeps nested choice fences valid after their declarative operation is normalized', async () => {
    const root = await fixture()
    await writeFile(join(root, 'adv/chapters/a.adv.md'), '- Continue\n\n  ```yaml\n  type: bgm\n  name: calm\n  ```\n')
    const report = await planAudioMigration({ root, mapping })
    const ast = await parseAst(report.patches[0].content)
    expect((ast.children[0] as AdvAst.Choices).choices[0].do?.value).toEqual([{ type: 'bgm', action: 'set', asset: 'bgm/calm' }])
  })

  it.each(['source', 'catalog'] as const)('blocks stale %s state before any project source is changed', async (kind) => {
    const root = await fixture()
    const report = await planAudioMigration({ root, mapping })
    if (kind === 'source')
      await writeFile(join(root, 'adv/chapters/a.adv.md'), `${original}\nAn external edit.\n`)
    else
      await writeFile(join(root, 'adv/assets.json'), (await readFile(join(root, 'adv/assets.json'), 'utf8')).replace('calm.ogg', 'reviewed-again.ogg'))
    await expect(applyAudioMigration({ root, report })).rejects.toThrow(/changed after review/u)
    expect(await readFile(join(root, 'adv/chapters/a.adv.md'), 'utf8')).toContain('name: calm')
  })

  it('rejects modified reports and cannot apply a report against a different project', async () => {
    const root = await fixture()
    const report = await planAudioMigration({ root, mapping })
    const changed = structuredClone(report)
    changed.patches[0].content += '\nUnreviewed changes.\n'
    await expect(applyAudioMigration({ root, report: changed })).rejects.toThrow(/modified after planning/u)
    await expect(applyAudioMigration({ root: await fixture(), report })).rejects.toThrow(/for this project/u)
  })

  it('rolls back an interrupted multi-file commit from its durable journal', async () => {
    const root = await fixture()
    await writeFile(join(root, 'adv/chapters/b.adv.md'), original)
    const report = await planAudioMigration({ root, mapping })
    const controller = new AbortController()
    await expect(applyAudioMigration({ root, report, signal: controller.signal, onProgress: () => controller.abort(new Error('Interrupted')) })).rejects.toThrow('Interrupted')
    expect(await readFile(join(root, 'adv/chapters/a.adv.md'), 'utf8')).toBe(original)
    expect(await readFile(join(root, 'adv/chapters/b.adv.md'), 'utf8')).toBe(original)
    expect(JSON.parse(await readFile(join(root, `.advjs/audio-migrations/${report.revision}/journal.json`), 'utf8')).status).toBe('rolled-back')
    expect(await recoverAudioMigration({ root, revision: report.revision })).toEqual({ revision: report.revision, recovered: [] })
  })

  it('preserves external edits during rollback and explicit recovery', async () => {
    const root = await fixture()
    await writeFile(join(root, 'adv/chapters/b.adv.md'), original)
    const report = await planAudioMigration({ root, mapping })
    const controller = new AbortController()
    await expect(applyAudioMigration({ root, report, signal: controller.signal, onProgress: () => {
      controller.abort(new Error('Interrupted'))
      throw new Error('Interrupted')
    } })).rejects.toThrow('Interrupted')
    // Simulate an OS crash after one source was renamed, before status finalization.
    const path = join(root, `.advjs/audio-migrations/${report.revision}/journal.json`)
    const journal = JSON.parse(await readFile(path, 'utf8'))
    journal.status = 'prepared'
    await writeFile(path, JSON.stringify(journal))
    await writeFile(join(root, 'adv/chapters/a.adv.md'), 'An external editor change.')
    await expect(recoverAudioMigration({ root, revision: report.revision })).rejects.toThrow(/external edits/u)
    expect(await readFile(join(root, 'adv/chapters/a.adv.md'), 'utf8')).toBe('An external editor change.')
    await writeFile(join(root, 'adv/chapters/a.adv.md'), report.patches[0].content)
    await recoverAudioMigration({ root, revision: report.revision })
    expect(await readFile(join(root, 'adv/chapters/a.adv.md'), 'utf8')).toBe(original)
  })

  it('refuses symlink scripts and catalog fragments outside the project', async () => {
    const root = await fixture()
    await symlink(join(root, 'adv/chapters/a.adv.md'), join(root, 'adv/chapters/link.adv.md'))
    expect((await planAudioMigration({ root, mapping })).unresolved).toContainEqual(expect.objectContaining({ code: 'ADV_AUDIO_MIGRATION_UNSAFE_PATH' }))
    await writeFile(join(root, 'adv/assets.json'), JSON.stringify({ schemaVersion: 2, id: 'test', includes: ['../../escape.json'] }))
    await expect(planAudioMigration({ root, mapping })).rejects.toThrow(/relative|inside|escapes/u)
  })

  it('saves review artifacts only to new project-local paths and reads them safely', async () => {
    const root = await fixture()
    const report = await planAudioMigration({ root, mapping })
    await writeAudioMigrationReport(root, '.advjs/reviews/audio.json', report)
    expect(await readAudioMigrationInput(root, '.advjs/reviews/audio.json')).toEqual(report)
    await expect(writeAudioMigrationReport(root, '.advjs/reviews/audio.json', report)).rejects.toThrow(/already exists/u)
    await expect(writeAudioMigrationReport(root, '../escape.json', report)).rejects.toThrow(/relative/u)
  })
})
