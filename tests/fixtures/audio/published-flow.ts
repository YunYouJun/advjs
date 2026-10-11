import type { AdvAssetEntry, AdvAssetManifest, AudioApprovedToolchainProfile, CharacterVoiceProfile } from '@advjs/types'
import { createHash } from 'node:crypto'
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, join, relative, resolve } from 'node:path'
import { audioFingerprint } from '@advjs/audio'
import { advBuild, createNodeAudioPublicationHost, createNodeVoiceAuthoringService, probeAudioToolchain, runAudioProcess } from 'advjs/node'
import { createCosHttpFixture } from './cos-http'

export interface PublishedFlowVariant {
  objectKey: string
  sha256: string
  bytes: number
  mimeType: string
}
export interface PublishedFlowAsset {
  id: string
  kind: string
  sha256: string
  variants: Record<'opus' | 'aac', PublishedFlowVariant>
}

export const publishedFlowPrivateMarker = 'PRIVATE-FLOW-AUTHOR-VOICE-INTENT'
export const publishedFlowLineId = 'line_019d137e-7abc-7000-8000-000000000001'
const firstLine = 'What... what happened last night? Why do I feel so strange?'
const demoRoot = resolve(import.meta.dirname, '../../../demo/flow')
const digest = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex')
const mediaTypes: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
}

