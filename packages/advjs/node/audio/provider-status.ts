import type { AdvConfig, AdvVoiceCapabilities, VoiceProviderDiagnosis, VoiceProviderStatusPort } from '@advjs/types'
import { realpath } from 'node:fs/promises'
import { resolve } from 'pathe'
import { resolveAuthoringVoiceContext, runVoiceDoctor } from '../commands/voice'
import { loadAdvConfig } from '../config'
import { readVoiceProviderState } from './provider-state'

const checkDescriptions: Record<string, string> = {
  'platform': 'Platform compatibility.',
  'environment': 'Prepared Python environment.',
  'uv': 'Python environment manager availability.',
  'runtime': 'Installed runtime dependency versions.',
  'model-cache': 'Local model cache presence; selected weights remain unverified.',
  'loaded-model': 'Local Breeze model loading status; weight revision remains unverified.',
  'credentials': 'Host credential configuration; remote access and quota remain unverified.',
  'connectivity': 'Remote service access, account permissions, and quota remain unverified.',
  'diagnostics': 'Provider diagnostic support.',
}

/** Copy only the declared capability fields; never serialize an executable provider. */
function capabilities(value: AdvVoiceCapabilities): AdvVoiceCapabilities {
  return {
    backend: value.backend,
    synthesis: value.synthesis,
    voiceCreation: value.voiceCreation,
    offline: value.offline,
    ...(value.alignment === undefined ? {} : { alignment: value.alignment }),
    ...(value.designSources ? { designSources: [...value.designSources] } : {}),
    ...(value.referenceModes ? { referenceModes: [...value.referenceModes] } : {}),
    models: value.models.map(model => ({ id: model.id, modes: [...model.modes], formats: [...model.formats], streaming: model.streaming, ...(model.maxTextCharacters === undefined ? {} : { maxTextCharacters: model.maxTextCharacters }) })),
  }
}

/** Reuses the CLI registry. Reading this service never runs diagnostics or scans model directories. */
export function createVoiceProviderStatus(options: { root: string, config?: Partial<AdvConfig> }): VoiceProviderStatusPort {
  async function registry(signal?: AbortSignal) {
    signal?.throwIfAborted()
    const root = await realpath(resolve(options.root))
    const { config } = await loadAdvConfig({ userRoot: root, advConfig: options.config })
    const voice = config.authoring?.voice
    if (!voice || (!voice.provider && Array.isArray(voice.providers) && !voice.providers.length) || (!voice.provider && voice.providers === undefined))
      return { root, config, providers: [] }
    const loaded = await resolveAuthoringVoiceContext({ root, config, allowDisabled: true, signal })
    signal?.throwIfAborted()
    return { root, config, providers: loaded.providers }
  }
  return {
    async read(signal) {
      const loaded = await registry(signal)
      const disabled = await readVoiceProviderState(loaded.root)
      signal?.throwIfAborted()
      return {
        configured: loaded.providers.length > 0,
        providers: loaded.providers.map(provider => ({
          id: provider.id,
          enabled: !disabled.includes(provider.id),
          diagnostics: typeof provider.doctor === 'function',
          ...('capabilities' in provider ? { capabilities: capabilities(provider.capabilities) } : {}),
        })),
      }
    },
    async doctor(providerId, signal) {
      if (typeof providerId !== 'string' || !providerId.trim() || providerId.length > 128)
        throw new Error('VOICE_PROVIDER_STATUS_INPUT_INVALID')
      const loaded = await registry(signal)
      const provider = loaded.providers.find(item => item.id === providerId)
      const result = (state: VoiceProviderDiagnosis['state'], checks: VoiceProviderDiagnosis['checks'] = []): VoiceProviderDiagnosis => ({ providerId, state, checkedAt: new Date().toISOString(), checks })
      if (!provider)
        return result('unconfigured')
      if ((await readVoiceProviderState(loaded.root)).includes(providerId))
        return result('disabled')
      if (!provider.doctor)
        return result('diagnostics-unavailable')
      const bounded = AbortSignal.any([AbortSignal.timeout(20_000), ...(signal ? [signal] : [])])
      let cancel: (() => void) | undefined
      try {
        const diagnosis = await Promise.race([
          runVoiceDoctor({ root: loaded.root, config: loaded.config, provider: providerId, signal: bounded }),
          new Promise<never>((_resolve, reject) => {
            cancel = () => reject(new Error('VOICE_PROVIDER_DIAGNOSTICS_ABORTED'))
            bounded.addEventListener('abort', cancel, { once: true })
            if (bounded.aborted)
              cancel()
          }),
        ])
        signal?.throwIfAborted()
        return result(!diagnosis.supported ? 'unsupported' : diagnosis.ready ? 'ready' : 'not-ready', diagnosis.checks.slice(0, 32).map((check, index) => {
          const known = Object.hasOwn(checkDescriptions, check.id)
          return {
            id: known ? check.id : `additional-${index + 1}`,
            status: ['pass', 'warn', 'fail'].includes(check.status) ? check.status : 'fail',
            message: known ? checkDescriptions[check.id]! : 'Additional provider diagnostic.',
          }
        }))
      }
      catch {
        signal?.throwIfAborted()
        // Provider exceptions may contain commands, local paths, or credentials.
        throw new Error('VOICE_PROVIDER_DIAGNOSTICS_FAILED')
      }
      finally {
        if (cancel)
          bounded.removeEventListener('abort', cancel)
      }
    },
  }
}
