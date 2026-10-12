// @vitest-environment node
import type { AdvAssetEntry } from '@advjs/types'
import type { IFileSystem } from '../../../apps/studio/src/utils/fs'
import type { ProjectWorkspace } from '../../../editor/core/app/workspaces/project'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createMusicMetadata, inspectMusicReview } from '@advjs/audio'
import { describe, expect, it } from 'vitest'
import { createStudioAudioService } from '../../../apps/studio/src/utils/projectAudio'
import { createEditorProjectModel } from '../../../editor/core/app/adapters/browser/project'
import { createEditorAudioService } from '../../../editor/core/app/workspaces/audio'
import { loadProject } from '../../../packages/advjs/node/project'
import { createEditorVoiceDesignFixture } from '../../fixtures/audio/editor-voice-design'

const assetId = 'audio_019d137e-7abc-7000-8000-000000000180'

describe('bound music remains author-reviewable when its current Program is blocked', () => {
  it.each(['Editor', 'Studio'] as const)('%s can read and approve changed usage, source and license before the Program becomes valid again', async (host) => {
    const source = await createEditorVoiceDesignFixture()
    try {
      const music = createMusicMetadata({ usage: 'background', source: { type: 'manual' }, rights: { license: 'original-fixture' } })
      const asset: AdvAssetEntry = { id: assetId, type: 'audio', kind: 'bgm', path: 'recovery.wav', sha256: source.sha256, bytes: source.bytes.length, mimeType: 'audio/wav', duration: 1, license: 'original-fixture', music: { ...music, review: { status: 'approved', sha256: source.sha256, reviewedAt: '2026-10-12T00:00:00.000Z' } } }
      const catalogPath = join(source.root, 'adv/assets.json')
      const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
      catalog.assets.push(asset)
      await writeFile(catalogPath, JSON.stringify(catalog))
      await writeFile(join(source.root, 'public/media/recovery.wav'), source.bytes)
      const chapterPath = join(source.root, 'adv/chapters/intro.adv.md')
      const chapter = `${'```advnode'}\n${JSON.stringify([{ type: 'bgm', action: 'set', asset: assetId }])}\n${'```'}\n\n${await readFile(chapterPath, 'utf8')}`
      await writeFile(chapterPath, chapter)
      const read = () => loadProject({ root: source.root, allowEmptyAssetManifest: true })
      const fs = {
        backend: 'node-fixture',
        async collectAllFiles() {
          return Object.entries((await read()).files).map(([path, content]) => ({ path, content }))
        },
        async exists(path: string) {
          try {
            await readFile(join(source.root, path))
            return true
          }
          catch { return false }
        },
        async readFile(path: string) { return await readFile(join(source.root, path), 'utf8') },
        async readBlob(path: string) { return new Blob([new Uint8Array(await readFile(join(source.root, path)))], { type: 'audio/wav' }) },
        async writeFile(path: string, content: string) { await writeFile(join(source.root, path), content) },
        async deleteFile(path: string) { await rm(join(source.root, path)) },
      } as unknown as IFileSystem
      const workspace: ProjectWorkspace = {
        kind: 'local',
        async commit() { throw new Error('Source-patch commits are not used by this native media fixture') },
        async snapshot() {
          const loaded = await read()
          return { kind: 'local', name: 'music-recovery', root: {} as never, project: createEditorProjectModel(loaded.result, loaded.files) }
        },
        async readDocuments() {
          const loaded = await read()
          return { files: loaded.files, catalog: loaded.result.project.assets }
        },
        async readAsset(path) { return await fs.readBlob(path) },
        async writeFiles(changes) {
          for (const change of changes) {
            const current = await fs.exists(change.path) ? await fs.readFile(change.path) : null
            if (current !== change.expected)
              throw new Error('AUDIO_CONFLICT')
          }
          for (const change of changes) {
            if (change.content === change.expected)
              continue
            if (change.content === null)
              await fs.deleteFile(change.path)
            else
              await fs.writeFile(change.path, change.content)
          }
          return await workspace.snapshot()
        },
        dispose() {},
      }
      const service = host === 'Editor' ? createEditorAudioService(workspace) : createStudioAudioService(fs)
      expect((await read()).result.project.program).toBeDefined()
      for (const change of ['usage', 'source', 'license'] as const) {
        const before = await service.readProjectAudio()
        const current = before.catalog.assets.find(asset => asset.id === assetId)!
        const changed = { ...current.music! }
        if (change === 'usage')
          changed.usage = 'theme'
        else if (change === 'source')
          changed.source = { type: 'external-ai', tool: 'Author-chosen tool', url: 'https://suno.com/song/author-provenance' }
        else
          changed.rights = { ...changed.rights!, license: 'new-project-license' }
        const updated = await service.updateAsset({ expectedRevision: before.revision, assetId, patch: { music: changed, ...(change === 'license' ? { license: changed.rights!.license } : {}) } })
        expect(updated.catalog.assets.find(asset => asset.id === assetId)!.music!.review.status).toBe('pending')
        const blocked = await read()
        expect(blocked.result.project.program).toBeUndefined()
        expect(blocked.result.diagnostics).toContainEqual(expect.objectContaining({ code: 'ADV_AUDIO_MUSIC_REVIEW_REQUIRED', severity: 'error' }))
        // Real host read and commit remain available despite the invalid Program.
        const reviewable = await service.readProjectAudio()
        expect(reviewable.catalog.assets.find(asset => asset.id === assetId)!.sha256).toBe(source.sha256)
        const approved = await service.reviewMusicAsset({ expectedRevision: reviewable.revision, assetId, expectedSha256: source.sha256, status: 'approved' })
        expect(inspectMusicReview(approved.catalog.assets.find(asset => asset.id === assetId)!)).toMatchObject({ status: 'approved', canBind: true })
        const restored = await read()
        expect(restored.result.project.program).toBeDefined()
        expect(restored.result.diagnostics.filter(issue => issue.severity === 'error')).toEqual([])
      }
      expect(await readFile(chapterPath, 'utf8')).toBe(chapter)
      expect(await readFile(join(source.root, 'public/media/recovery.wav'))).toEqual(source.bytes)
      expect(source.calls).toEqual([])
    }
    finally { await rm(source.directory, { recursive: true, force: true }) }
  })
})
