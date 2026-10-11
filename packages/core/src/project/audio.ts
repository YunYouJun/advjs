import type { AdvAssetManifest, AdvCharacter, AdvProjectDiagnostic, RuntimeNode, RuntimeProgram } from '@advjs/types'
import { audioFingerprint, createAudioPronunciationDictionary, createAudioVoiceProfiles, normalizeAudioLocale, parseAudioMixerConfig, parseAudioPronunciationDictionary, parseAudioVoiceProfiles, parseVoiceLedger, prepareVoiceSpokenText, resolveVoiceTake } from '@advjs/audio'

/** Validate canonical documents before either Editor or Studio publishes a playable Program. */
export async function validateProjectAudio(input: {
  files: ReadonlyMap<string, string>
  root: string
  sourceLocale?: string
  assets?: AdvAssetManifest
  characters: readonly AdvCharacter[]
  program?: RuntimeProgram
}): Promise<AdvProjectDiagnostic[]> {
  const diagnostics: AdvProjectDiagnostic[] = []
  const fail = (code: string, message: string, path: string) => diagnostics.push({ code, message, path, severity: 'error' })
  let sourceLocale = 'zh-CN'
  try {
    sourceLocale = normalizeAudioLocale(input.sourceLocale ?? 'zh-CN')
  }
  catch {
    fail('ADV_AUDIO_INVALID_LOCALE', 'Project locale requires an exact supported language tag', `${input.root}/settings/game.json`)
  }
  const mixerPath = `${input.root}/audio/mixer.json`
  const ledgerPath = `${input.root}/audio/voice-ledger.json`
  const mixerSource = input.files.get(mixerPath)
  if (mixerSource !== undefined) {
    try {
      const mixer = parseAudioMixerConfig(JSON.parse(mixerSource))
      for (const [cue, assetId] of Object.entries(mixer.ui ?? {})) {
        const asset = input.assets?.assets.find(asset => asset.id === assetId)
        if (!asset || asset.type !== 'audio' || asset.kind !== 'ui')
          fail('ADV_AUDIO_INVALID_UI_ASSET', `UI cue ${cue} requires a registered audio asset with kind ui: ${assetId}`, mixerPath)
      }
    }
    catch (error) {
      fail('ADV_AUDIO_INVALID_MIXER', error instanceof Error ? error.message : String(error), mixerPath)
    }
  }
  const ledgerSource = input.files.get(ledgerPath)
  const pronunciationPath = `${input.root}/audio/pronunciation.json`
  let pronunciation
  try {
    pronunciation = parseAudioPronunciationDictionary(input.files.get(pronunciationPath) ?? createAudioPronunciationDictionary())
  }
  catch (cause) {
    fail('ADV_AUDIO_INVALID_PRONUNCIATION', cause instanceof Error ? cause.message : String(cause), pronunciationPath)
  }
  const voiceProfilesPath = `${input.root}/audio/voice-profiles.json`
  let voiceProfiles
  try {
    voiceProfiles = parseAudioVoiceProfiles(input.files.get(voiceProfilesPath) ?? createAudioVoiceProfiles())
  }
  catch (cause) {
    fail('ADV_AUDIO_INVALID_VOICE_PROFILES', cause instanceof Error ? cause.message : String(cause), voiceProfilesPath)
  }
  if (ledgerSource === undefined)
    return diagnostics
  let ledger
  try {
    ledger = parseVoiceLedger(ledgerSource)
  }
  catch (error) {
    fail('ADV_AUDIO_INVALID_VOICE_LEDGER', error instanceof Error ? error.message : String(error), ledgerPath)
    return diagnostics
  }
  const lines = new Map<string, RuntimeNode>()
  for (const chapter of Object.values(input.program?.chapters ?? {})) {
    for (const node of Object.values(chapter.nodes)) {
      if (typeof node.data?.lineId === 'string')
        lines.set(node.data.lineId, node)
    }
  }
  const speakers = new Set(input.characters.map(character => character.id))
  const profiles = new Map(await Promise.all(input.characters.filter(character => character.voiceProfile).map(async character => [character.id, await audioFingerprint(character.voiceProfile)] as const)))
  if (voiceProfiles?.narrator)
    profiles.set('narrator', await audioFingerprint(voiceProfiles.narrator))
  for (const [lineId, line] of Object.entries(ledger.lines)) {
    if (line.speakerId !== 'narrator' && !speakers.has(line.speakerId))
      fail('ADV_AUDIO_UNKNOWN_VOICE_SPEAKER', `Voice line ${lineId} references unknown stable character ID: ${line.speakerId}`, ledgerPath)
    const node = lines.get(lineId)
    if (node) {
      const speakerId = node.kind === 'narration' ? 'narrator' : node.data?.speakerId
      if (speakerId !== line.speakerId)
        fail('ADV_AUDIO_VOICE_SPEAKER_MISMATCH', `Voice line ${lineId} belongs to ${line.speakerId}, but its script speaker is ${String(speakerId)}`, ledgerPath)
      if (typeof node.data?.text === 'string' && node.data.text !== line.displayText)
        diagnostics.push({ code: 'VOICE_STALE', severity: 'warning', path: ledgerPath, message: `Voice line ${lineId} keeps earlier source text; review its immutable takes` })
    }
    else if (input.program) {
      diagnostics.push({ code: 'ADV_AUDIO_ORPHAN_VOICE_LINE', severity: 'warning', path: ledgerPath, message: `Voice line ${lineId} is absent from the current script; retained historical takes require author review` })
    }
    for (const locale of Object.keys(line.locales)) {
      try {
        const binding = line.locales[locale]!
        const displayText = locale === sourceLocale && typeof node?.data?.text === 'string' ? node.data.text : binding.displayText ?? line.displayText
        const prepared = binding.selectedTake ? await prepareVoiceSpokenText(displayText, { override: binding.spokenText ?? line.spokenText, locale, pronunciation }) : undefined
        const resolved = resolveVoiceTake(ledger, { lineId, locale, assets: input.assets?.assets ?? [], ...(prepared ? { spokenText: prepared.text, pronunciationRevision: prepared.pronunciationRevision ?? null } : {}), ...(profiles.has(line.speakerId) ? { voiceProfileRevision: profiles.get(line.speakerId)! } : {}) })
        if (resolved.take?.source === 'cloned') {
          const record = resolved.take.rights?.consentRecord
          const canonical = typeof record === 'string' && !record.includes('\\')
            && !/^(?:[a-z]+:|\/)/iu.test(record)
            && record.split('/').every(segment => segment && !['.', '..', '.git', 'node_modules'].includes(segment.toLowerCase()))
          if (!canonical || !input.files.has(record!))
            fail('ADV_AUDIO_VOICE_CONSENT_REQUIRED', `Selected cloned voice ${lineId} (${locale}) requires an existing canonical project-relative consent record: ${String(record)}`, ledgerPath)
        }
        diagnostics.push(...resolved.warnings.map(warning => ({ ...warning, severity: 'warning' as const, path: ledgerPath })))
      }
      catch (error) {
        fail('ADV_AUDIO_INVALID_SELECTED_TAKE', `${lineId} (${locale}): ${error instanceof Error ? error.message : String(error)}`, ledgerPath)
      }
    }
  }
  return diagnostics
}
