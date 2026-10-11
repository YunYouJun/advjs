import type { VoiceDesignMutation, VoiceDesignPort, VoiceDesignPreview, VoiceDesignSnapshot } from '@advjs/types'
import type { IFileSystem } from './fs'
import type { ManagedVoiceClient } from './managedVoiceClient'
import { audioProjectMediaPath, canonicalAudioJson, parseVoiceDesignDraft, parseVoiceDesignLibrary, verifyVoiceCandidateBytes } from '@advjs/audio'
import { compileProject } from '@advjs/core'
import { commitStudioProjectFiles } from './nativeProjectMutation'

const NATIVE_DOCUMENT = /^(?:adv\.config\.json|adv\/settings\/game\.json|adv\/characters\/[\w./-]+\.character\.(?:md|json|ya?ml)|adv\/audio\/voice-profiles\.json|adv\/assets(?:\/[\w./-]+)?\.json|authoring\/voices\/(?:library\.json|designs\/[\w.-]+\/[\w.-]+\/[\w-]+\/[\w.-]+\.json))$/u
const acceptsPath = (path: string) => NATIVE_DOCUMENT.test(path) && !path.split('/').some(part => ['.', '..', '.git', 'node_modules'].includes(part))
function snapshot(value: VoiceDesignSnapshot): VoiceDesignSnapshot {
  canonicalAudioJson(value)
  parseVoiceDesignLibrary(value.library)
  if (!/^[a-f0-9]{64}$/u.test(value.revision) || !Array.isArray(value.providers) || !Array.isArray(value.speakers) || !Array.isArray(value.previews) || !Array.isArray(value.referenceAssets))
    throw new Error('VOICE_DESIGN_RESPONSE_INVALID')
  return value
}
function preview(value: VoiceDesignPreview) {
  canonicalAudioJson(value)
  if (!/^[\w-]+$/u.test(value.id) || !['queued', 'running', 'ready', 'registered', 'cancelled', 'failed', 'unknown'].includes(value.status))
    throw new Error('VOICE_DESIGN_RESPONSE_INVALID')
  return value
}

/** Finite authenticated methods implement the shared Editor/Studio port verbatim. */
export function createStudioVoiceDesignPort(client: ManagedVoiceClient): VoiceDesignPort {
  async function mutation(suffix: string, input: unknown, signal?: AbortSignal) {
    const value = await client.request<VoiceDesignMutation>(`/voice-design/${suffix}`, 'POST', input, signal)
    snapshot(value.snapshot)
    canonicalAudioJson(value)
    if (!Array.isArray(value.changes))
      throw new Error('VOICE_DESIGN_RESPONSE_INVALID')
    return value
  }
  return {
    read: async signal => snapshot(await client.request('/voice-design', 'GET', undefined, signal)),
    saveVersion: (input, signal) => mutation('save', { ...input, draft: parseVoiceDesignDraft(input.draft) }, signal),
    planPreview: (input, signal) => client.request('/voice-design/plan', 'POST', input, signal),
    executePreview: async (input, signal) => preview(await client.request('/voice-design/execute', 'POST', input, signal)),
    readPreview: async (id, signal) => preview(await client.request(`/voice-design/previews/${id}`, 'GET', undefined, signal)),
    cancelPreview: async (id, signal) => preview(await client.request(`/voice-design/previews/${id}/cancel`, 'POST', {}, signal)),
    readPreviewAudio: async (id, signal) => {
      const value = await client.request<VoiceDesignPreview>(`/voice-design/previews/${id}`, 'GET', undefined, signal)
      if (!value.candidate || !value.mediaUrl || !['ready', 'registered'].includes(value.status))
        throw new Error('VOICE_DESIGN_AUDIO_UNAVAILABLE')
      const bytes = await client.media(value.mediaUrl, value.candidate.bytes, signal)
      await verifyVoiceCandidateBytes(value.candidate, bytes)
      return new Blob([bytes], { type: value.candidate.mimeType })
    },
    registerSample: (input, signal) => mutation('register', input, signal),
    selectSample: (input, signal) => mutation('select', input, signal),
    applyProfile: (input, signal) => mutation('apply', input, signal),
  }
}

