import type { AdvAssetManifest, AudioProcessingReceipt, VoiceLedger, VoiceTake, VoiceTakeSource } from '@advjs/types'
import type { AudioPublicationPort, AudioReleasePlan } from '../../../packages/audio/src/release'
import { describe, expect, it, vi } from 'vitest'
import { audioObjectKey } from '../../../packages/audio/src/object-key'
import { planAudioRelease, publishAudioRelease } from '../../../packages/audio/src/release'
import { assertAudioReleaseToolchain } from '../../../packages/audio/src/toolchain'

const hash = 'a'.repeat(64)
const otherHash = 'b'.repeat(64)
const lock = { schemaVersion: 1 as const, profileId: 'approved-v1', ffmpegBuildFingerprint: hash, workerImageDigest: `sha256:${hash}` }
const approved = [{ id: lock.profileId, ffmpegBuildFingerprint: hash, workerImageDigest: lock.workerImageDigest }]
const publication = { approvedProfiles: approved, expectedManifestRevision: null }
const receipt: AudioProcessingReceipt = {
  schemaVersion: 1,
  purpose: 'release',
  presetId: 'advjs-bgm-v1',
  masterSha256: hash,
  ffmpegBuildFingerprint: hash,
  toolchain: lock,
  outputs: (['opus', 'aac'] as const).map(variant => ({ variant, path: `.advjs/audio/release/音频/output.${variant}`, metadata: { sha256: hash, bytes: 120, mimeType: variant === 'opus' ? 'audio/webm' : 'audio/mp4', codec: variant, duration: 2, sampleRate: 48000, channels: 2, integratedLufs: -18, truePeakDb: -1 } })),
}
const nativeCatalog: AdvAssetManifest = { schemaVersion: 2, id: 'example', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public' } }, assets: [{ id: 'bgm/day', type: 'audio', kind: 'bgm', path: '音频/day.wav', sha256: hash, bytes: 240, mimeType: 'audio/wav' }] }

function publicCatalog(objects: AudioReleasePlan['objects'], source = nativeCatalog): AdvAssetManifest {
  return {
    schemaVersion: 2,
    id: 'example',
    defaultProfile: 'published',
    profiles: { published: { provider: 'http', baseUrl: 'https://example.com/' } },
    assets: source.assets.map(asset => ({ id: asset.id, type: 'audio', kind: asset.kind, variants: Object.fromEntries(objects.filter(object => object.assetId === asset.id).map(object => [object.variant, { objectKey: object.objectKey, sha256: object.sha256, bytes: object.bytes, mimeType: object.mimeType }])) })),
  }
}

function plan(value = receipt) {
  return planAudioRelease({ projectPrefix: 'games/example/v1', approvedProfiles: approved, sourceCatalog: nativeCatalog, assets: [{ assetId: 'bgm/day', kind: 'bgm', receipt: value }], manifest: objects => ({ objectKey: 'games/example/v1/manifests/assets.json', catalog: publicCatalog([...objects]) }) })
}

function voiceOptions(source: VoiceTakeSource = 'cloned') {
  const lineId = 'line_019b1ca0-0000-7000-8000-000000000001'
  const take: VoiceTake = { id: 'take_019b1ca0-0000-7000-8000-000000000002', assetId: 'audio_019b1ca0-0000-7000-8000-000000000003', sha256: hash, providerId: 'fake', voiceId: 'reference:guide', model: 'test', voiceProfileRevision: hash, inputFingerprint: hash, spokenText: 'Private reviewed dialogue', createdAt: '2026-10-11T00:00:00.000Z', source, ...(source === 'cloned' ? { rights: { subject: 'Guide actor', license: 'Project license', consentRecord: 'adv/rights/guide.md' } } : {}) }
  const sourceCatalog: AdvAssetManifest = { ...nativeCatalog, assets: [{ id: take.assetId, type: 'audio', kind: 'voice', path: 'audio/guide.wav', sha256: hash }] }
  const voiceLedger: VoiceLedger = { schemaVersion: 1, lines: { [lineId]: { speakerId: 'guide', displayText: take.spokenText, locales: { 'zh-CN': { selectedTake: take.id, takes: [take] } } } } }
  const input = { assetId: take.assetId, kind: 'voice' as const, receipt: { ...receipt, presetId: 'advjs-voice-v1', outputs: receipt.outputs.map(output => ({ ...output, metadata: { ...output.metadata, channels: 1, integratedLufs: -16 } })) }, locale: 'zh-CN', speakerId: 'guide', lineId, takeId: take.id }
  return {
    projectPrefix: 'games/example/v1',
    approvedProfiles: approved,
    sourceCatalog,
    voiceLedger,
    assets: [input],
    manifest: (objects: readonly AudioReleasePlan['objects'][number][]) => ({ objectKey: 'games/example/v1/manifests/assets.json', catalog: publicCatalog([...objects], sourceCatalog) }),
  }
}

/** A fake durable host store returns its own record, never echoes client JSON. */
function publicationPort(released: AudioReleasePlan) {
  const stored = new Map(released.assets.map(record => [record.source.assetId, structuredClone(record)]))
  const uploaded = new Set<string>()
  const events: string[] = []
  const port = {
    verifyProcessingReceipt: vi.fn<AudioPublicationPort['verifyProcessingReceipt']>(async (record, profiles) => {
      expect(profiles).toEqual(approved)
      const value = stored.get(record.source.assetId)
      if (!value)
        throw new Error('Missing durable receipt')
      events.push('receipt')
      return structuredClone(value)
    }),
    authorizeVoice: vi.fn<AudioPublicationPort['authorizeVoice']>(async () => { events.push('rights') }),
    verify: vi.fn<AudioPublicationPort['verify']>(async object => uploaded.has(object.objectKey) ? 'verified' : 'missing'),
    uploadImmutable: vi.fn<AudioPublicationPort['uploadImmutable']>(async (object) => {
      uploaded.add(object.objectKey)
      events.push('binary')
    }),
    commitManifest: vi.fn<AudioPublicationPort['commitManifest']>(async () => { events.push('manifest') }),
  }
  return { port, stored, events }
}

function expectNoStorageIo(port: ReturnType<typeof publicationPort>['port']) {
  expect(port.verify).not.toHaveBeenCalled()
  expect(port.uploadImmutable).not.toHaveBeenCalled()
  expect(port.commitManifest).not.toHaveBeenCalled()
}

function editManifest(released: AudioReleasePlan, edit: (catalog: AdvAssetManifest) => void) {
  const catalog = JSON.parse(released.manifest.content) as AdvAssetManifest
  edit(catalog)
  released.manifest.content = JSON.stringify(catalog)
}

describe('locked audio release', () => {
  it('places locale before speaker and keeps object keys ASCII while accepting canonical Unicode media paths', () => {
    const key = audioObjectKey({ projectPrefix: 'games/example/v1', kind: 'voice', assetId: 'voice/master', sha256: hash, extension: 'webm', locale: 'ZH-cn', speakerId: 'narrator', lineId: 'line_019b1ca0-0000-7000-8000-000000000001', takeId: 'take_019b1ca0-0000-7000-8000-000000000001' })
    expect(key).toContain('/audio/voice/zh-cn/narrator/line_')
    expect(() => audioObjectKey({ projectPrefix: '../secret', kind: 'sfx', assetId: 'door', sha256: hash, extension: 'wav' })).toThrow()
    expect(() => audioObjectKey({ projectPrefix: 'games/test', kind: 'sfx', assetId: '门', sha256: hash, extension: 'wav' })).toThrow()
    expect(plan().objects[0]!.path).toContain('/音频/')
    for (const path of ['/audio.wav', 'C:/audio.wav', 'audio\\bad.wav', 'audio//bad.wav', 'audio/../bad.wav', './bad.wav', '.git/bad.wav', 'audio/node_modules/bad.wav']) {
      const value = structuredClone(receipt)
      value.outputs[0]!.path = path
      expect(() => plan(value)).toThrow('PLAN_INVALID')
    }
  })

  it('blocks preview output, unknown worker digests and unmatched local builds before planning', () => {
    expect(() => plan({ ...receipt, purpose: 'preview' })).toThrow('PREVIEW_FORBIDDEN')
    expect(() => assertAudioReleaseToolchain(lock, otherHash, approved)).toThrow('BUILD_MISMATCH')
    expect(() => assertAudioReleaseToolchain({ ...lock, workerImageDigest: `sha256:${otherHash}` }, hash, approved)).toThrow('UNAPPROVED')
    expect(() => assertAudioReleaseToolchain(undefined, hash, approved)).toThrow()
    expect(() => planAudioRelease({ projectPrefix: 'games/example/v1', approvedProfiles: approved, sourceCatalog: { ...nativeCatalog, assets: [{ ...nativeCatalog.assets[0]!, kind: 'reference' }] }, assets: [{ assetId: 'bgm/day', kind: 'bgm', receipt }], manifest: () => {
      throw new Error('No public callback')
    } })).toThrow('SOURCE_INVALID')
  })

  it('verifies trusted receipts before objects and resumes without uploading completed immutable binaries', async () => {
    const released = plan()
    const { port, events } = publicationPort(released)
    await publishAudioRelease(released, port, publication)
    expect(events).toEqual(['receipt', 'binary', 'binary', 'manifest'])
    await publishAudioRelease(released, port, { ...publication, expectedManifestRevision: 'previous' })
    expect(port.uploadImmutable).toHaveBeenCalledTimes(2)
    expect(port.commitManifest).toHaveBeenLastCalledWith(released.manifest, 'previous', undefined)
    expect(port.verifyProcessingReceipt).toHaveBeenCalledTimes(2)
  })

  it('does not update a stable manifest when any uploaded object fails hash verification', async () => {
    const released = plan()
    const { port } = publicationPort(released)
    port.verify.mockResolvedValue('missing')
    await expect(publishAudioRelease(released, port, publication)).rejects.toThrow('UNVERIFIED')
    expect(port.commitManifest).not.toHaveBeenCalled()
  })

  it('requires execution-time approved profiles and a mandatory trusted receipt verifier', async () => {
    const released = plan()
    const { port } = publicationPort(released)
    await expect(publishAudioRelease(released, port, { ...publication, approvedProfiles: [] })).rejects.toThrow('PLAN_INVALID')
    await expect(publishAudioRelease(released, port, { ...publication, approvedProfiles: [{ ...approved[0]!, workerImageDigest: `sha256:${otherHash}` }] })).rejects.toThrow('UNAPPROVED')
    const absentVerifier = { ...port, verifyProcessingReceipt: undefined } as unknown as AudioPublicationPort
    await expect(publishAudioRelease(released, absentVerifier, publication)).rejects.toThrow('VERIFICATION_REQUIRED')
    expectNoStorageIo(port)
  })

  it('rechecks forged preview and unapproved receipts even when the plan was not produced by the planner', async () => {
    for (const mutation of ['preview', 'unapproved', 'kind', 'object'] as const) {
      const released = plan()
      const { port } = publicationPort(released)
      if (mutation === 'preview')
        released.assets[0]!.receipt.purpose = 'preview'
      if (mutation === 'unapproved')
        released.assets[0]!.receipt.toolchain!.workerImageDigest = `sha256:${otherHash}`
      if (mutation === 'kind')
        released.assets[0]!.source.kind = 'sfx'
      if (mutation === 'object')
        released.objects[0]!.objectKey = 'games/example/v1/audio/voice/forged.webm'
      await expect(publishAudioRelease(released, port, publication)).rejects.toThrow()
      expectNoStorageIo(port)
    }
  })

  it('rejects a consistent forged receipt by comparing the trusted durable host record before storage I/O', async () => {
    const released = plan()
    const { port } = publicationPort(released)
    released.assets[0]!.receipt.outputs[0]!.metadata.sha256 = otherHash
    released.objects[0]!.sha256 = otherHash
    released.objects[0]!.objectKey = audioObjectKey({ projectPrefix: released.projectPrefix, kind: 'bgm', assetId: 'bgm/day', sha256: otherHash, extension: 'webm' })
    editManifest(released, (catalog) => {
      const variant = catalog.assets[0]!.variants!.opus!
      variant.sha256 = otherHash
      variant.objectKey = released.objects[0]!.objectKey
    })
    await expect(publishAudioRelease(released, port, publication)).rejects.toThrow('RECEIPT_UNTRUSTED')
    expect(port.verifyProcessingReceipt).toHaveBeenCalledOnce()
    expectNoStorageIo(port)
  })

  it('verifies every receipt before uploading any object even if a later receipt is unavailable', async () => {
    const secondAsset = { ...nativeCatalog.assets[0]!, id: 'bgm/night', path: 'audio/night.wav' }
    const sourceCatalog = { ...nativeCatalog, assets: [...nativeCatalog.assets, secondAsset] }
    const released = planAudioRelease({ projectPrefix: 'games/example/v1', approvedProfiles: approved, sourceCatalog, assets: sourceCatalog.assets.map(asset => ({ assetId: asset.id, kind: 'bgm' as const, receipt })), manifest: objects => ({ objectKey: 'games/example/v1/manifests/assets.json', catalog: publicCatalog([...objects], sourceCatalog) }) })
    const { port, stored } = publicationPort(released)
    stored.delete(secondAsset.id)
    await expect(publishAudioRelease(released, port, publication)).rejects.toThrow('Missing durable receipt')
    expect(port.verifyProcessingReceipt).toHaveBeenCalledTimes(2)
    expectNoStorageIo(port)
  })

  it('rejects reference masters and extra unprocessed voice assets smuggled into the public manifest', async () => {
    for (const kind of ['reference', 'voice'] as const) {
      const released = plan()
      const { port } = publicationPort(released)
      editManifest(released, (catalog) => {
        catalog.assets.push({ id: `private/${kind}`, type: 'audio', kind, path: 'private/secret.wav' })
      })
      await expect(publishAudioRelease(released, port, publication)).rejects.toThrow(kind === 'reference' ? 'REFERENCE_FORBIDDEN' : 'MANIFEST_INVALID')
      expectNoStorageIo(port)
    }
  })

  it('requires the exact selected native dialogue take and does not fall back across locales', () => {
    const options = voiceOptions()
    expect(() => planAudioRelease({ ...options, voiceLedger: undefined })).toThrow('PROVENANCE_REQUIRED')
    const unselected = structuredClone(options.voiceLedger)
    unselected.lines[options.assets[0]!.lineId]!.locales['zh-CN']!.selectedTake = null
    expect(() => planAudioRelease({ ...options, voiceLedger: unselected })).toThrow('SELECTED_TAKE_REQUIRED')
    expect(() => planAudioRelease({ ...options, assets: [{ ...options.assets[0]!, locale: 'zh-TW' }] })).toThrow('SELECTED_TAKE_REQUIRED')
    expect(() => planAudioRelease({ ...options, assets: [{ ...options.assets[0]!, speakerId: 'different' }] })).toThrow('SELECTED_TAKE_REQUIRED')
  })

  it('keeps private rights and dialogue prose out of the public catalog and requires current host authorization', async () => {
    const released = planAudioRelease(voiceOptions())
    expect(JSON.stringify(released)).not.toContain('Private reviewed dialogue')
    expect(released.manifest.content).not.toContain('Guide actor')
    expect(released.manifest.content).not.toContain('consentRecord')
    const { port } = publicationPort(released)
    await expect(publishAudioRelease(released, { ...port, authorizeVoice: undefined }, publication)).rejects.toThrow('CONSENT_REQUIRED')
    port.authorizeVoice.mockImplementation(async () => {
      throw new Error('Consent record revoked')
    })
    await expect(publishAudioRelease(released, port, publication)).rejects.toThrow('revoked')
    expectNoStorageIo(port)
  })

  it('does not allow downgrading a cloned source to system in client authorizations', async () => {
    const released = planAudioRelease(voiceOptions())
    const { port } = publicationPort(released)
    released.assets[0]!.voice!.source = 'system'
    delete released.assets[0]!.voice!.rights
    released.voiceAuthorizations = [structuredClone(released.assets[0]!.voice!)]
    await expect(publishAudioRelease(released, port, publication)).rejects.toThrow('RECEIPT_UNTRUSTED')
    expectNoStorageIo(port)
  })

  it('does not allow changing a voice master into bgm to bypass selected binding and rights checks', async () => {
    const released = planAudioRelease(voiceOptions())
    const { port } = publicationPort(released)
    const record = released.assets[0]!
    record.source.kind = 'bgm'
    record.receipt = structuredClone(receipt)
    delete record.voice
    released.voiceAuthorizations = []
    released.objects = receipt.outputs.map(output => ({ assetId: record.source.assetId, variant: output.variant, path: output.path, objectKey: audioObjectKey({ projectPrefix: released.projectPrefix, kind: 'bgm', assetId: record.source.assetId, sha256: output.metadata.sha256, extension: output.variant === 'opus' ? 'webm' : 'm4a' }), sha256: output.metadata.sha256, bytes: output.metadata.bytes, mimeType: output.metadata.mimeType, cacheControl: 'public, max-age=31536000, immutable' }))
    editManifest(released, (catalog) => {
      catalog.assets[0]!.kind = 'bgm'
      for (const object of released.objects)
        catalog.assets[0]!.variants![object.variant]!.objectKey = object.objectKey
    })
    await expect(publishAudioRelease(released, port, publication)).rejects.toThrow('RECEIPT_UNTRUSTED')
    expectNoStorageIo(port)
  })

  it('requires current selected-binding authorization for system voices as well', async () => {
    const released = planAudioRelease(voiceOptions('system'))
    const { port, events } = publicationPort(released)
    await expect(publishAudioRelease(released, { ...port, authorizeVoice: undefined }, publication)).rejects.toThrow('CONSENT_REQUIRED')
    await publishAudioRelease(released, port, publication)
    expect(events).toEqual(['receipt', 'rights', 'binary', 'binary', 'manifest'])
  })

  it('publishes a verified snapshot even if the caller mutates its plan during trusted verification', async () => {
    const released = plan()
    const { port } = publicationPort(released)
    const verifyStored = port.verifyProcessingReceipt.getMockImplementation()!
    port.verifyProcessingReceipt.mockImplementation(async (record, profiles) => {
      released.objects[0]!.objectKey = 'games/example/v1/private/leaked.webm'
      return verifyStored(record, profiles)
    })
    await publishAudioRelease(released, port, publication)
    expect(port.uploadImmutable.mock.calls[0]![0].objectKey).toContain('/audio/bgm/')
  })
})
