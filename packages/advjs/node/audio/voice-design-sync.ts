import type { AdvConfig, AdvVoiceProfile, JsonObject } from '@advjs/types'
import { createHash } from 'node:crypto'
import { readFile, realpath, stat } from 'node:fs/promises'
import { canonicalAudioJson, parseVoiceDesignLibrary, VOICE_DESIGN_LIBRARY_PATH, VOICE_DESIGN_PRESET_ROOT } from '@advjs/audio'
import { isAbsolute, relative, resolve } from 'pathe'
import { resolveAuthoringVoiceContext } from '../commands/voice'
import { loadAdvConfig } from '../config'

const encode = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`
const digest = (value: string) => createHash('sha256').update(value).digest('hex')
function fail(code: string): never {
  throw new Error(code)
}
function immutable(voice: AdvVoiceProfile) {
  return { id: voice.id, version: voice.version, characterId: voice.characterId, implementations: voice.implementations, ...(voice.design ? { intent: voice.design.intent, locales: voice.design.locales, supersedes: voice.design.supersedes ?? null } : {}) }
}

/** Consent documents cannot grant permission to overwrite execution templates. */
export function createVoiceTemplateSyncGuard(options: { root: string, config?: Partial<AdvConfig> }) {
  return async (incoming: Record<string, string>, current: Record<string, string>) => {
    const root = await realpath(options.root)
    const { config } = await loadAdvConfig({ userRoot: root, advConfig: options.config })
    for (const path of Object.values(config.authoring?.voice?.presets ?? {})) {
      if (incoming[path] === undefined && current[path] === undefined)
        continue
      const target = await realpath(resolve(root, path))
      const coordinate = relative(root, target)
      const info = await stat(target)
      if (isAbsolute(coordinate) || coordinate === '..' || coordinate.startsWith('../') || !info.isFile() || info.size > 1024 * 1024 || incoming[path] !== await readFile(target, 'utf8'))
        fail('VOICE_DESIGN_TEMPLATE_IMMUTABLE')
    }
  }
}

/** A browser can synchronize native data, but cannot authorize a model path. */
export function createVoiceDesignMirrorValidator(options: { root: string, config?: Partial<AdvConfig> }) {
  return async (incoming: Record<string, string>, current: Record<string, string>): Promise<Record<string, string>> => {
    const root = await realpath(options.root)
    const prior = parseVoiceDesignLibrary(current[VOICE_DESIGN_LIBRARY_PATH] ?? { schemaVersion: 1, voices: [] })
    const submitted = parseVoiceDesignLibrary(incoming[VOICE_DESIGN_LIBRARY_PATH] ?? { schemaVersion: 1, voices: [] })
    const merged = { ...prior, ...submitted, voices: structuredClone(prior.voices) }
    for (const voice of submitted.voices) {
      const index = merged.voices.findIndex(item => item.id === voice.id)
      const saved = merged.voices[index]
      if (saved && canonicalAudioJson(immutable(saved)) !== canonicalAudioJson(immutable(voice)))
        fail('VOICE_DESIGN_VERSION_IMMUTABLE')
      if (!voice.design && !saved)
        fail('VOICE_DESIGN_LEGACY_SYNC_UNSUPPORTED')
      const result = { ...saved, ...voice }
      if (saved?.design && voice.design) {
        const samples = structuredClone(saved.design.samples)
        for (const sample of voice.design.samples) {
          const existing = samples.find(item => item.assetId === sample.assetId)
          if (existing && canonicalAudioJson(existing) !== canonicalAudioJson(sample))
            fail('VOICE_DESIGN_SAMPLE_IMMUTABLE')
          if (!existing)
            samples.push(sample)
        }
        result.design = { ...voice.design, samples, selectedSamples: { ...saved.design.selectedSamples, ...voice.design.selectedSamples } }
      }
      if (index < 0)
        merged.voices.push(result)
      else
        merged.voices[index] = result
    }
    const library = parseVoiceDesignLibrary(merged)
    const output: Record<string, string> = { [VOICE_DESIGN_LIBRARY_PATH]: encode(library) }
    const context = await resolveAuthoringVoiceContext({ root, config: options.config })
    if (context.voice.library && context.voice.library !== VOICE_DESIGN_LIBRARY_PATH)
      fail('VOICE_DESIGN_LIBRARY_PATH_UNSUPPORTED')
    for (const voice of library.voices) {
      if (!voice.design)
        continue
      const trustedPrior = prior.voices.find(item => item.id === voice.id && item.version === voice.version && item.design)
      const expectedImplementations: AdvVoiceProfile['implementations'] = {}
      for (const [locale, binding] of Object.entries(voice.design.locales)) {
        for (const [providerId, definition] of Object.entries(binding.providers)) {
          const path = `${VOICE_DESIGN_PRESET_ROOT}/${voice.id}/${voice.version}/${locale}/${providerId}.json`
          const source = incoming[path] ?? current[path]
          if (!source)
            fail('VOICE_DESIGN_PRESET_UNTRUSTED')
          const preset = JSON.parse(source) as JsonObject
          if (trustedPrior) {
            // Already approved immutable versions retain their original model
            // and parameters when an operator upgrades a template. Clients may
            // only carry the same pinned original bytes forward.
            if (!current[path] || source !== current[path])
              fail('VOICE_DESIGN_PRESET_UNTRUSTED')
          }
          else {
            const provider = context.providers.find(item => item.id === providerId)
            if (!provider || !('synthesize' in provider) || !provider.buildDesignPreset || !provider.capabilities.designSources?.includes(definition.source))
              fail('VOICE_DESIGN_CAPABILITY_UNSUPPORTED')
            if (definition.source === 'system' && !(await provider.listVoices?.())?.some(item => item.id === definition.providerVoiceId))
              fail('VOICE_DESIGN_BUILTIN_UNSUPPORTED')
            const coordinate = context.voice.presets[definition.preset]
            const owner = context.voice.presetProviders?.[definition.preset] ?? context.voice.defaultProvider ?? context.providers[0]?.id
            if (!coordinate || owner !== providerId || coordinate.includes('\\') || coordinate.includes(':') || coordinate.split('/').some(part => !part || ['.', '..', '.git', 'node_modules'].includes(part.toLowerCase())))
              fail('VOICE_DESIGN_TEMPLATE_UNCONFIGURED')
            const templatePath = await realpath(resolve(root, coordinate))
            const relativePath = relative(root, templatePath)
            const info = await stat(templatePath)
            if (isAbsolute(relativePath) || relativePath === '..' || relativePath.startsWith('../') || !info.isFile() || info.size > 1024 * 1024)
              fail('VOICE_DESIGN_TEMPLATE_UNCONFIGURED')
            const template = JSON.parse(await readFile(templatePath, 'utf8')) as JsonObject
            const derived = await provider.buildDesignPreset({ template, characterId: voice.characterId, text: '这是音色试听。', locale, intent: voice.design.intent, definition })
            for (const key of ['model', 'revision', 'weightSha256']) {
              if (canonicalAudioJson(derived[key] ?? null) !== canonicalAudioJson(template[key] ?? null))
                fail('VOICE_DESIGN_MODEL_IMMUTABLE')
            }
            if (canonicalAudioJson(preset) !== canonicalAudioJson(derived))
              fail('VOICE_DESIGN_PRESET_UNTRUSTED')
          }
          const name = `design-${voice.id}-${locale}`
          const implementation = expectedImplementations[providerId] ?? { preset: name, character: voice.characterId, presetPath: path, presetSha256: digest(source), ...(definition.reference?.mode ? { referenceMode: definition.reference.mode } : {}), localePresets: {} }
          implementation.localePresets![locale] = { preset: name, presetPath: path, presetSha256: digest(source) }
          expectedImplementations[providerId] = implementation
          output[path] = source
          for (const sample of voice.design.samples.filter(sample => sample.locale === locale && sample.providerId === providerId)) {
            if (sample.model !== preset.model || sample.source !== definition.source || sample.presetSha256 !== digest(source) || (definition.source === 'system' && sample.providerVoiceId !== definition.providerVoiceId))
              fail('VOICE_DESIGN_SAMPLE_PROVENANCE_INVALID')
          }
        }
      }
      if (canonicalAudioJson(expectedImplementations) !== canonicalAudioJson(voice.implementations))
        fail('VOICE_DESIGN_PRESET_UNTRUSTED')
    }
    for (const path of Object.keys(incoming).filter(path => path.startsWith('authoring/voices/'))) {
      if (!(path in output))
        fail('VOICE_DESIGN_PRESET_UNREFERENCED')
    }
    return output
  }
}
