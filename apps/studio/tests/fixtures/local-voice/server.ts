import { randomBytes } from 'node:crypto'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createLocalVoiceServiceOptions, createStudioVoiceService } from 'advjs/node'
import { createEditorVoiceDesignFixture } from '../../../../../tests/fixtures/audio/editor-voice-design'

/** The product app connects to the real finite HTTP service, with no model calls. */
export async function startLocalVoiceFixture(projectId: string, origin: string) {
  const fixture = await createEditorVoiceDesignFixture()
  // This smoke starts with a new empty browser catalog. Reuse the provider's
  // design capability without importing the other fixture's reference asset.
  const catalogPath = join(fixture.root, 'adv/assets.json')
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
  catalog.assets = []
  await writeFile(catalogPath, JSON.stringify(catalog))
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
    status: () => ({ synthesisCalls: fixture.calls.length, publicationReads }),
    async close() {
      await service.stop()
      await rm(fixture.directory, { recursive: true, force: true })
    },
  }
}
