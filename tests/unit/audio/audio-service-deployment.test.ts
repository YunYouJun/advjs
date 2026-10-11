// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import COS from 'cos-nodejs-sdk-v5'
import { describe, expect, it } from 'vitest'
import { acquireAudioServiceInstance, audioServiceProjectScope, createScopedStsAuthorization, prepareAudioServiceVolume, readAudioServiceJson, validateAudioServiceConfiguration, verifyAudioServiceVolume } from '../../../apps/studio/cloudbase/audio-service/configuration.mjs'
import { CosStorage } from '../../../plugins/plugin-cos/src'
import { createCosHttpFixture } from '../../fixtures/audio/cos-http'

function config(root = '/srv/advjs-audio') {
  return {
    schemaVersion: 1,
    cloudbase: { envId: 'advjs-test-123' },
    host: '0.0.0.0',
    port: 3389,
    allowedOrigins: ['https://studio.example.com'],
    allowedHosts: ['audio.example.com'],
    persistence: { root, volumeId: 'operator-volume', singleInstance: true },
    stateDirectory: `${root}/private`,
    projects: [{ accountId: 'registered-user', projectId: 'registered-project', root: `${root}/projects/one`, voice: { providers: ['openai-tts'], defaultProvider: 'openai-tts', presets: { openai: 'authoring/voices/operator-openai.json' }, presetProviders: { openai: 'openai-tts' }, defaultPreset: 'openai' } }],
    publication: { bucket: 'test-only-1234567890', region: 'ap-shanghai', publicBaseUrl: 'https://media.example.com/', deploymentPrefix: 'games/acceptance-20261012/v1', approvedToolchains: '/etc/advjs/toolchains.json', stsDirectory: '/run/secrets/cos' },
  }
}

