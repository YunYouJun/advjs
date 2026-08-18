import type { ProjectSourcePatch } from '@advjs/core'
import type { AdvProjectDiagnostic, AdvProjectFileMap } from '@advjs/types'
import type { AgentProposalCandidate } from './candidate'
import type { AgentProjectFileSystem } from './file-system'
import { applyProjectPatches, compileProject } from '@advjs/core'

export type AgentProposalReviewErrorCode
  = | 'baseline_conflict'
    | 'invalid_patch'
    | 'compile_failed'
    | 'write_failed'
    | 'rollback_failed'
    | 'undo_conflict'

export class AgentProposalReviewError extends Error {
  readonly code: AgentProposalReviewErrorCode
  readonly diagnostics: readonly AdvProjectDiagnostic[]

  constructor(
    code: AgentProposalReviewErrorCode,
    message: string,
    options: { cause?: unknown, diagnostics?: readonly AdvProjectDiagnostic[] } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'AgentProposalReviewError'
    this.code = code
    this.diagnostics = options.diagnostics ?? []
  }
}

export interface AgentProjectWorkspaceSnapshot {
  projectId: string
  revision: string
  files: Readonly<AdvProjectFileMap>
}

export interface AgentProjectWorkspaceCommit {
  before: AgentProjectWorkspaceSnapshot
  after: AgentProjectWorkspaceSnapshot
  changedPaths: readonly string[]
}

export interface AgentProjectWorkspace {
  commit: (patches: readonly ProjectSourcePatch[], expectedRevision: string) => Promise<AgentProjectWorkspaceCommit>
  restore: (files: Readonly<AdvProjectFileMap>, expectedRevision: string) => Promise<AgentProjectWorkspaceCommit>
  snapshot: () => Promise<AgentProjectWorkspaceSnapshot>
}

export interface AgentProposalFileReview {
  path: string
  before: string
  after: string
  operations: readonly string[]
}

export interface AgentProposalReview {
  candidate: AgentProposalCandidate
  baseline: AgentProjectWorkspaceSnapshot
  files: readonly AgentProposalFileReview[]
  validationDiagnostics: readonly AdvProjectDiagnostic[]
}

export interface AppliedAgentProposal {
  taskId: string
  beforeRevision: string
  afterRevision: string
  changedPaths: readonly string[]
  undoFiles: Readonly<AdvProjectFileMap>
}

function diagnosticKey(diagnostic: AdvProjectDiagnostic): string {
  return JSON.stringify([
    diagnostic.code,
    diagnostic.path ?? '',
    diagnostic.line ?? 0,
    diagnostic.column ?? 0,
    diagnostic.message,
  ])
}

async function validateNoNewBlockingDiagnostics(
  projectId: string,
  before: Readonly<AdvProjectFileMap>,
  after: Readonly<AdvProjectFileMap>,
): Promise<readonly AdvProjectDiagnostic[]> {
  const [baseline, proposed] = await Promise.all([
    compileProject({ id: projectId, files: before }),
    compileProject({ id: projectId, files: after }),
  ])
  const existingErrors = new Set(
    baseline.diagnostics
      .filter(item => item.severity === 'error')
      .map(diagnosticKey),
  )
  const newErrors = proposed.diagnostics.filter(item => (
    item.severity === 'error' && !existingErrors.has(diagnosticKey(item))
  ))
  if (newErrors.length > 0) {
    throw new AgentProposalReviewError(
      'compile_failed',
      'The proposal introduces blocking project diagnostics.',
      { diagnostics: newErrors },
    )
  }
  return proposed.diagnostics
}

export async function computeAgentProjectRevision(files: Readonly<AdvProjectFileMap>): Promise<string> {
  const entries = Object.entries(files).sort(([left], [right]) => left.localeCompare(right, 'en'))
  const canonical = JSON.stringify(entries)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
  const hex = Array.from(
    new Uint8Array(digest),
    byte => byte.toString(16).padStart(2, '0'),
  ).join('')
  return `sha256:${hex}`
}

function fileMap(entries: readonly { content: string, path: string }[]): AdvProjectFileMap {
  return Object.fromEntries(
    entries
      .map(entry => [entry.path, entry.content] as const)
      .sort(([left], [right]) => left.localeCompare(right, 'en')),
  )
}

async function rollback(
  fs: AgentProjectFileSystem,
  paths: readonly string[],
  files: Readonly<AdvProjectFileMap>,
): Promise<void> {
  for (const path of [...paths].reverse())
    await fs.writeFile(path, files[path])
}

