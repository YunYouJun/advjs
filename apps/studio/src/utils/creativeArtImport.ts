import type { CreativeArtifact, CreativeTeamRun } from '@advjs/agent'
import type { AdvAssetEntry } from '@advjs/types'
import type { CreativeArtImportEntry, CreativeArtImportReview } from './creativeArtImportCache'
import type { CreativeMediaProjectState } from './creativeMediaRecovery'
import type { IFileSystem } from './fs'
import { computeAgentProjectRevision, creativeArtifactExpectedFiles, parseCreativeProject } from '@advjs/agent'
import { compileProject, planAdvAssetManifestUpsert } from '@advjs/core'
import { dumpYamlFrontmatter } from '@advjs/parser'
import * as yaml from 'js-yaml'
import { inspectCreativeMediaWrite, recoverCreativeMediaWrite } from './creativeMediaRecovery'
import { createStudioCreativeWorkspace } from './creativeTeamWorkspace'
import { commitStudioProjectFiles } from './nativeProjectMutation'

/** Reject older proposal versions and mismatched request identities before reviewing or writing. */
export function assertCreativeArtImport(run: CreativeTeamRun, entry: CreativeArtImportEntry, files?: Readonly<Record<string, string>>): CreativeArtifact {
  if (run.milestones?.some(item => item.status === 'prepared') || run.tasks.some(item => ['running', 'reconcile_required'].includes(item.status)))
    throw new Error('CREATIVE_IMAGE_RECOVERY_REQUIRED')
  const artifact = run.artifacts.find(item => item.id === entry.artifactId && item.fingerprint === entry.artifactFingerprint && ['selected', 'adopted'].includes(item.status))
  if (run.id !== entry.runId || run.accountId !== entry.accountId || run.plan.projectId !== entry.projectId
    || !artifact || artifact.output?.kind !== 'art-direction' || !artifact.output.requests.some(item => JSON.stringify(item) === JSON.stringify(entry.request))) {
    throw new Error('CREATIVE_IMAGE_PROPOSAL_CHANGED')
  }
  if (files) {
    for (const [path, content] of Object.entries(creativeArtifactExpectedFiles(artifact, run))) {
      if ((files[path] ?? null) !== content)
        throw new Error('CREATIVE_IMAGE_SOURCE_CHANGED')
    }
  }
  return artifact
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('CREATIVE_IMAGE_INVALID_SOURCE')
  return value as Record<string, unknown>
}
function localRoot(files: Readonly<Record<string, string>>): string {
  if (!files['adv/assets.json']) {
    if (files['adv/assets/index.json'])
      throw new Error('CREATIVE_IMAGE_LEGACY_CATALOG')
    return 'adv/assets'
  }
  const root = record(JSON.parse(files['adv/assets.json']))
  const profile = record(root.profiles ?? {})
  const local = profile.local === undefined ? undefined : record(profile.local)
  if (local && local.provider !== 'project')
    throw new Error('CREATIVE_IMAGE_INVALID_LOCAL_ROOT')
  const path = local ? local.root ?? '' : 'adv/assets'
  if (typeof path !== 'string' || (path && (!/^[\w./-]+$/.test(path) || path.split('/').some(part => ['.', '..', ''].includes(part)))))
    throw new Error('CREATIVE_IMAGE_INVALID_LOCAL_ROOT')
  return path
}
function sceneBinding(content: string | undefined, sceneId: string, assetId: string, locationId?: string): string {
  const match = content?.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (content && !match)
    throw new Error('CREATIVE_IMAGE_INVALID_SCENE')
  const frontmatter = match ? record(yaml.load(match[1])) : { id: sceneId, name: sceneId }
  if (frontmatter.id !== sceneId || (frontmatter.type !== undefined && frontmatter.type !== 'image'))
    throw new Error('CREATIVE_IMAGE_INVALID_SCENE')
  frontmatter.type = 'image'
  frontmatter.assetId = assetId
  if (locationId && frontmatter.linkedLocation === undefined)
    frontmatter.linkedLocation = locationId
  delete frontmatter.src
  return `---\n${dumpYamlFrontmatter(frontmatter)}\n---\n${content && match ? content.slice(match[0].length) : ''}`
}

