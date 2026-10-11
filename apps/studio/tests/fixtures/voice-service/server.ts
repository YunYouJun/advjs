import { createHash } from 'node:crypto'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { probeAudioToolchain, runAudioProcess } from '../../../../../packages/advjs/node/audio/process'
import { createNodeAudioPublicationHost } from '../../../../../packages/advjs/node/audio/release'
import { createStudioVoiceService } from '../../../../../packages/advjs/node/audio/server'
import { createNodeVoiceAuthoringService } from '../../../../../packages/advjs/node/audio/voice'
import { createCosHttpFixture } from '../../../../../tests/fixtures/audio/cos-http'
import { createEditorVoiceJobsFixture } from '../../../../../tests/fixtures/audio/editor-voice-jobs'

/** Actual Node service and COS SDK HTTP, with a finite offline fixture provider. */
export async function startStudioVoiceServiceFixture() {
  const fixture = await createEditorVoiceJobsFixture()
  const cos = await createCosHttpFixture()
  await runAudioProcess('ffmpeg', ['-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.7', '-ar', '24000', join(fixture.root, 'tone.wav')])
  const tone = await readFile(join(fixture.root, 'tone.wav'))
  const hash = createHash('sha256').update(tone).digest('hex')
  const synthesize = fixture.provider.synthesize.bind(fixture.provider)
  fixture.provider.synthesize = async (input) => {
    const result = await synthesize(input)
    for (const candidate of result.candidates) {
      await writeFile(join(fixture.root, candidate.path), tone)
      candidate.sha256 = hash
      candidate.bytes = tone.length
      candidate.durationSeconds = 0.7
    }
    return result
  }
  fixture.provider.doctor = async () => ({ provider: fixture.provider.id, supported: true, ready: true, checks: [] })
  const toolchain = await probeAudioToolchain()
  const profile = { id: 'hosted-fixture', ffmpegBuildFingerprint: toolchain.fingerprint, workerImageDigest: `sha256:${'b'.repeat(64)}` }
  await writeFile(join(fixture.root, 'adv/audio/toolchain.json'), JSON.stringify({ schemaVersion: 1, profileId: profile.id, ffmpegBuildFingerprint: profile.ffmpegBuildFingerprint, workerImageDigest: profile.workerImageDigest }))
  const native = await createNodeVoiceAuthoringService({ root: fixture.root, config: fixture.config })
  const publication = await createNodeAudioPublicationHost({ root: fixture.root, stateDirectory: join(fixture.directory, 'private-release'), projectPrefix: 'fixture/hosted-project', publicBaseUrl: cos.url, approvedProfiles: [profile], storage: cos.storage })
  const service = await createStudioVoiceService({ host: '127.0.0.1', port: 3389, stateDirectory: fixture.storeDirectory, allowedOrigins: ['http://127.0.0.1:3388', 'http://localhost:3388'], authenticate: async token => token === 'fixture-session' ? { accountId: 'fixture-author' } : undefined, projects: [{ accountId: 'fixture-author', projectId: 'hosted-project', root: fixture.root, config: fixture.config }], publication: async () => publication })
  await service.start()
  let holding = false
  let release: (() => void) | undefined
  fixture.setBeforeSynthesis(async (input) => {
    if (!holding)
      return
    await new Promise<void>((done, reject) => {
      release = done
      input.signal?.addEventListener('abort', () => reject(new Error('fixture cancelled')), { once: true })
    })
  })
  const initialFiles = Object.fromEntries(await Promise.all(['adv.config.json', 'adv/settings/game.json', 'adv/assets.json', 'adv/audio/voice-profiles.json', 'adv/audio/toolchain.json'].map(async path => [path, await readFile(join(fixture.root, path), 'utf8')])))
  return { initialFiles, async status() {
    return { snapshot: await native.read(), calls: fixture.calls.map(call => ({ text: call.text, character: call.character })), objects: [...cos.objects].map(([key, object]) => ({ key, mimeType: object.headers['content-type'], bytes: object.bytes.length })), requests: cos.requests.map(request => ({ method: request.method, key: request.key })) }
  }, hold() {
    holding = true
  }, release() {
    holding = false
    release?.()
  }, async close() {
    release?.()
    await service.stop()
    await publication.close()
    await cos.close()
    await rm(fixture.directory, { recursive: true, force: true })
  } }
}
