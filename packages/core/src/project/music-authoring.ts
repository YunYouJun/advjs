import type { AdvProjectCompileOptions } from '@advjs/types'
import { inspectMusicReview, musicPlaybackDefaults } from '@advjs/audio'
import { parseAst } from '@advjs/parser'
import { patchMarkdownAudioOperations, readMarkdownAudioTarget } from './audio-operations'
import { compileProject } from './compile'

/** First use of the local catalog is an explicit, revision-checked edit. */
export async function prepareProjectAudioCatalog(files: Record<string, string>, catalogId: string, options: AdvProjectCompileOptions = {}) {
  if (Object.hasOwn(files, 'adv/assets.json'))
    throw new Error('VOICE_CONFLICT: The catalog already exists; reload before applying')
  if (Object.hasOwn(files, 'adv/assets/index.json'))
    throw new Error('ADV_AUDIO_LEGACY_MIGRATION_REQUIRED: Migrate the existing catalog before creating audio resources')
  const compilation = await compileProject({ files }, { ...options, allowEmptyAssetManifest: true })
  if (compilation.project.root !== 'adv')
    throw new Error('ADV_AUDIO_CONTENT_ROOT_UNSUPPORTED: Audio authoring requires the canonical adv content root')
  const catalog = `${JSON.stringify({ schemaVersion: 2, id: catalogId, defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'adv/assets' } }, includes: [] }, null, 2)}\n`
  const changes = [{ path: 'adv/assets.json', expected: null, content: catalog }]
  if (!Object.hasOwn(files, 'adv.config.json'))
    changes.push({ path: 'adv.config.json', expected: null, content: `${JSON.stringify({ schemaVersion: 1, id: catalogId, root: 'adv', format: 'adv-md' }, null, 2)}\n` })
  return changes
}

export async function prepareMarkdownMusicBinding(files: Record<string, string>, path: string, assetId: string, options: AdvProjectCompileOptions = {}) {
  if (!path.startsWith('adv/chapters/') || !path.endsWith('.adv.md') || path.includes('\\') || path.split('/').some(part => ['', '.', '..', '.git', 'node_modules'].includes(part)))
    throw new Error('ADV_AUDIO_SOURCE_TARGET_INVALID')
  const compiled = await compileProject({ files }, { ...options, allowEmptyAssetManifest: true })
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
  const validation = await compileProject({ files: { ...files, [path]: content } }, { ...options, allowEmptyAssetManifest: true })
  if (!validation.project.program || validation.diagnostics.some(issue => issue.severity === 'error'))
    throw new Error(validation.diagnostics.find(issue => issue.severity === 'error')?.code ?? 'ADV_AUDIO_SOURCE_INVALID')
  const changes = Object.entries(files).map(([file, original]) => ({ path: file, expected: original, content: file === path ? content : original }))
  return { path, content, changes }
}
