import type { CreativePlaytestVoiceRow } from '@advjs/agent'
import type { AdvProjectDiagnostic, VoiceAuthoringSnapshot } from '@advjs/types'
import type { IFileSystem } from './fs'
import { audioProjectMediaPath, createAudioPronunciationDictionary, createAudioVoiceProfiles, createVoiceLedger, normalizeAudioLocale, parseAudioPronunciationDictionary, parseAudioVoiceProfiles, parseVoiceLedger, resolveVoiceReviewRows, verifyVoiceCandidateBytes, voiceReviewContextFromProgram } from '@advjs/audio'
import { compileProject } from '@advjs/core'
import { createStudioCreativeWorkspace } from './creativeTeamWorkspace'

export type CreativeVoiceCoverageStatus = CreativePlaytestVoiceRow['status']
export interface CreativeVoiceCoverageRow {
  address: string
  path?: string
  line?: number
  lineId?: string
  speakerId: string
  text: string
  status: CreativeVoiceCoverageStatus
  profileMissing: boolean
  takes: number
  selected?: CreativePlaytestVoiceRow['selected']
}
export interface CreativeVoiceCoverage {
  revision: string
  locale: string
  complete: boolean
  diagnostics: AdvProjectDiagnostic[]
  rows: CreativeVoiceCoverageRow[]
}

/** All compiled chapter/Flow dialogue, including lines absent from the ledger or director's plan. */
export async function readCreativeVoiceCoverage(fs: IFileSystem, projectId: string, assertCurrent: () => void): Promise<CreativeVoiceCoverage> {
  const workspace = createStudioCreativeWorkspace(fs, projectId, { assertCurrent })
  const source = await workspace.snapshot()
  const result = await inspectCreativeVoiceCoverage(fs, projectId, source, assertCurrent)
  if ((await workspace.snapshot()).revision !== source.revision)
    throw new Error('CREATIVE_VOICE_SOURCE_CHANGED')
  assertCurrent()
  return result
}

/** Inspect a saved or candidate source snapshot against actual project bytes, without writes. */
export async function inspectCreativeVoiceCoverage(fs: IFileSystem, projectId: string, source: { revision: string, files: Readonly<Record<string, string>> }, assertCurrent: () => void): Promise<CreativeVoiceCoverage> {
  assertCurrent()
  const compiled = await compileProject({ id: projectId, files: source.files }, { allowEmptyAssetManifest: true })
  if (!compiled.project.program)
    throw new Error('CREATIVE_VOICE_COVERAGE_COMPILE_REQUIRED')
  const files = source.files
  const locale = normalizeAudioLocale(String(compiled.project.game.locale ?? 'zh-CN'))
  const profiles = Object.fromEntries(compiled.project.characters.map(item => [item.id, item.voiceProfile]))
  const voiceProfiles = parseAudioVoiceProfiles(files['adv/audio/voice-profiles.json'] ?? createAudioVoiceProfiles())
  const catalog = compiled.project.assets ?? { schemaVersion: 2 as const, id: projectId, defaultProfile: 'local', profiles: { local: { provider: 'project' as const, root: 'adv/assets' } }, assets: [] }
  const snapshot: VoiceAuthoringSnapshot = {
    revision: source.revision,
    catalog,
    ledger: parseVoiceLedger(files['adv/audio/voice-ledger.json'] ?? createVoiceLedger()),
    pronunciation: parseAudioPronunciationDictionary(files['adv/audio/pronunciation.json'] ?? createAudioPronunciationDictionary()),
    voiceProfiles,
    ...(voiceProfiles.narrator ? { narratorProfile: voiceProfiles.narrator } : {}),
  }
  const reviewed = await resolveVoiceReviewRows(snapshot, voiceReviewContextFromProgram(compiled.project.program, profiles, locale))
  const nodes = Object.values(compiled.project.program.chapters).flatMap(chapter => Object.values(chapter.nodes).filter(node => ['dialog', 'narration'].includes(node.kind)).map(node => ({ node, address: `${chapter.id}#${node.id}` })))
  const counts = new Map<string, number>()
  for (const { node } of nodes) {
    const id = String(node.data?.lineId ?? '')
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  const verified = new Map<string, boolean>()
  const rows: CreativeVoiceCoverageRow[] = []
  for (const { node, address } of nodes) {
    const id = typeof node.data?.lineId === 'string' ? node.data.lineId : undefined
    const speakerId = String(node.data?.speakerId ?? 'narrator')
    const profile = speakerId === 'narrator' ? voiceProfiles.narrator : profiles[speakerId]
    const location = compiled.sourceMap.nodes?.[address]
    const reviewedLine = reviewed.find(item => item.lineId === id && item.locale === locale)
    const selected = reviewedLine?.takes.find(item => item.selected)
    let status: CreativeVoiceCoverageStatus = !id || counts.get(id) !== 1
      ? 'unresolved'
      : !reviewedLine?.takes.length ? 'missing' : !selected ? 'unselected' : selected.unavailable ? 'unavailable' : selected.stale ? 'stale' : 'ready'
    if (['ready', 'stale'].includes(status) && selected) {
      const asset = catalog.assets.find(item => item.id === selected.assetId)
      try {
        if (!asset || !Number.isSafeInteger(asset.bytes) || !(asset.bytes! > 0 && asset.bytes! <= 32 * 1024 * 1024))
          throw new Error('CREATIVE_VOICE_BYTES_REQUIRED')
        const path = audioProjectMediaPath(catalog, asset)
        const key = `${path}:${selected.sha256}:${asset.bytes}`
        if (!verified.has(key)) {
          let valid = false
          try {
            await verifyVoiceCandidateBytes({ sha256: selected.sha256, bytes: asset.bytes }, await (await fs.readBlob(path)).arrayBuffer())
            valid = true
          }
          catch { /* Missing/corrupt bytes remain a visible per-line issue. */ }
          verified.set(key, valid)
        }
        if (!verified.get(key))
          status = 'unavailable'
      }
      catch { status = 'unavailable' }
    }
    assertCurrent()
    rows.push({ address, ...(location ?? {}), ...(id ? { lineId: id } : {}), speakerId, text: String(node.data?.text ?? ''), status, profileMissing: !Object.values(profile?.locales?.[locale]?.providers ?? {}).some(binding => Boolean(binding.voiceId && binding.model)), takes: reviewedLine?.takes.length ?? 0, ...(selected ? { selected: { takeId: selected.id, assetId: selected.assetId, sha256: selected.sha256 } } : {}) })
  }
  assertCurrent()
  return { revision: source.revision, locale, complete: !compiled.diagnostics.some(item => item.severity === 'error'), diagnostics: compiled.diagnostics, rows }
}
