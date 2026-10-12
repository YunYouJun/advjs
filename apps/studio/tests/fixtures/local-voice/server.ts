import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createLocalVoiceServiceOptions, createStudioVoiceService, loadProject } from 'advjs/node'
import { createEditorVoiceDesignFixture } from '../../../../../tests/fixtures/audio/editor-voice-design'

/** The product app connects to the real finite HTTP service, with no model calls. */
export async function startLocalVoiceFixture(projectId: string, origin: string, nativeFiles?: Record<string, string>) {
  const fixture = await createEditorVoiceDesignFixture()
  // This smoke starts with a new empty browser catalog. Reuse the provider's
  // design capability without importing the other fixture's reference asset.
  const catalogPath = join(fixture.root, 'adv/assets.json')
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
  catalog.assets = []
  await writeFile(catalogPath, JSON.stringify(catalog))
  for (const [path, content] of Object.entries(nativeFiles ?? {})) {
    await mkdir(join(fixture.root, path, '..'), { recursive: true })
    await writeFile(join(fixture.root, path), content)
  }
  let compiledLines: Array<{ lineId: unknown, speakerId: unknown }> = []
  if (nativeFiles) {
    fixture.config.format = 'flow'
    const loaded = await loadProject({ root: fixture.root, allowEmptyAssetManifest: true })
    const program = loaded.result.project.program
    if (!program || loaded.result.diagnostics.some(issue => issue.severity === 'error') || program.entry.chapterId !== 'intro')
      throw new Error(`VOICE_WORKFLOW_FIXTURE_INVALID: ${JSON.stringify(loaded.result.diagnostics)}`)
    compiledLines = Object.values(program.chapters).flatMap(chapter => Object.values(chapter.nodes).filter(node => node.kind === 'dialog').map(node => ({ lineId: node.data?.lineId, speakerId: node.data?.speakerId })))
    const chapter = JSON.parse(nativeFiles['adv/chapters/intro.chapter.json']!)
    const expected = chapter.nodes.flatMap((node: { dialogues?: Array<{ lineId: string, speaker: string }> }) => node.dialogues?.map(line => ({ lineId: line.lineId, speakerId: line.speaker })) ?? [])
    if (compiledLines.length !== 2 || JSON.stringify(compiledLines) !== JSON.stringify(expected))
      throw new Error('VOICE_WORKFLOW_FIXTURE_DIALOGUES_REQUIRED')
  }
  const accessToken = randomBytes(32).toString('hex')
  fixture.provider.doctor = async () => ({ provider: fixture.provider.id, supported: true, ready: true, checks: [] })
  let publicationReads = 0
  const service = await createStudioVoiceService(createLocalVoiceServiceOptions({
    accessToken,
    expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    port: 0,
    stateDirectory: fixture.storeDirectory,
    allowedOrigins: [origin],
    projects: [{ projectId, root: fixture.root, config: fixture.config }],
    publication: async () => ({
      current: async () => {
        publicationReads++
        return null
      },
      preparations: async () => [],
      prepare: async () => { throw new Error('TEST_PUBLICATION_DISABLED') },
      publish: async () => { throw new Error('TEST_PUBLICATION_DISABLED') },
    }),
  }))
  const { url } = await service.start()
  return {
    url,
    accessToken,
    status: () => ({ synthesisCalls: fixture.calls.length, publicationReads, compiledLines, calls: fixture.calls.map(call => ({ speakerId: call.character, text: call.text })) }),
    async close() {
      await service.stop()
      await rm(fixture.directory, { recursive: true, force: true })
    },
  }
}
