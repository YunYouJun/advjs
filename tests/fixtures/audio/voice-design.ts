import type { VoiceDesignDraft } from '@advjs/types'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createEditorVoiceJobsFixture } from './editor-voice-jobs'

/** Existing registered provider fixture with deterministic design capabilities. */
export async function createVoiceDesignFixture() {
  const fixture = await createEditorVoiceJobsFixture()
  const provider = fixture.provider
  provider.capabilities.designSources = ['system', 'designed', 'cloned']
  provider.doctor = async () => ({ provider: provider.id, supported: true, ready: true, checks: [] })
  provider.listVoices = async () => [{ id: 'system:fixture', label: 'Fixture' }, { id: 'system:soft', label: 'Soft fixture' }]
  provider.buildDesignPreset = async ({ template, characterId, text, definition, intent }) => ({ ...template, voiceId: definition.providerVoiceId ?? `${definition.source}:fixture`, source: definition.source, characters: [{ id: characterId, text }], intent, ...(definition.description ? { description: definition.description } : {}), ...(definition.reference ? { reference: definition.reference } : {}) })
  provider.inspectPreset = async (request) => {
    const bytes = await readFile(request.configPath)
    const preset = JSON.parse(bytes.toString())
    return { presetSha256: createHash('sha256').update(bytes).digest('hex'), characters: [{ id: request.character ?? preset.characters?.[0]?.id ?? 'hero', name: 'Fixture', text: request.text ?? preset.characters?.[0]?.text ?? '试听', generation: { model: preset.model, providerVoiceId: preset.voiceId, source: preset.source ?? 'system', mimeType: 'audio/wav', ...(preset.revision ? { revision: preset.revision } : {}), parameters: { fixture: true } } }] }
  }
  const synthesize = provider.synthesize
  provider.synthesize = async (request) => {
    const result = await synthesize(request)
    const preset = JSON.parse(await readFile(request.configPath, 'utf8'))
    for (const candidate of result.candidates) {
      candidate.model = preset.model
      candidate.providerVoiceId = preset.voiceId
      if (preset.revision)
        candidate.revision = preset.revision
    }
    return result
  }
  const draft: VoiceDesignDraft = { id: 'hero-soft-v1', version: '1', characterId: 'hero', label: 'Hero soft', intent: { speakingStyle: '清晰柔和' }, locales: { 'zh-CN': { providers: { [provider.id]: { preset: 'fixture', source: 'system', providerVoiceId: 'system:soft' } } } } }
  return { ...fixture, draft }
}
