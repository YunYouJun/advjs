import type { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import JSZip from 'jszip'
import { createStudioVoiceService } from '../../../../../packages/advjs/node/audio/server'
import { createNodeVoiceAuthoringService } from '../../../../../packages/advjs/node/audio/voice'
import { loadProject } from '../../../../../packages/advjs/node/project'
import { createEditorVoiceDesignFixture } from '../../../../../tests/fixtures/audio/editor-voice-design'
import { buildStudioNativeHandoff } from './handoff'

export async function startStudioDesignFlowFixture() {
  const fixture = await createEditorVoiceDesignFixture()
  const lineId = (index: number) => `line_019d137e-7abc-7000-8000-00000000000${index}`
  const files: Record<string, string> = {
    'adv.config.json': JSON.stringify({ schemaVersion: 1, id: 'design-flow', root: 'adv', format: 'flow', entryChapterId: 'intro' }),
    'adv/settings/game.json': JSON.stringify({ title: '声音与分支', locale: 'zh-CN', variables: { routeEnabled: true }, characters: [{ id: 'hero', name: 'Hero', voiceProfile: fixture.profile }] }),
    'adv/chapters/intro.chapter.json': `${JSON.stringify({ schemaVersion: 1, id: 'intro', title: '声音与分支', startNodeId: 'music', notes: { retained: 'author-layout-proof' }, nodes: [
      { id: 'music', type: 'audio', operations: [{ type: 'bgm', action: 'set', asset: 'bgm/fixture', gain: 0.25 }], next: 'speech' },
      { id: 'speech', type: 'dialogues', dialogues: [{ speakerId: 'hero', text: '初始 JSON 对白。', lineId: lineId(1), actorNote: 'retain-line-proof' }], next: 'route' },
      { id: 'route', type: 'choices', next: null, choices: [{ id: 'left', text: '走左侧', when: 'routeEnabled == true', target: 'left-end' }, { id: 'right', text: '走右侧', target: 'right-end' }] },
      { id: 'left-end', type: 'narration', text: '进入左侧分支。', lineId: lineId(2), next: 'end' },
      { id: 'right-end', type: 'narration', text: '进入右侧分支。', lineId: lineId(3), next: 'end' },
      { id: 'end', type: 'end' },
    ] }, null, 2)}\n`,
    'adv/chapters/retained.adv.md': '旧镜像不能参与 Flow 编译。',
    'adv/assets.json': JSON.stringify({ schemaVersion: 2, id: 'design-flow-assets', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public/media' } }, assets: [{ id: 'reference/original', type: 'audio', kind: 'reference', path: 'reference.wav', title: '本地原创授权参考', sha256: fixture.sha256, bytes: fixture.bytes.length, mimeType: 'audio/wav', duration: 1, characterId: 'hero' }, { id: 'bgm/fixture', type: 'audio', kind: 'bgm', path: 'music.wav', sha256: fixture.sha256, bytes: fixture.bytes.length, mimeType: 'audio/wav', duration: 1 }] }),
    'adv/audio/voice-profiles.json': await readFile(join(fixture.root, 'adv/audio/voice-profiles.json'), 'utf8'),
    'authoring/rights/original.json': await readFile(join(fixture.root, 'authoring/rights/original.json'), 'utf8'),
  }
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(fixture.root, path)), { recursive: true })
    await writeFile(join(fixture.root, path), content)
  }
  await writeFile(join(fixture.root, 'public/media/music.wav'), fixture.bytes)
  const providerSynthesis = fixture.provider.synthesize
  let hold = false
  let release: (() => void) | undefined
  fixture.provider.synthesize = async (input) => {
    if (hold) {
      // The supplier has already accepted this attempt. Cancelling it is unknown.
      fixture.calls.push(input)
      await new Promise<void>((done, reject) => {
        release = done
        input.signal?.addEventListener('abort', () => reject(new Error('supplier outcome unknown')), { once: true })
      })
      fixture.calls.pop()
    }
    return await providerSynthesis(input)
  }
  const service = await createStudioVoiceService({ host: '127.0.0.1', port: 3393, stateDirectory: fixture.storeDirectory, allowedOrigins: ['http://127.0.0.1:3392'], authenticate: async token => token === 'fixture-session' ? { accountId: 'fixture-author' } : undefined, projects: [{ accountId: 'fixture-author', projectId: 'design-flow-project', root: fixture.root, config: fixture.config }] })
  await service.start()
  const native = await createNodeVoiceAuthoringService({ root: fixture.root, config: fixture.config })
  let handoffRoot: string | undefined
  let handoffPlayer: Awaited<ReturnType<typeof buildStudioNativeHandoff>> | undefined
  async function handoff(buffer: Buffer) {
    if (buffer.length > 8 * 1024 * 1024)
      throw new Error('Fixture export exceeds limit')
    const zip = await JSZip.loadAsync(buffer)
    handoffRoot = await mkdtemp(join(tmpdir(), 'advjs-studio-design-flow-export-'))
    const exportedPaths: string[] = []
    for (const entry of Object.values(zip.files)) {
      if (entry.dir || entry.name === 'manifest.json')
        continue
      if (entry.name.startsWith('/') || entry.name.includes('\\') || entry.name.split('/').some(part => ['.', '..', 'node_modules'].includes(part)))
        throw new Error('Invalid fixture export')
      const path = join(handoffRoot, entry.name)
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, await entry.async('nodebuffer'))
      exportedPaths.push(entry.name)
    }
    await handoffPlayer?.close()
    await writeFile(join(handoffRoot, 'package.json'), JSON.stringify({ private: true, type: 'module', name: 'studio-design-flow-handoff', dependencies: { 'advjs': 'workspace:*', '@advjs/theme-default': 'workspace:*' } }))
    await symlink(resolve(import.meta.dirname, '../../../../../node_modules'), join(handoffRoot, 'node_modules'), 'dir')
    const checked = await loadProject({ root: handoffRoot, allowEmptyAssetManifest: true })
    handoffPlayer = await buildStudioNativeHandoff(handoffRoot)
    return { root: handoffRoot, diagnostics: checked.result.diagnostics, chapterIds: checked.result.project.chapters.map(chapter => chapter.id), program: checked.result.project.program, files: exportedPaths.sort(), check: handoffPlayer.check, build: handoffPlayer.build, playerUrl: handoffPlayer.playerUrl }
  }
  return { files, bytes: fixture.bytes, handoff, async status() {
    return { snapshot: await native.read(), calls: fixture.calls.map(call => ({ text: call.text, voiceId: call.voiceId, voiceVersion: call.voiceVersion, preset: call.preset })), root: fixture.root, handoffRoot }
  }, hold() {
    hold = true
  }, release() {
    hold = false
    release?.()
  }, async close() {
    release?.()
    await handoffPlayer?.close()
    await service.stop()
    await rm(fixture.directory, { recursive: true, force: true })
  } }
}