/** Serve only the actual production artifact, with strict missing-resource 404s. */
async function productionServer(root: string) {
  const server = createServer(async (request, response) => {
    try {
      const path = decodeURIComponent(new URL(request.url!, 'http://127.0.0.1').pathname)
      const target = resolve(root, `.${path === '/' ? '/index.html' : path}`)
      const coordinate = relative(root, target)
      if (coordinate.startsWith('..') || coordinate.includes('\\')) {
        response.writeHead(400)
        response.end()
        return
      }
      // SPA fallback is limited to navigation routes, never missing binary files.
      const file = extname(target) ? target : join(root, 'index.html')
      const bytes = await readFile(file)
      response.writeHead(200, { 'content-type': mediaTypes[extname(file)] ?? 'application/octet-stream', 'content-length': bytes.byteLength })
      response.end(request.method === 'HEAD' ? undefined : bytes)
    }
    catch {
      response.writeHead(404)
      response.end()
    }
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()!
  if (typeof address === 'string')
    throw new Error('Published Flow fixture address invalid')
  return {
    url: `http://127.0.0.1:${address.port}`,
    async close() {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    },
  }
}

/** Original demo masters -> real FFmpeg -> COS SDK HTTP -> pinned ordinary build. */
export async function createPublishedFlowFixture() {
  const directory = await mkdtemp(join(tmpdir(), 'advjs-published-flow-'))
  const root = join(directory, 'project')
  await mkdir(root)
  for (const path of ['adv', 'public', 'adv.config.json', 'package.json'])
    await cp(join(demoRoot, path), join(root, path), { recursive: true })
  await symlink(join(demoRoot, 'node_modules'), join(root, 'node_modules'), 'dir')
  // Preserve the real monorepo's parent dependency fallback for copied setups.
  await symlink(resolve(demoRoot, '../../node_modules'), join(directory, 'node_modules'), 'dir')

  // An original synthetic test tone is an imported recording, never an actor's
  // voice or a model call. Private provenance must not enter the player build.
  const rights = { license: 'CC0-1.0', subject: 'Original synthetic demo test tone', consentRecord: 'adv/rights/original-tone.txt' }
  const profile: CharacterVoiceProfile = {
    intent: { speakingStyle: publishedFlowPrivateMarker },
    locales: { 'en-US': { providers: { 'fixture-recording': { voiceId: 'original-demo-tone', model: 'fixture-recording', source: 'recorded', rights } } } },
  }
  const characterPath = join(root, 'adv/characters/taki.character.md')
  await writeFile(characterPath, (await readFile(characterPath, 'utf8')).replace(/^---\n/u, `---\nvoiceProfile: ${JSON.stringify(profile)}\n`))
  await mkdir(join(root, 'adv/audio'), { recursive: true })
  await writeFile(join(root, 'adv/audio/voice-profiles.json'), JSON.stringify({ schemaVersion: 1, revision: 1, narrator: profile }))
  await writeFile(join(root, 'public/private-audio-evidence.json'), JSON.stringify({ marker: publishedFlowPrivateMarker }))
  await mkdir(join(root, 'adv/rights'), { recursive: true })
  await writeFile(join(root, rights.consentRecord), 'Original deterministic demo tone: permitted for this isolated playback test.')

  // A known 21-second voice exercises actual streaming Opus/AAC, including
  // WebKit's GainNode-safe AAC path. The three original demo WAVs stay intact.
  await runAudioProcess('ffmpeg', ['-nostdin', '-v', 'error', '-stream_loop', '-1', '-i', join(root, 'public/flow-placeholders/music.wav'), '-t', '21', '-c:a', 'pcm_s16le', join(root, 'voice-candidate.wav')])
  const voiceBytes = await readFile(join(root, 'voice-candidate.wav'))
  const native = await createNodeVoiceAuthoringService({ root })
  const initial = await native.read()
  const registered = await native.register({
    lineId: publishedFlowLineId,
    locale: 'en-US',
    speakerId: 'taki',
    displayText: firstLine,
    expectedRevision: initial.revision,
    candidate: { id: 'original-tone', provider: 'fixture-recording', characterId: 'taki', text: firstLine, path: 'voice-candidate.wav', sha256: digest(voiceBytes), bytes: voiceBytes.length, mimeType: 'audio/wav', durationSeconds: 21, sampleRate: 16000, model: 'fixture-recording', providerVoiceId: 'original-demo-tone' },
    assetPath: 'flow-selected-voice/first.wav',
    voiceProfileRevision: await audioFingerprint(profile),
    source: 'recorded',
    rights,
    parameters: { importedOriginalTestTone: true, privateMarker: publishedFlowPrivateMarker },
  })
  const voiceTake = registered.ledger.lines[publishedFlowLineId]!.locales['en-US']!.takes[0]!
  await native.select({ lineId: publishedFlowLineId, locale: 'en-US', takeId: voiceTake.id, expectedRevision: registered.revision })

  const catalog = JSON.parse(await readFile(join(root, 'adv/assets.json'), 'utf8')) as AdvAssetManifest
  const masters = catalog.assets.filter(asset => asset.type === 'audio')
  const immutableFiles = new Map<string, string>()
  for (const asset of masters)
    immutableFiles.set(`public/${asset.path}`, digest(await readFile(join(root, 'public', asset.path!))))
  for (const path of ['adv/assets.json', 'adv/chapters/intro.chapter.json', 'adv/characters/taki.character.md', 'adv/audio/voice-profiles.json', 'adv/audio/voice-ledger.json', rights.consentRecord])
    immutableFiles.set(path, digest(await readFile(join(root, path))))

  const toolchain = await probeAudioToolchain()
  if (!toolchain.ready)
    throw new Error('Published Flow fixture requires real FFmpeg Opus/AAC/loudnorm capabilities')
  // Explicit approval of this local test toolchain. No container execution claim.
  const approved: AudioApprovedToolchainProfile = { id: 'published-flow-fixture', ffmpegBuildFingerprint: toolchain.fingerprint, workerImageDigest: `sha256:${'b'.repeat(64)}` }
  await writeFile(join(root, 'adv/audio/toolchain.json'), JSON.stringify({ schemaVersion: 1, profileId: approved.id, ffmpegBuildFingerprint: approved.ffmpegBuildFingerprint, workerImageDigest: approved.workerImageDigest }))
  const cos = await createCosHttpFixture()
  const host = await createNodeAudioPublicationHost({ root, stateDirectory: join(directory, 'private-publication'), projectPrefix: 'fixture/published-flow', publicBaseUrl: cos.url, approvedProfiles: [approved], storage: cos.storage })
  let player: Awaited<ReturnType<typeof productionServer>> | undefined
  try {
    const review = await host.prepare({})
    if (review.assetCount !== 4 || review.objectCount !== 8)
      throw new Error('Published Flow fixture must process the three original masters and selected voice')
    const publication = await host.publish({ planId: review.planId, expectedSourceRevision: review.sourceRevision, expectedManifestRevision: null })
    const response = await fetch(publication.manifestUrl)
    const manifestBytes = new Uint8Array(await response.arrayBuffer())
    if (!response.ok || digest(manifestBytes) !== publication.revision)
      throw new Error('Published Flow fixture manifest verification failed')
    const manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) as { assets: PublishedFlowAsset[] }
    const build = await advBuild({ userRoot: root, audioManifest: publication.manifestUrl, audioManifestSha256: publication.revision, vite: { logLevel: 'silent' } })
    player = await productionServer(build.outDir)
    return {
      root,
      directory,
      catalog,
      masters: masters as Array<AdvAssetEntry & { path: string }>,
      immutableFiles,
      voiceTake,
      manifest,
      manifestBytes,
      publication,
      build,
      cos,
      url: player.url,
      async verifyImmutableFiles() {
        for (const [path, expected] of immutableFiles) {
          if (digest(await readFile(join(root, path))) !== expected)
            throw new Error(`Published Flow fixture mutated original author/master file: ${path}`)
        }
      },
      async close() {
        await player!.close()
        await host.close()
        await cos.close()
        await rm(directory, { recursive: true, force: true })
      },
    }
  }
  catch (error) {
    await player?.close()
    await host.close()
    await cos.close()
    await rm(directory, { recursive: true, force: true })
    throw error
  }
}
