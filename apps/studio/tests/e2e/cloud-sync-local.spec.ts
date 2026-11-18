import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

const path = 'adv/chapters/intro.adv.md'
const media = 'public/abort.wav'
async function open(page: Page, id: string) {
  await page.goto('/tests/fixtures/creative-team/memory-fs.html')
  await page.waitForFunction(() => Boolean((window as any).memoryFsFixture))
  await page.evaluate(id => (window as any).memoryFsFixture.open(id), id)
}
async function seed(page: Page, id: string) {
  await open(page, id)
  await page.evaluate(path => (window as any).memoryFsFixture.write({ [path]: 'Original chapter', 'adv/world.md': 'Original world' }), path)
  await page.evaluate(() => (window as any).memoryFsFixture.flush())
  await page.evaluate(() => (window as any).memoryFsFixture.captureSyncSource())
}
const downloads = [{ path, content: 'Cloud chapter' }, { path: media, bytes: [0, 128, 255] }]

test('cloud local adoption persists text and binary atomically across immediate reload', async ({ page }) => {
  await seed(page, 'cloud-success')
  expect(await page.evaluate(files => (window as any).memoryFsFixture.applyCloudDownload(files), downloads)).toEqual({ success: true })
  await open(page, 'cloud-success')
  expect(await page.evaluate(path => (window as any).memoryFsFixture.read(path), path)).toBe('Cloud chapter')
  expect(await page.evaluate(path => (window as any).memoryFsFixture.readMedia(path), media)).toEqual({ bytes: [0, 128, 255], mimeType: 'audio/wav' })
})

test('a different tab editing during cloud fetch wins and no dependent media is written', async ({ page, context }) => {
  await seed(page, 'cloud-fetch-race')
  const author = await context.newPage()
  await open(author, 'cloud-fetch-race')
  await author.evaluate(path => (window as any).memoryFsFixture.write({ [path]: 'Author saved during fetch' }), path)
  await author.evaluate(() => (window as any).memoryFsFixture.flush())
  expect(await page.evaluate(files => (window as any).memoryFsFixture.applyCloudDownload(files), downloads)).toMatchObject({ success: false, error: expect.stringContaining('ADV_STUDIO_SOURCE_CONFLICT') })
  await open(page, 'cloud-fetch-race')
  expect(await page.evaluate(path => (window as any).memoryFsFixture.read(path), path)).toBe('Author saved during fetch')
  expect(await page.evaluate(path => (window as any).memoryFsFixture.exists(path), media)).toBe(false)
})

test('an IndexedDB abort keeps the previous complete project and the same fetched bytes can be retried', async ({ page, context }) => {
  await seed(page, 'cloud-abort')
  await page.evaluate(() => (window as any).memoryFsFixture.abortNextMediaWrite())
  expect(await page.evaluate(files => (window as any).memoryFsFixture.applyCloudDownload(files), downloads)).toMatchObject({ success: false, error: expect.stringContaining('fixture abort') })
  const reader = await context.newPage()
  await open(reader, 'cloud-abort')
  expect(await reader.evaluate(path => (window as any).memoryFsFixture.read(path), path)).toBe('Original chapter')
  expect(await reader.evaluate(path => (window as any).memoryFsFixture.exists(path), media)).toBe(false)
  expect(await page.evaluate(files => (window as any).memoryFsFixture.applyCloudDownload(files), downloads)).toEqual({ success: true })
  await open(reader, 'cloud-abort')
  expect(await reader.evaluate(path => (window as any).memoryFsFixture.read(path), path)).toBe('Cloud chapter')
})

test('a different source changed before cloud commit aborts the complete staged batch', async ({ page, context }) => {
  await seed(page, 'cloud-commit-race')
  await page.evaluate(files => (window as any).memoryFsFixture.pauseCloudDownload(files), downloads)
  await page.waitForFunction(() => (window as any).memoryFsFixture.adoptionPaused())
  const author = await context.newPage()
  await open(author, 'cloud-commit-race')
  expect(await author.evaluate(path => (window as any).memoryFsFixture.read(path), path)).toBe('Original chapter')
  await author.evaluate(() => (window as any).memoryFsFixture.write({ 'adv/world.md': 'Author world after staging' }))
  await author.evaluate(() => (window as any).memoryFsFixture.flush())
  expect(await page.evaluate(() => (window as any).memoryFsFixture.resumeAdoption())).toMatchObject({ success: false, error: expect.stringContaining('ADV_STUDIO_SOURCE_CONFLICT') })
  await open(page, 'cloud-commit-race')
  expect(await page.evaluate(path => (window as any).memoryFsFixture.read(path), path)).toBe('Original chapter')
  expect(await page.evaluate(() => (window as any).memoryFsFixture.read('adv/world.md'))).toBe('Author world after staging')
  expect(await page.evaluate(path => (window as any).memoryFsFixture.exists(path), media)).toBe(false)
})
