import type { Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

const world = 'adv/world.md'
const chapter = 'adv/chapters/intro.adv.md'
const initial = { 'adv.config.json': '{"root":"adv","format":"adv-md"}', [world]: 'Original world', [chapter]: '# Intro {#start}\n\nOriginal chapter.' }
const changes = [{ path: world, expected: initial[world], content: 'Candidate world' }, { path: chapter, expected: initial[chapter], content: '# Candidate {#start}\n\nCandidate chapter.' }]
const imported = [0, 127, 255, 80, 82, 79, 74, 69, 67, 84]
const authorBytes = [0, 255, 128, 65, 85, 84, 72, 79, 82]

async function open(page: Page, id: string) {
  await page.goto('/tests/fixtures/creative-team/file-compensation.html')
  await expect(page).toHaveTitle('Project file compensation fixture')
  await page.waitForFunction(() => Boolean((window as any).fileCompensationFixture))
  await page.evaluate(id => (window as any).fileCompensationFixture.open(id), id)
  await expect(page.locator('h1')).toBeVisible()
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
}

for (const mode of ['source', 'pending-source', 'media', 'independent-source'] as const) {
  test(`preserves a later ${mode} save during failed non-atomic project adoption`, async ({ page, context }, info) => {
    const errors: string[] = []
    const warnings: string[] = []
    const second = await context.newPage()
    for (const current of [page, second]) {
      current.on('pageerror', error => errors.push(error.message))
      current.on('console', (message) => {
        if (message.type() === 'error')
          errors.push(message.text())
        if (message.type() === 'warning')
          warnings.push(message.text())
      })
    }
    const id = randomUUID()
    try {
      await open(page, id)
      await page.evaluate(files => (window as any).fileCompensationFixture.write(files), initial)
      await open(second, id)
      await page.evaluate(({ changes, mode, imported }) => (window as any).fileCompensationFixture.start(changes, mode === 'pending-source' ? 'between-writes' : 'after-writes', imported), { changes, mode, imported })
      await expect.poll(() => page.evaluate(() => (window as any).fileCompensationFixture.state().status)).toBe('waiting')
      if (mode === 'source' || mode === 'pending-source')
        await second.evaluate(path => (window as any).fileCompensationFixture.write({ [path]: 'Later author save from another window' }), mode === 'source' ? world : chapter)
      else if (mode === 'media')
        await second.evaluate(bytes => (window as any).fileCompensationFixture.writeBinary('adv/assets/import.bin', bytes), authorBytes)
      else
        await second.evaluate(() => (window as any).fileCompensationFixture.write({ 'adv/chapters/new.adv.md': '# New {#start}\n\nAuthor now references adv/assets/import.bin.' }))
      const outcome = await page.evaluate(() => (window as any).fileCompensationFixture.continue())
      await page.reload()
      await page.waitForFunction(() => Boolean((window as any).fileCompensationFixture))
      await page.evaluate(id => (window as any).fileCompensationFixture.open(id), id)
      const state = await page.evaluate(async () => ({ files: await (window as any).fileCompensationFixture.files(), bytes: await (window as any).fileCompensationFixture.readBinary('adv/assets/import.bin') }))
      await writeFile(info.outputPath('file-compensation-evidence.json'), JSON.stringify({ scope: 'Actual BrowserFsAdapter over origin-private FileSystemDirectoryHandle, two independent windows and real writable streams. Failure boundaries are explicit injection. This does not certify selected OS directories, OS external writers or Capacitor.', mode, initial, changes, imported, authorBytes, outcome, state, errors, warnings }, null, 2))
      expect(outcome.status).toBe('failed')
      expect(outcome.error).toContain('ADV_STUDIO_ROLLBACK_INCOMPLETE')
      if (mode === 'source' || mode === 'pending-source') {
        expect(state.files[mode === 'source' ? world : chapter]).toBe('Later author save from another window')
        expect(state.files[mode === 'source' ? chapter : world]).toBe(initial[mode === 'source' ? chapter : world])
      }
      else {
        expect(state.files[world]).toBe(initial[world])
        expect(state.files[chapter]).toBe(initial[chapter])
      }
      expect(state.bytes).toEqual(mode === 'media' ? authorBytes : imported)
      if (mode === 'independent-source')
        expect(state.files['adv/chapters/new.adv.md']).toContain('Author now references')
      expect(errors).toEqual([])
      expect(warnings).toEqual([])
    }
    finally {
      const cleanup = await page.evaluate(() => (window as any).fileCompensationFixture.cleanup()).then(removed => ({ removed: removed === true }), error => ({ removed: false, error: String(error) }))
      await writeFile(info.outputPath('file-compensation-cleanup.json'), JSON.stringify(cleanup))
      await second.close()
      expect(cleanup.removed).toBe(true)
    }
  })
}