describe('operator audio service deployment boundaries', () => {
  it('uses one existing provider protocol and isolates COS prefixes by actual account/project identity', () => {
    const configuration = validateAudioServiceConfiguration(config(), { platform: 'linux', arch: 'x64' })
    const first = audioServiceProjectScope(configuration, 'registered-user', 'registered-project')
    expect(first).toMatch(/^games\/acceptance-20261012\/v1\/[a-f0-9]{64}$/u)
    expect(first).not.toContain('registered-user')
    expect(audioServiceProjectScope(configuration, 'other-user', 'registered-project')).not.toBe(first)
    expect(audioServiceProjectScope(configuration, 'registered-user', 'other-project')).not.toBe(first)
  })

  it.each(['origin', 'host', 'secret', 'state', 'project', 'provider', 'preset', 'persistence'] as const)('rejects an unsafe operator %s configuration', (change) => {
    const input = config()
    if (change === 'origin')
      input.allowedOrigins = ['https://studio.example.com/path']
    else if (change === 'host')
      input.allowedHosts = ['*.example.com']
    else if (change === 'secret')
      Object.assign(input.projects[0]!.voice, { apiKey: 'test-only-key-must-not-be-accepted' })
    else if (change === 'state')
      input.stateDirectory = `${input.projects[0]!.root}/private`
    else if (change === 'project')
      input.projects.push({ ...input.projects[0]!, accountId: 'other-user' })
    else if (change === 'provider')
      input.projects[0]!.voice.providers.push('unknown-provider')
    else if (change === 'preset')
      input.projects[0]!.voice.presets.openai = 'authoring/voices/../../private.json'
    else
      input.persistence.singleInstance = false
    expect(() => validateAudioServiceConfiguration(input)).toThrow(/ADV_AUDIO_DEPLOY_/u)
  })

  it('permits Qwen only on the actual supported Mac execution platform', () => {
    const input = config()
    input.projects[0]!.voice.providers.push('qwen-tts')
    expect(() => validateAudioServiceConfiguration(input, { platform: 'linux', arch: 'arm64' })).toThrow('QWEN_HOST_UNSUPPORTED')
    expect(() => validateAudioServiceConfiguration(input, { platform: 'darwin', arch: 'x64' })).toThrow('QWEN_HOST_UNSUPPORTED')
    expect(validateAudioServiceConfiguration(input, { platform: 'darwin', arch: 'arm64' }).projects[0]!.voice.providers).toContain('qwen-tts')
  })

  it('requires explicit empty-volume preparation, records the actual device and prevents a second instance', async () => {
    const root = join(homedir(), '.cache', `advjs-deployment-test-${randomUUID()}`)
    await mkdir(root, { recursive: true, mode: 0o700 })
    let release: (() => void) | undefined
    try {
      const configuration = config(root)
      delete (configuration as { publication?: unknown }).publication
      await expect(verifyAudioServiceVolume(configuration)).rejects.toThrow()
      await prepareAudioServiceVolume(root, configuration.persistence.volumeId)
      expect(JSON.parse(await readFile(join(root, '.advjs-audio-volume.json'), 'utf8'))).toMatchObject({ schemaVersion: 1, volumeId: configuration.persistence.volumeId, device: String((await stat(root)).dev) })
      await mkdir(configuration.stateDirectory)
      await mkdir(configuration.projects[0]!.root, { recursive: true })
      await verifyAudioServiceVolume(configuration)
      release = acquireAudioServiceInstance(root)
      expect(() => acquireAudioServiceInstance(root)).toThrow('SINGLE_INSTANCE_REQUIRED')
      release()
      release = acquireAudioServiceInstance(root)
      await expect(prepareAudioServiceVolume(root, configuration.persistence.volumeId)).rejects.toThrow('EMPTY_PERSISTENT_VOLUME_REQUIRED')
      await writeFile(join(root, '.advjs-audio-volume.json'), JSON.stringify({ schemaVersion: 1, volumeId: configuration.persistence.volumeId, device: 'not-the-current-device' }))
      await expect(verifyAudioServiceVolume(configuration)).rejects.toThrow('VOLUME_INVALID')
    }
    finally {
      release?.()
      await rm(root, { recursive: true, force: true })
    }
  })

  it('refuses temporary storage even when an operator attempts explicit initialization', async () => {
    const root = join(tmpdir(), `advjs-deployment-test-${randomUUID()}`)
    await mkdir(root)
    try {
      await expect(prepareAudioServiceVolume(root, 'test-volume')).rejects.toThrow('EMPTY_PERSISTENT_VOLUME_REQUIRED')
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('reads refreshed bounded STS records per scope and rejects missing tokens, expiration and cross-project requests', async () => {
    let token = 'test-only-token-one'
    let expires = 1_800_000_100
    let reads = 0
    const parameters = { bucket: 'test-only-1234567890', region: 'ap-shanghai', projectPrefix: 'games/fresh/scope', now: () => 1_800_000_000, async readCredentials() {
      reads++
      return { bucket: 'test-only-1234567890', region: 'ap-shanghai', projectPrefix: 'games/fresh/scope', TmpSecretId: 'test-only-sts-id', TmpSecretKey: 'test-only-sts-key', SecurityToken: token, StartTime: 1_799_999_990, ExpiredTime: expires }
    } }
    const authorize = createScopedStsAuthorization(parameters)
    function request(Key = 'games/fresh/scope/audio/voice/file.webm', Method = 'PUT', Query = {}) {
      return new Promise<Record<string, unknown>>(resolve => authorize({ Bucket: parameters.bucket, Region: parameters.region, Key, Method, Query }, resolve))
    }
    expect(await request()).toMatchObject({ SecurityToken: token, ScopeLimit: true })
    token = 'test-only-token-refreshed'
    expect(await request()).toMatchObject({ SecurityToken: token })
    expect(reads).toBe(2)
    token = 'test-only-opaque-sts-token'.repeat(40)
    expect(await request()).toMatchObject({ SecurityToken: token })
    const canonicalVoiceKey = `${parameters.projectPrefix}/audio/voice/zh-cn/${'hero'.repeat(30)}/line_${'a'.repeat(40)}/take_${'b'.repeat(40)}.${'c'.repeat(64)}.m4a`
    expect(canonicalVoiceKey.length).toBeGreaterThan(256)
    expect(await request(canonicalVoiceKey)).toMatchObject({ SecurityToken: token })
    expect(await request('games/another-project/file.webm')).toEqual({})
    expect(await request(canonicalVoiceKey, 'PUT', { acl: '' })).toEqual({})
    expect(await request('', 'GET', { list: '' })).toEqual({})
    expect(await request('', 'GET', { versioning: '' })).toMatchObject({ SecurityToken: token })
    token = ''
    expect(await request()).toEqual({})
    token = 'test-only-token'
    expires = parameters.now() + 30
    expect(await request()).toEqual({})
  })

  it('requires bounded private regular credential files without returning malformed input', async () => {
    const root = join(tmpdir(), `advjs-deployment-test-${randomUUID()}`)
    await mkdir(root)
    const path = join(root, 'sts.json')
    try {
      await writeFile(path, JSON.stringify({ SecurityToken: 'test-only-token' }), { mode: 0o600 })
      expect(await readAudioServiceJson(path, 1024, true)).toEqual({ SecurityToken: 'test-only-token' })
      await expect(readAudioServiceJson(path, 1, true)).rejects.toThrow('FILE_INVALID')
      await writeFile(path, 'malformed JSON')
      await expect(readAudioServiceJson(path)).rejects.toThrow('JSON_INVALID')
    }
    finally { await rm(root, { recursive: true, force: true }) }
  })

  it('uses the scoped refresh adapter with actual COS SDK versioning, PUT and pinned GET requests', async () => {
    const cos = await createCosHttpFixture()
    const now = Math.floor(Date.now() / 1000)
    const projectPrefix = 'games/fresh-test/registered-scope'
    try {
      const getAuthorization = createScopedStsAuthorization({ bucket: 'test-only-1234567890', region: 'ap-test', projectPrefix, async readCredentials() {
        return { bucket: 'test-only-1234567890', region: 'ap-test', projectPrefix, TmpSecretId: 'test-only-sts-id', TmpSecretKey: 'test-only-sts-key', SecurityToken: 'test-only-token', StartTime: now - 10, ExpiredTime: now + 3600 }
      } })
      const client = new COS({ Protocol: 'http:', Domain: new URL(cos.url).host, FollowRedirect: false, getAuthorization })
      const storage = new CosStorage({ client, bucket: 'test-only-1234567890', region: 'ap-test', prefix: '' })
      const key = `${projectPrefix}/audio/voice/example.01234567.webm`
      const bytes = new TextEncoder().encode('actual local SDK transport')
      await storage.putBytes(key, bytes, { forbidOverwrite: true })
      const info = await storage.head(key)
      expect(new Uint8Array(await storage.readBytes(key, bytes.length, { ifMatch: info!.etag }))).toEqual(bytes)
      const before = cos.requests.length
      await expect(storage.head('games/another-project/private.webm')).rejects.toThrow()
      expect(cos.requests).toHaveLength(before)
      expect(cos.requests.find(request => request.method === 'PUT')!.headers['x-cos-security-token']).toBe('test-only-token')
    }
    finally { await cos.close() }
  })
})
