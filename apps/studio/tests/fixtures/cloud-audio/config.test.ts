import { describe, expect, it } from 'vitest'
import { cloudAudioProjectUrl, readStudioCloudAudioGate } from './config'

const operator = {
  ADVJS_STUDIO_CLOUD_E2E: '1',
  ADVJS_STUDIO_CLOUD_URL: 'https://studio.example.org',
  ADVJS_STUDIO_CLOUD_AUDIO_URL: 'https://audio.example.org/deployed',
  ADVJS_STUDIO_CLOUD_PROJECT_ID: 'acceptance-project',
  ADVJS_STUDIO_CLOUD_ACCOUNT_ID: 'actual-account',
  ADVJS_STUDIO_CLOUD_STORAGE_STATE: '/private/operator/session.json',
}

describe('genuine cloud acceptance gate', () => {
  it('makes no remote operation without opt-in and explicitly identifies missing public config', () => {
    expect(readStudioCloudAudioGate({})).toMatchObject({ enabled: false })
    expect(readStudioCloudAudioGate({ ADVJS_STUDIO_CLOUD_E2E: '1' })).toMatchObject({ enabled: false, reason: expect.stringContaining('ADVJS_STUDIO_CLOUD_AUDIO_URL') })
  })
  it('keeps real cloud read-only unless its mutation phase is separately enabled', () => {
    const gate = readStudioCloudAudioGate(operator)
    expect(gate.enabled).toBe(true)
    if (!gate.enabled)
      throw new Error('gate missing')
    expect(gate.target).toMatchObject({ publish: false, generate: false, storageState: operator.ADVJS_STUDIO_CLOUD_STORAGE_STATE })
    expect(cloudAudioProjectUrl(gate.target)).toBe('https://audio.example.org/deployed/v1/audio/projects/acceptance-project')
  })
  it.each(['http://audio.example.org', 'https://127.0.0.1', 'https://audio.localhost', 'https://origin.trycloudflare.com', 'https://origin.ngrok-free.app', 'https://user:password@audio.example.org', 'https://audio.example.org?token=private'])('rejects a local, tunnel or credential-bearing cloud endpoint: %s', (url) => {
    expect(() => readStudioCloudAudioGate({ ...operator, ADVJS_STUDIO_CLOUD_AUDIO_URL: url })).toThrow('STUDIO_CLOUD_URL_INVALID')
  })
  it('never enables synthesis without cloud publication and an exact bounded target', () => {
    expect(() => readStudioCloudAudioGate({ ...operator, ADVJS_STUDIO_CLOUD_GENERATE: '1' })).toThrow('STUDIO_CLOUD_WRITE_REQUIRED')
    expect(() => readStudioCloudAudioGate({ ...operator, ADVJS_STUDIO_CLOUD_WRITE: '1', ADVJS_STUDIO_CLOUD_MEDIA_ORIGIN: 'https://media.example.org', ADVJS_STUDIO_CLOUD_GENERATE: '1' })).toThrow('STUDIO_CLOUD_GENERATION_TARGET_REQUIRED')
    expect(() => readStudioCloudAudioGate({ ...operator, ADVJS_STUDIO_CLOUD_MAX_CHARACTERS: '0' })).toThrow('STUDIO_CLOUD_BUDGET_INVALID')
  })
  it('requires the operator-reviewed take/asset/master identity for publication-only acceptance', () => {
    expect(() => readStudioCloudAudioGate({ ...operator, ADVJS_STUDIO_CLOUD_WRITE: '1', ADVJS_STUDIO_CLOUD_MEDIA_ORIGIN: 'https://media.example.org' })).toThrow('STUDIO_CLOUD_SELECTED_IDENTITY_REQUIRED')
    const gate = readStudioCloudAudioGate({ ...operator, ADVJS_STUDIO_CLOUD_WRITE: '1', ADVJS_STUDIO_CLOUD_MEDIA_ORIGIN: 'https://media.example.org', ADVJS_STUDIO_CLOUD_SELECTED_TAKE_ID: 'take_019d137e-7abc-7000-8000-00000000c001', ADVJS_STUDIO_CLOUD_SELECTED_ASSET_ID: 'audio_019d137e-7abc-7000-8000-00000000c001', ADVJS_STUDIO_CLOUD_MASTER_SHA256: 'a'.repeat(64) })
    expect(gate.enabled && gate.target).toMatchObject({ publish: true, generate: false, masterSha256: 'a'.repeat(64) })
  })
  it('requires an exact first line and actual conditional branch for static player acceptance', () => {
    expect(() => readStudioCloudAudioGate({ ...operator, ADVJS_STUDIO_CLOUD_PLAYER: '1' })).toThrow('STUDIO_CLOUD_PLAYER_TARGET_REQUIRED')
  })
})