/** Adapts Studio's active filesystem to a revision-checked project workspace. */
export function createStudioAgentProjectWorkspace(
  fs: AgentProjectFileSystem,
  projectId: string,
): AgentProjectWorkspace {
  async function snapshot(): Promise<AgentProjectWorkspaceSnapshot> {
    const files = fileMap(await fs.collectAllFiles())
    return {
      projectId,
      revision: await computeAgentProjectRevision(files),
      files,
    }
  }

  async function writeChangedFiles(
    before: AgentProjectWorkspaceSnapshot,
    nextFiles: Readonly<AdvProjectFileMap>,
    changedPaths: readonly string[],
    conflictCode: 'baseline_conflict' | 'undo_conflict',
  ): Promise<AgentProjectWorkspaceCommit> {
    const written: string[] = []
    try {
      for (const path of changedPaths) {
        const current = await fs.readFile(path)
        if (current !== before.files[path]) {
          throw new AgentProposalReviewError(
            conflictCode,
            'The project changed while the proposal was being applied.',
          )
        }
        written.push(path)
        await fs.writeFile(path, nextFiles[path])
      }
    }
    catch (cause) {
      try {
        await rollback(fs, written, before.files)
      }
      catch (rollbackCause) {
        throw new AgentProposalReviewError(
          'rollback_failed',
          'The project could not be restored after a failed write.',
          { cause: rollbackCause },
        )
      }
      if (cause instanceof AgentProposalReviewError)
        throw cause
      throw new AgentProposalReviewError(
        'write_failed',
        'The proposal could not be written. The original files were restored.',
        { cause },
      )
    }
    const after = await snapshot()
    return { before, after, changedPaths }
  }

  async function commit(
    patches: readonly ProjectSourcePatch[],
    expectedRevision: string,
  ): Promise<AgentProjectWorkspaceCommit> {
    const before = await snapshot()
    if (before.revision !== expectedRevision) {
      throw new AgentProposalReviewError(
        'baseline_conflict',
        'The project changed after this proposal was generated.',
      )
    }
    let applied
    try {
      applied = applyProjectPatches(before.files, patches)
    }
    catch (cause) {
      throw new AgentProposalReviewError(
        'invalid_patch',
        'The proposal contains an invalid project patch.',
        { cause },
      )
    }
    await validateNoNewBlockingDiagnostics(projectId, before.files, applied.files)
    return writeChangedFiles(before, applied.files, applied.changedPaths, 'baseline_conflict')
  }

  async function restore(
    files: Readonly<AdvProjectFileMap>,
    expectedRevision: string,
  ): Promise<AgentProjectWorkspaceCommit> {
    const before = await snapshot()
    if (before.revision !== expectedRevision) {
      throw new AgentProposalReviewError(
        'undo_conflict',
        'The project changed after the proposal was applied.',
      )
    }
    const nextFiles = { ...before.files }
    const changedPaths: string[] = []
    for (const [path, content] of Object.entries(files)) {
      if (!(path in before.files) || before.files[path] === content)
        continue
      nextFiles[path] = content
      changedPaths.push(path)
    }
    changedPaths.sort((left, right) => left.localeCompare(right, 'en'))
    await validateNoNewBlockingDiagnostics(projectId, before.files, nextFiles)
    return writeChangedFiles(before, nextFiles, changedPaths, 'undo_conflict')
  }

  return { commit, restore, snapshot }
}

export class AgentProposalReviewService {
  readonly #workspace: AgentProjectWorkspace

  constructor(workspace: AgentProjectWorkspace) {
    this.#workspace = workspace
  }

  async review(candidate: AgentProposalCandidate): Promise<AgentProposalReview> {
    const baseline = await this.#workspace.snapshot()
    if (candidate.projectId && candidate.projectId !== baseline.projectId) {
      throw new AgentProposalReviewError(
        'baseline_conflict',
        'This proposal belongs to another project.',
      )
    }
    if (candidate.proposal.projectRevision !== baseline.revision) {
      throw new AgentProposalReviewError(
        'baseline_conflict',
        'The project changed after this proposal was generated.',
      )
    }
    let applied
    try {
      applied = applyProjectPatches(baseline.files, candidate.proposal.patches)
    }
    catch (cause) {
      throw new AgentProposalReviewError(
        'invalid_patch',
        'The proposal contains an invalid project patch.',
        { cause },
      )
    }
    const diagnostics = await validateNoNewBlockingDiagnostics(
      baseline.projectId,
      baseline.files,
      applied.files,
    )
    return {
      candidate,
      baseline,
      files: applied.changedPaths.map(path => ({
        path,
        before: baseline.files[path],
        after: applied.files[path],
        operations: candidate.proposal.patches
          .filter(patch => patch.path === path)
          .map(patch => patch.kind === 'raw-text' ? patch.kind : `${patch.kind}:${patch.key}`),
      })),
      validationDiagnostics: diagnostics,
    }
  }

  async apply(review: AgentProposalReview): Promise<AppliedAgentProposal> {
    const committed = await this.#workspace.commit(
      review.candidate.proposal.patches,
      review.baseline.revision,
    )
    return {
      taskId: review.candidate.taskId,
      beforeRevision: committed.before.revision,
      afterRevision: committed.after.revision,
      changedPaths: committed.changedPaths,
      undoFiles: Object.fromEntries(
        committed.changedPaths.map(path => [path, committed.before.files[path]]),
      ),
    }
  }

  async undo(applied: AppliedAgentProposal): Promise<AgentProjectWorkspaceSnapshot> {
    const restored = await this.#workspace.restore(applied.undoFiles, applied.afterRevision)
    return restored.after
  }
}