/** Import reviewed server identities with original file comparisons and immutable media. */
export async function applyStudioVoiceDesignMutation(fs: IFileSystem, client: ManagedVoiceClient, value: VoiceDesignMutation, signal?: AbortSignal) {
  snapshot(value.snapshot)
  for (const change of value.changes) {
    if (!acceptsPath(change.path))
      throw new Error('VOICE_DESIGN_FILE_SCOPE_INVALID')
  }
  const files = Object.fromEntries((await fs.collectAllFiles()).map(file => [file.path, file.content]))
  const receipt = value.media
  if (receipt && files['authoring/voices/library.json']) {
    const library = parseVoiceDesignLibrary(files['authoring/voices/library.json'])
    const localSample = library.voices.flatMap(voice => voice.design?.samples ?? []).find(sample => sample.assetId === receipt.asset.id)
    const remoteSample = value.snapshot.library.voices.flatMap(voice => voice.design?.samples ?? []).find(sample => sample.assetId === receipt.asset.id)
    const current = await compileProject({ files }, { allowEmptyAssetManifest: true })
    const asset = current.project.assets?.assets.find(asset => asset.id === receipt.asset.id)
    if (localSample || asset) {
      if (!localSample || !remoteSample || !asset || canonicalAudioJson(localSample) !== canonicalAudioJson(remoteSample) || (['type', 'kind', 'path', 'sha256', 'bytes', 'mimeType', 'characterId'] as const).some(key => asset[key] !== receipt.asset[key]))
        throw new Error('VOICE_DESIGN_REGISTRATION_CONFLICT')
      const path = audioProjectMediaPath(current.project.assets!, asset)
      if (await fs.exists(path)) {
        await verifyVoiceCandidateBytes(receipt.candidate, await (await fs.readBlob(path)).arrayBuffer())
        client.assertCurrent()
        return
      }
      const bytes = await client.media(receipt.mediaUrl, receipt.candidate.bytes, signal)
      await verifyVoiceCandidateBytes(receipt.candidate, bytes)
      // Restore immutable media after metadata sync, without replaying an old
      // registration patch over subsequent author selections or asset labels.
      const guards = Object.entries(files).filter(([path]) => path === 'authoring/voices/library.json' || path === 'adv/assets.json' || path.startsWith('adv/assets/')).map(([path, content]) => ({ path, expected: content, content }))
      await commitStudioProjectFiles(fs, guards, { assertCurrent: client.assertCurrent, acceptsPath, media: { path, blob: new Blob([bytes], { type: receipt.candidate.mimeType }), sha256: receipt.candidate.sha256, bytes: receipt.candidate.bytes } })
      return
    }
  }
  // A receipt replay is a no-op only when the exact desired bytes are present.
  // Every changed value still compares against the host's original expected bytes.
  const changes = value.changes.map(change => files[change.path] === change.content ? { ...change, expected: change.content } : change)
  for (const change of changes) {
    if ((files[change.path] ?? null) !== change.expected)
      throw new Error('ADV_STUDIO_SOURCE_CONFLICT')
    if (change.content === null)
      delete files[change.path]
    else
      files[change.path] = change.content
  }
  if (files['authoring/voices/library.json'])
    parseVoiceDesignLibrary(files['authoring/voices/library.json'])
  const compilation = await compileProject({ files }, { allowEmptyAssetManifest: true })
  if (compilation.diagnostics.some(issue => issue.severity === 'error'))
    throw new Error('VOICE_DESIGN_NATIVE_PROJECT_INVALID')
  let media
  if (receipt) {
    const asset = compilation.project.assets?.assets.find(asset => asset.id === receipt.asset.id)
    // Compiler-normalized optional fields are undefined. Compare its JSON
    // projection with the receipt while retaining every defined asset field.
    if (!asset || asset.type !== 'audio' || asset.sha256 !== receipt.candidate.sha256 || asset.bytes !== receipt.candidate.bytes || canonicalAudioJson(JSON.parse(JSON.stringify(asset))) !== canonicalAudioJson(receipt.asset))
      throw new Error('VOICE_DESIGN_RECEIPT_INVALID')
    const path = audioProjectMediaPath(compilation.project.assets!, asset)
    const bytes = await client.media(receipt.mediaUrl, receipt.candidate.bytes, signal)
    await verifyVoiceCandidateBytes(receipt.candidate, bytes)
    media = { path, blob: new Blob([bytes], { type: receipt.candidate.mimeType }), sha256: receipt.candidate.sha256, bytes: receipt.candidate.bytes }
  }
  await commitStudioProjectFiles(fs, changes, { assertCurrent: client.assertCurrent, acceptsPath, media })
}