/** Reuse the canonical catalog planner and compiler; image bytes are not part of this source diff. */
export async function reviewCreativeArtImport(fs: IFileSystem, run: CreativeTeamRun, entry: CreativeArtImportEntry, replaceExisting: boolean, assertCurrent: () => void): Promise<CreativeArtImportReview> {
  assertCurrent()
  const snapshot = await createStudioCreativeWorkspace(fs, entry.projectId, { assertCurrent }).snapshot()
  assertCreativeArtImport(run, entry, snapshot.files)
  const { request, image } = entry
  if (!/^[a-f0-9]{64}$/.test(image.sha256) || !entry.attribution.trim() || entry.attribution.length > 1000 || entry.license.length > 200)
    throw new Error('CREATIVE_IMAGE_INVALID_METADATA')
  const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[image.mimeType]
  if (!extension)
    throw new Error('CREATIVE_IMAGE_FORMAT')
  const path = `images/creative/${image.sha256}.${extension}`
  const asset: AdvAssetEntry = {
    id: request.assetId,
    kind: request.kind === 'background' ? 'background' : 'character',
    type: 'image',
    path,
    sha256: image.sha256,
    bytes: image.bytes,
    mimeType: image.mimeType,
    width: image.width,
    height: image.height,
    ...(request.kind === 'background' ? { sceneId: request.sceneId } : { characterId: request.characterId, expression: request.kind === 'expression' ? request.expression : 'default' }),
    ...(entry.license ? { license: entry.license } : {}),
    source: { type: 'manual-import', createdAt: new Date(entry.createdAt).toISOString(), derivedFrom: entry.attribution },
    labels: ['creative-team', `proposal:${entry.artifactId}`],
  }
  const result = planAdvAssetManifestUpsert({ files: snapshot.files, rootPath: 'adv/assets.json', catalogId: entry.projectId, asset, replaceExisting })
  if (asset.kind === 'character') {
    const characterPath = `adv/characters/${request.characterId}.character.md`
    if (!snapshot.files[characterPath])
      throw new Error('CREATIVE_IMAGE_CHARACTER_REQUIRED')
    if (result.manifest.assets.some(item => item.id !== asset.id && item.kind === 'character' && item.characterId === asset.characterId && item.expression === asset.expression))
      throw new Error('CREATIVE_IMAGE_BINDING_CONFLICT')
  }
  const writes = { ...result.writes }
  let binding = `character:${request.characterId}:${asset.expression}`
  if (request.kind === 'background') {
    const sceneId = request.sceneId!
    const scenePath = `adv/scenes/${sceneId}.md`
    writes[scenePath] = sceneBinding(snapshot.files[scenePath], sceneId, request.assetId, request.locationId)
    binding = `scene:${sceneId}`
  }
  const files = { ...snapshot.files, ...writes }
  parseCreativeProject({ id: entry.projectId, revision: snapshot.revision, files })
  const compilation = await compileProject({ id: entry.projectId, files }, { allowEmptyAssetManifest: true })
  if (compilation.diagnostics.some(item => item.severity === 'error'))
    throw new Error(`CREATIVE_IMAGE_COMPILE_FAILED:${compilation.diagnostics.filter(item => item.severity === 'error').map(item => item.code).join(',')}`)
  if (asset.kind === 'character' && !compilation.project.characters.some(item => item.id === asset.characterId))
    throw new Error('CREATIVE_IMAGE_CHARACTER_REQUIRED')
  const afterRevision = await computeAgentProjectRevision(files)
  assertCurrent()
  return { beforeRevision: snapshot.revision, afterRevision, mediaPath: [localRoot(snapshot.files), path].filter(Boolean).join('/'), binding, changes: Object.entries(writes).map(([path, content]) => ({ path, expected: snapshot.files[path] ?? null, content })) }
}

/** Inspect durable files and bytes without resubmitting an import or changing any source. */
export async function inspectCreativeArtImport(fs: IFileSystem, entry: CreativeArtImportEntry, assertCurrent: () => void): Promise<CreativeMediaProjectState> {
  if (!entry.review)
    return 'before'
  return inspectCreativeMediaWrite(fs, entry.projectId, entry.review, entry.image, assertCurrent)
}

/** A crashed partial import can finish or restore only its reviewed files; reusable image bytes remain. */
export async function recoverCreativeArtImport(fs: IFileSystem, run: CreativeTeamRun, entry: CreativeArtImportEntry, destination: 'before' | 'after', assertCurrent: () => void) {
  if (!entry.review)
    throw new Error('CREATIVE_IMAGE_RECOVERY_REQUIRED')
  if (destination === 'after')
    assertCreativeArtImport(run, entry)
  await recoverCreativeMediaWrite({ fs, projectId: entry.projectId, review: entry.review, media: entry.image, destination, data: entry.data, mimeType: entry.image.mimeType, assertCurrent, acceptsPath: path => /^adv\/(?:assets(?:\.json|\/[\w./-]+\.json)|scenes\/[\w-]+\.md)$/.test(path) && !path.split('/').some(part => ['.', '..', ''].includes(part)) })
}

/** Commit binary, catalog and binding under Studio's existing project lock with rollback. */
export async function commitCreativeArtImport(fs: IFileSystem, entry: CreativeArtImportEntry, assertCurrent: () => void, undo = false): Promise<void> {
  const review = entry.review
  if (!review || (!undo && !entry.data))
    throw new Error('CREATIVE_IMAGE_RECOVERY_REQUIRED')
  const changes = undo ? review.changes.map(change => ({ path: change.path, expected: change.content, content: change.expected })) : review.changes
  await commitStudioProjectFiles(fs, changes, {
    assertCurrent,
    acceptsPath: path => /^adv\/(?:assets(?:\.json|\/[\w./-]+\.json)|scenes\/[\w-]+\.md)$/.test(path) && !path.split('/').some(part => ['.', '..', ''].includes(part)),
    ...(undo ? {} : { media: { path: review.mediaPath, blob: new Blob([entry.data!], { type: entry.image.mimeType }), sha256: entry.image.sha256, bytes: entry.image.bytes } }),
    async validateCurrent(scope) {
      const snapshot = await createStudioCreativeWorkspace(scope, entry.projectId, { assertCurrent }).snapshot()
      if (snapshot.revision !== (undo ? review.afterRevision : review.beforeRevision))
        throw new Error('CREATIVE_IMAGE_SOURCE_CHANGED')
    },
  })
}
