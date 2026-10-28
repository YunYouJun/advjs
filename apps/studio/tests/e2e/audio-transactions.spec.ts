import type { Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import process from 'node:process'
import { expect, test } from '@playwright/test'

async function open(page: Page, id: string, backend: string, empty = false) {
  await page.goto('/tests/fixtures/creative-team/audio-transactions.html')
  await expect(page).toHaveTitle('Audio authoring transaction fixture')
  await page.waitForFunction(() => Boolean((window as any).audioTransactionFixture))
  await page.evaluate(({ id, backend, empty }) => (window as any).audioTransactionFixture.open(id, backend, empty), { id, backend, empty })
}

function consoleFailures(pages: Page[]) {
  const failures: string[] = []
  for (const page of pages) {
    page.on('pageerror', error => failures.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning')
        failures.push(`${message.type()}: ${message.text()}`)
    })
  }
  return failures
}

for (const kind of ['import', 'initialize'] as const) {
  test(`memory audio ${kind} remains private through autosave and preserves an external author change`, async ({ page, context }, info) => {
    const wav = process.env.STUDIO_CREATIVE_VOICE_WAV
    test.skip(kind === 'import' && !wav, 'Requires the real existing spoken WAV')
    const second = await context.newPage()
    const id = randomUUID()
    const errors = consoleFailures([page, second])
    try {
      await open(page, id, 'memory', kind === 'initialize')
      if (kind === 'import') {
        await page.locator('#audio').setInputFiles(wav!)
        await page.evaluate(() => (window as any).audioTransactionFixture.load())
      }
      await open(second, id, 'memory', kind === 'initialize')
      const before = await second.evaluate(() => (window as any).audioTransactionFixture.sources())
      await page.evaluate(({ kind }) => (window as any).audioTransactionFixture.start(kind === 'import', kind), { kind })
      await expect.poll(() => page.evaluate(() => (window as any).audioTransactionFixture.state().phase)).toBe('waiting')
      await second.waitForTimeout(750)
      const during = await second.evaluate(() => (window as any).audioTransactionFixture.sources())
      await second.evaluate(() => (window as any).audioTransactionFixture.saveAuthorWorld())
      const outcome = await page.evaluate(() => (window as any).audioTransactionFixture.finish())
      await page.reload()
      await page.waitForFunction(() => Boolean((window as any).audioTransactionFixture))
      await page.evaluate(id => (window as any).audioTransactionFixture.open(id, 'memory', true), id)
      const after = await page.evaluate(() => (window as any).audioTransactionFixture.sources())
      await writeFile(info.outputPath('audio-transaction-evidence.json'), JSON.stringify({ kind, before, during, outcome, after, errors }, null, 2))
      expect(during).toEqual(before)
      expect(outcome.phase).toBe('failed')
      expect(after.files).toEqual({ ...before.files, 'adv/world.md': '# Author world saved in the other window' })
      expect(after.imported).toBe(false)
      expect(after.original).toBe(kind === 'import')
      expect(errors).toEqual([])
    }
    finally {
      const cleanup = await page.evaluate(() => (window as any).audioTransactionFixture.cleanup()).catch(error => ({ removed: false, error: String(error) }))
      await writeFile(info.outputPath('audio-transaction-cleanup.json'), JSON.stringify(cleanup))
      await second.close()
      expect(cleanup.removed).toBe(true)
    }
  })
}

for (const backend of ['browser', 'memory'] as const) {
  test(`${backend} audio selection preserves a concurrent author save and avoids premature publication`, async ({ page, context, browserName }, info) => {
    test.skip(backend === 'browser' && browserName !== 'chromium', 'BrowserFsAdapter is a desktop Chromium backend')
    const wav = process.env.STUDIO_CREATIVE_VOICE_WAV
    test.skip(!wav, 'Requires the real existing spoken WAV; no substitute signal is used')
    const second = await context.newPage()
    const id = randomUUID()
    const errors = consoleFailures([page, second])
    try {
      await open(page, id, backend)
      await page.locator('#audio').setInputFiles(wav!)
      await page.evaluate(() => (window as any).audioTransactionFixture.load())
      await open(second, id, backend)
      const ids = await page.evaluate(() => (window as any).audioTransactionFixture.ids)
      await page.evaluate(fail => (window as any).audioTransactionFixture.start(fail), backend === 'browser')
      await expect.poll(() => page.evaluate(() => (window as any).audioTransactionFixture.state().phase)).toBe('waiting')
      // Cross the real 500 ms autosave boundary while this selection is pending.
      await second.waitForTimeout(750)
      const during = await second.evaluate(() => (window as any).audioTransactionFixture.selected())
      if (backend === 'browser')
        await second.evaluate(() => (window as any).audioTransactionFixture.saveAuthorSelection())
      else
        await second.evaluate(() => (window as any).audioTransactionFixture.saveAuthorWorld())
      const outcome = await page.evaluate(() => (window as any).audioTransactionFixture.finish())
      await page.reload()
      await page.waitForFunction(() => Boolean((window as any).audioTransactionFixture))
      await page.evaluate(({ id, backend }) => (window as any).audioTransactionFixture.open(id, backend), { id, backend })
      const after = await page.evaluate(async () => ({ selected: await (window as any).audioTransactionFixture.selected(), world: await (window as any).audioTransactionFixture.world() }))
      await writeFile(info.outputPath('audio-transaction-evidence.json'), JSON.stringify({ scope: 'Real shared audio authoring service, actual frozen source and existing spoken WAV, independent filesystem instances and real persistence. Pause/failure boundaries are explicitly injected. No model, supplier or media-quality certification.', backend, during, ids, outcome, after, errors }, null, 2))
      expect(outcome.phase).toBe('failed')
      expect(after.selected).toBe(backend === 'browser' ? ids.authorTakeId : null)
      if (backend === 'memory') {
        expect(during).toBeNull()
        expect(after.world).toBe('# Author world saved in the other window')
      }
      expect(errors).toEqual([])
    }
    finally {
      const cleanup = await page.evaluate(() => (window as any).audioTransactionFixture.cleanup()).catch(error => ({ removed: false, error: String(error) }))
      await writeFile(info.outputPath('audio-transaction-cleanup.json'), JSON.stringify(cleanup))
      await second.close()
      expect(cleanup.removed).toBe(true)
    }
  })
}
