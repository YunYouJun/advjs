import type { AgentProposalCandidate } from '../agent/proposals/candidate'
import type { FsEntry, IFileSystem } from '../utils/fs'
import { describe, expect, it } from 'vitest'
import {
  AgentProposalReviewError,
  AgentProposalReviewService,
  computeAgentProjectRevision,
  createStudioAgentProjectWorkspace,
} from '../agent/proposals/review'

const initialFiles = {
  'adv.config.json': JSON.stringify({ format: 'adv-md', root: 'adv' }),
  'adv/settings/game.json': JSON.stringify({ entryChapterId: 'intro' }),
  'adv/chapters/intro.adv.md': '# Intro {#start}\n\nThe old opening.\n',
  'adv/outline.md': '# Outline\n\nOld outline.\n',
}

class FakeFileSystem implements IFileSystem {
  readonly backend = 'memory' as const
  readonly files: Record<string, string>
  failWriteOnceAt?: string

  constructor(files: Record<string, string>) {
    this.files = { ...files }
  }

  async readFile(path: string): Promise<string> {
    const value = this.files[path]
    if (value === undefined)
      throw new Error(`not found: ${path}`)
    return value
  }

  async writeFile(path: string, content: string): Promise<void> {
    if (this.failWriteOnceAt === path) {
      this.failWriteOnceAt = undefined
      throw new Error(`fixture write failure: ${path}`)
    }
    this.files[path] = content
  }

  async collectAllFiles() {
    return Object.entries(this.files).map(([path, content]) => ({
      path,
      content,
      lastModified: new Date(0),
    }))
  }

  async exists(path: string) { return path in this.files }
  async readBlob(): Promise<Blob> { throw new Error('not used') }
  async readdir() { return [] }
  async stat(): Promise<FsEntry> { throw new Error('not used') }
  async writeBlob() { throw new Error('not used') }
  async mkdir() {}
  async deleteFile() { throw new Error('not used') }
  async rmdir() { throw new Error('not used') }
  async listFiles() { return [] }
  async listFilesByExts() { return [] }
  async readBlobUrl(): Promise<string> { throw new Error('not used') }
}

async function candidate(
  patches: AgentProposalCandidate['proposal']['patches'],
  files: Record<string, string> = initialFiles,
): Promise<AgentProposalCandidate> {
  return {
    taskId: 'task_proposal_fixture',
    projectId: 'project_fixture',
    proposal: {
      summary: 'Rewrite the opening',
      projectRevision: await computeAgentProjectRevision(files),
      patches,
      diagnostics: [],
    },
    usage: {
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
      providerCostMicroCny: 7_000,
      chargedMicroPoints: 7_000,
    },
  }
}

describe('agent proposal review', () => {
  it('previews a validated file diff without mutating the workspace', async () => {
    const fs = new FakeFileSystem(initialFiles)
    const service = new AgentProposalReviewService(
      createStudioAgentProjectWorkspace(fs, 'project_fixture'),
    )
    const next = '# Outline\n\nA new direction.\n'
    const review = await service.review(await candidate([
      { kind: 'raw-text', path: 'adv/outline.md', content: next },
    ]))

    expect(review.files).toEqual([{
      path: 'adv/outline.md',
      before: initialFiles['adv/outline.md'],
      after: next,
      operations: ['raw-text'],
    }])
    expect(fs.files).toEqual(initialFiles)
  })

  it('applies only after an explicit call and can restore the exact prior bytes', async () => {
    const fs = new FakeFileSystem(initialFiles)
    const service = new AgentProposalReviewService(
      createStudioAgentProjectWorkspace(fs, 'project_fixture'),
    )
    const next = '# Outline\n\nA new direction.\n'
    const review = await service.review(await candidate([
      { kind: 'raw-text', path: 'adv/outline.md', content: next },
    ]))

    expect(fs.files['adv/outline.md']).toBe(initialFiles['adv/outline.md'])
    const applied = await service.apply(review)
    expect(fs.files['adv/outline.md']).toBe(next)
    expect(applied.afterRevision).not.toBe(applied.beforeRevision)

    await service.undo(applied)
    expect(fs.files['adv/outline.md']).toBe(initialFiles['adv/outline.md'])
  })

  it('refuses to apply when the project changed after generation', async () => {
    const fs = new FakeFileSystem(initialFiles)
    const service = new AgentProposalReviewService(
      createStudioAgentProjectWorkspace(fs, 'project_fixture'),
    )
    const stale = await candidate([
      { kind: 'raw-text', path: 'adv/outline.md', content: '# Outline\n\nCandidate.\n' },
    ])
    fs.files['adv/outline.md'] = '# Outline\n\nAuthor edit.\n'

    await expect(service.review(stale)).rejects.toMatchObject({
      code: 'baseline_conflict',
    })
    expect(fs.files['adv/outline.md']).toContain('Author edit')
  })

  it('rejects disallowed paths and newly introduced compiler errors', async () => {
    const fs = new FakeFileSystem(initialFiles)
    const service = new AgentProposalReviewService(
      createStudioAgentProjectWorkspace(fs, 'project_fixture'),
    )
    await expect(service.review(await candidate([
      { kind: 'raw-text', path: '../outside.md', content: 'unsafe' },
    ]))).rejects.toMatchObject({ code: 'invalid_patch' })

    await expect(service.review(await candidate([
      {
        kind: 'raw-text',
        path: 'adv/chapters/intro.adv.md',
        content: '# Intro {#start}\n\n- [Broken](missing#ending)\n',
      },
    ]))).rejects.toSatisfy((error: unknown) => (
      error instanceof AgentProposalReviewError
      && error.code === 'compile_failed'
      && error.diagnostics.length > 0
    ))
    expect(fs.files).toEqual(initialFiles)
  })

  it('rolls back every touched file when a later write fails', async () => {
    const fs = new FakeFileSystem(initialFiles)
    const service = new AgentProposalReviewService(
      createStudioAgentProjectWorkspace(fs, 'project_fixture'),
    )
    const review = await service.review(await candidate([
      {
        kind: 'raw-text',
        path: 'adv/chapters/intro.adv.md',
        content: '# Intro {#start}\n\nA safe replacement.\n',
      },
      { kind: 'raw-text', path: 'adv/outline.md', content: '# Outline\n\nNew outline.\n' },
    ]))
    fs.failWriteOnceAt = 'adv/outline.md'

    await expect(service.apply(review)).rejects.toMatchObject({ code: 'write_failed' })
    expect(fs.files).toEqual(initialFiles)
  })

  it('blocks undo when the author edits after applying', async () => {
    const fs = new FakeFileSystem(initialFiles)
    const service = new AgentProposalReviewService(
      createStudioAgentProjectWorkspace(fs, 'project_fixture'),
    )
    const review = await service.review(await candidate([
      { kind: 'raw-text', path: 'adv/outline.md', content: '# Outline\n\nCandidate.\n' },
    ]))
    const applied = await service.apply(review)
    fs.files['adv/outline.md'] = '# Outline\n\nAuthor continued editing.\n'

    await expect(service.undo(applied)).rejects.toMatchObject({ code: 'undo_conflict' })
    expect(fs.files['adv/outline.md']).toContain('Author continued')
  })
})
