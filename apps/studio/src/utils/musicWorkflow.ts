import type { FlowEditCommand, FlowEditDocument } from '@advjs/core'
import type { AdvAssetEntry } from '@advjs/types'
import { inspectMusicReview, musicPlaybackDefaults } from '@advjs/audio'
import { createFlowNode } from '@advjs/core'

/** A navigation request selects an asset only; author confirmation edits native source. */
export function musicAssetQuery(value: unknown) {
  return typeof value === 'string' && value.length <= 160 && /^\w[\w./-]*$/u.test(value) && !value.split('/').some(part => ['.', '..', ''].includes(part)) ? value : ''
}

/** Existing Core commands preserve all dialogue IDs, source metadata and later cues. */
export function musicFlowEntryCommands(document: FlowEditDocument, asset: AdvAssetEntry): FlowEditCommand[] {
  if (!inspectMusicReview(asset).canBind)
    throw new Error('MUSIC_REVIEW_REQUIRED')
  const entryId = document.startNodeId ?? document.nodes[0]?.id
  const entry = document.nodes.find(node => node.id === entryId)
  if (!entry)
    throw new Error('ADV_FLOW_ENTRY_REQUIRED')
  const operation = { type: 'bgm', action: 'set', asset: asset.id, ...musicPlaybackDefaults(asset.music?.usage ?? 'background'), ...(asset.loop !== undefined ? { loop: asset.loop } : {}) }
  if (entry.type === 'audio') {
    const operations = Array.isArray(entry.operations) ? entry.operations as Array<Record<string, unknown>> : []
    return [{ type: 'update-node', nodeId: entry.id, patch: { operations: [operation, ...operations.filter(row => row.type !== 'bgm')] } }]
  }
  const node = { ...createFlowNode('audio'), operations: [operation], next: entry.id }
  return [{ type: 'add-node', node, index: 0 }, { type: 'set-entry', nodeId: node.id }]
}

export async function prepareStudioMarkdownMusicBinding(fs: import('./fs').IFileSystem, path: string, assetId: string) {
  const { compileProject, patchMarkdownAudioOperations, readMarkdownAudioTarget } = await import('@advjs/core')
  const { parseAst } = await import('@advjs/parser')
  if (!path.startsWith('adv/chapters/') || !path.endsWith('.adv.md') || path.includes('\\') || path.split('/').some(part => ['', '.', '..', '.git', 'node_modules'].includes(part)))
    throw new Error('ADV_AUDIO_SOURCE_TARGET_INVALID')
  const files = Object.fromEntries((await fs.collectAllFiles()).map(file => [file.path, file.content]))
  const compiled = await compileProject({ files }, { allowEmptyAssetManifest: true })
  const asset = compiled.project.assets?.assets.find(asset => asset.id === assetId)
  if (!asset || !inspectMusicReview(asset).canBind)
    throw new Error('MUSIC_REVIEW_REQUIRED')
  const source = files[path]
  if (source === undefined)
    throw new Error('ADV_AUDIO_SOURCE_TARGET_CHANGED')
  const ast = await parseAst(source)
  const first = ast.children.find(node => node.position?.start.line)
  if (!first?.position)
    throw new Error('ADV_AUDIO_SOURCE_TARGET_CHANGED')
  const target = await readMarkdownAudioTarget(source, first.position.start.line)
  const operation = { type: 'bgm' as const, action: 'set' as const, asset: asset.id, ...musicPlaybackDefaults(asset.music?.usage ?? 'background'), ...(asset.loop !== undefined ? { loop: asset.loop } : {}) }
  const content = await patchMarkdownAudioOperations(source, target, [operation, ...target.operations.filter(row => row.type !== 'bgm')], compiled.project.assets)
  const validation = await compileProject({ files: { ...files, [path]: content } }, { allowEmptyAssetManifest: true })
  if (!validation.project.program || validation.diagnostics.some(issue => issue.severity === 'error'))
    throw new Error(validation.diagnostics.find(issue => issue.severity === 'error')?.code ?? 'ADV_AUDIO_SOURCE_INVALID')
  const changes = Object.entries(files).map(([file, original]) => ({ path: file, expected: original, content: file === path ? content : original }))
  if (changes.length > 100)
    throw new Error('ADV_STUDIO_TRANSACTION_INVALID')
  return { path, content, changes }
}

export async function commitStudioMarkdownMusicBinding(fs: import('./fs').IFileSystem, plan: Awaited<ReturnType<typeof prepareStudioMarkdownMusicBinding>>, assertCurrent: () => void) {
  const { commitStudioProjectFiles } = await import('./nativeProjectMutation')
  const paths = new Set(plan.changes.map(change => change.path))
  await commitStudioProjectFiles(fs, plan.changes, { assertCurrent, acceptsPath: path => paths.has(path) })
}
