import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

const chapter = 'adv/chapters/intro.adv.md'
const original = '# Intro {#start}\n\nOriginal chapter.'
const initial = { 'adv.config.json': '{"format":"adv-md","root":"adv"}', 'adv/world.md': 'Original world', [chapter]: original }
const fixture = '/tests/fixtures/creative-team/memory-fs.html'

async function open(page: Page, projectId: string) {
  await page.goto(fixture)
  await page.waitForFunction(() => Boolean((window as any).memoryFsFixture))
  await page.evaluate(id => (window as any).memoryFsFixture.open(id), projectId)
}
async function error(operation: Promise<unknown>) {
  return operation.then(() => 'unexpected success', failure => String(failure))
}

test('independent tabs atomically merge disjoint edits and retain binary media after immediate reload', async ({ page, context }) => {
  const second = await context.newPage()
  await open(page, 'disjoint')
  await page.evaluate(files => (window as any).memoryFsFixture.write(files), initial)
  await page.evaluate(() => (window as any).memoryFsFixture.flush())
  await open(second, 'disjoint')
  await page.evaluate(() => (window as any).memoryFsFixture.write({ 'adv/world.md': 'Saved in tab A' }))
  await second.evaluate(path => (window as any).memoryFsFixture.write({ [path]: '# Saved in tab B {#start}' }), chapter)
  await second.evaluate(() => (window as any).memoryFsFixture.writeMedia('public/voice.wav', [0, 128, 255]))
  await Promise.all([page.evaluate(() => (window as any).memoryFsFixture.flush()), second.evaluate(() => (window as any).memoryFsFixture.flush())])
  await open(page, 'disjoint')
  expect(await page.evaluate(() => (window as any).memoryFsFixture.read('adv/world.md'))).toBe('Saved in tab A')
  expect(await page.evaluate(path => (window as any).memoryFsFixture.read(path), chapter)).toBe('# Saved in tab B {#start}')
  expect(await page.evaluate(() => (window as any).memoryFsFixture.readMedia('public/voice.wav'))).toEqual({ bytes: [0, 128, 255], mimeType: 'audio/wav' })
})

test('same-file concurrent flush permits one durable winner and keeps the losing local draft', async ({ page, context }) => {
  const second = await context.newPage()
  await open(page, 'collision')
  await page.evaluate(files => (window as any).memoryFsFixture.write(files), initial)
  await page.evaluate(() => (window as any).memoryFsFixture.flush())
  await open(second, 'collision')
  await page.evaluate(() => (window as any).memoryFsFixture.write({ 'adv/world.md': 'Tab A' }))
  await second.evaluate(() => (window as any).memoryFsFixture.write({ 'adv/world.md': 'Tab B' }))
  const outcomes = await Promise.all([error(page.evaluate(() => (window as any).memoryFsFixture.flush())), error(second.evaluate(() => (window as any).memoryFsFixture.flush()))])
  expect(outcomes.filter(result => result === 'unexpected success')).toHaveLength(1)
  expect(outcomes.filter(result => result.includes('ADV_STUDIO_SOURCE_CONFLICT'))).toHaveLength(1)
  expect(await page.evaluate(() => (window as any).memoryFsFixture.read('adv/world.md'))).toBe('Tab A')
  expect(await second.evaluate(() => (window as any).memoryFsFixture.read('adv/world.md'))).toBe('Tab B')
  const winner = outcomes[0] === 'unexpected success' ? 'Tab A' : 'Tab B'
  await open(page, 'collision')
  expect(await page.evaluate(() => (window as any).memoryFsFixture.read('adv/world.md'))).toBe(winner)
})

test('creative adoption refreshes a stale tab before accepting its old full-project revision', async ({ page, context }) => {
  const second = await context.newPage()
  await open(page, 'adoption')
  await page.evaluate(files => (window as any).memoryFsFixture.write(files), initial)
  await page.evaluate(() => (window as any).memoryFsFixture.flush())
  await open(second, 'adoption')
  const before = await second.evaluate(() => (window as any).memoryFsFixture.snapshot())
  await page.evaluate(() => (window as any).memoryFsFixture.write({ 'adv/world.md': 'Author changed a different source' }))
  await page.evaluate(() => (window as any).memoryFsFixture.flush())
  expect(await error(second.evaluate(({ revision, chapter, original }) => (window as any).memoryFsFixture.adopt(revision, [{ path: chapter, before: original, after: '# Stale candidate {#start}' }]), { revision: before.revision, chapter, original }))).toContain('CREATIVE_SOURCE_CONFLICT')
  await open(page, 'adoption')
  expect(await page.evaluate(path => (window as any).memoryFsFixture.read(path), chapter)).toBe(original)
  expect(await second.evaluate(() => (window as any).memoryFsFixture.read('adv/world.md'))).toBe('Author changed a different source')
})

test('ordinary content save reports a stale persistence failure instead of claiming success', async ({ page, context }) => {
  const second = await context.newPage()
  await open(page, 'content-save')
  await page.evaluate(files => (window as any).memoryFsFixture.write(files), initial)
  await page.evaluate(() => (window as any).memoryFsFixture.flush())
  await open(second, 'content-save')
  await second.evaluate(() => (window as any).memoryFsFixture.openChapter())
  await page.evaluate(path => (window as any).memoryFsFixture.write({ [path]: '# Author saved {#start}' }), chapter)
  await page.evaluate(() => (window as any).memoryFsFixture.flush())
  const result = await second.evaluate(() => (window as any).memoryFsFixture.saveChapter('Stale form draft'))
  expect(result).toMatchObject({ success: false, error: 'ADV_STUDIO_SOURCE_CONFLICT' })
  await open(page, 'content-save')
  expect(await page.evaluate(path => (window as any).memoryFsFixture.read(path), chapter)).toBe('# Author saved {#start}')
  expect(await second.evaluate(() => (window as any).memoryFsFixture.chapterDraft())).toBe('Stale form draft')
  expect(await second.evaluate(path => (window as any).memoryFsFixture.read(path), chapter)).toBe('# Author saved {#start}')
})

test('a real IndexedDB abort preserves the entire previous source/media batch and permits retry', async ({ page, context }) => {
  const second = await context.newPage()
  await open(page, 'storage-abort')
  await page.evaluate(files => (window as any).memoryFsFixture.write(files), initial)
  await page.evaluate(() => (window as any).memoryFsFixture.flush())
  await page.evaluate(() => (window as any).memoryFsFixture.write({ 'adv/world.md': 'Pending world' }))
  await page.evaluate(() => (window as any).memoryFsFixture.writeMedia('public/abort.wav', [1, 2, 3]))
  await page.evaluate(() => (window as any).memoryFsFixture.abortNextMediaWrite())
  expect(await error(page.evaluate(() => (window as any).memoryFsFixture.flush()))).toContain('fixture abort')
  await open(second, 'storage-abort')
  expect(await second.evaluate(() => (window as any).memoryFsFixture.read('adv/world.md'))).toBe('Original world')
  expect(await second.evaluate(() => (window as any).memoryFsFixture.exists('public/abort.wav'))).toBe(false)
  await page.evaluate(() => (window as any).memoryFsFixture.flush())
  await open(second, 'storage-abort')
  expect(await second.evaluate(() => (window as any).memoryFsFixture.read('adv/world.md'))).toBe('Pending world')
  expect(await second.evaluate(() => (window as any).memoryFsFixture.readMedia('public/abort.wav'))).toEqual({ bytes: [1, 2, 3], mimeType: 'audio/wav' })
})

test('an author edit between adoption validation and durable flush wins without a partial candidate batch', async ({ page, context }) => {
  const second = await context.newPage()
  await open(page, 'adoption-race')
  await page.evaluate(files => (window as any).memoryFsFixture.write(files), initial)
  await page.evaluate(() => (window as any).memoryFsFixture.flush())
  await open(second, 'adoption-race')
  const before = await second.evaluate(() => (window as any).memoryFsFixture.snapshot())
  await second.evaluate(({ revision, chapter, original }) => (window as any).memoryFsFixture.pauseAdoption(revision, [
    { path: 'adv/world.md', before: 'Original world', after: 'Candidate world' },
    { path: chapter, before: original, after: '# Dependent candidate {#start}' },
  ]), { revision: before.revision, chapter, original })
  await second.waitForFunction(() => (window as any).memoryFsFixture.adoptionPaused())
  await page.evaluate(() => (window as any).memoryFsFixture.write({ 'adv/world.md': 'Author saved during adoption' }))
  await page.evaluate(() => (window as any).memoryFsFixture.flush())
  expect(await second.evaluate(() => (window as any).memoryFsFixture.resumeAdoption())).toMatchObject({ success: false, error: expect.stringContaining('ADV_STUDIO_SOURCE_CONFLICT') })
  await open(page, 'adoption-race')
  expect(await page.evaluate(() => (window as any).memoryFsFixture.read('adv/world.md'))).toBe('Author saved during adoption')
  expect(await page.evaluate(path => (window as any).memoryFsFixture.read(path), chapter)).toBe(original)
})

test('staged adoption stays invisible beyond the autosave delay and rejects a different source changing before commit', async ({ page, context }) => {
  const second = await context.newPage()
  await open(page, 'whole-project-race')
  await page.evaluate(files => (window as any).memoryFsFixture.write(files), initial)
  await page.evaluate(() => (window as any).memoryFsFixture.flush())
  await open(second, 'whole-project-race')
  const before = await second.evaluate(() => (window as any).memoryFsFixture.snapshot())
  await second.evaluate(({ revision, chapter, original }) => (window as any).memoryFsFixture.pauseAdoption(revision, [
    { path: chapter, before: original, after: '# Candidate based on old world {#start}' },
  ]), { revision: before.revision, chapter, original })
  await second.waitForFunction(() => (window as any).memoryFsFixture.adoptionPaused())
  // An awaited validation may outlast ordinary autosave; staging must have no timer.
  await second.evaluate(() => new Promise(resolve => setTimeout(resolve, 650)))
  expect(await second.evaluate(path => (window as any).memoryFsFixture.read(path), chapter)).toBe(original)
  await open(page, 'whole-project-race')
  expect(await page.evaluate(path => (window as any).memoryFsFixture.read(path), chapter)).toBe(original)
  await page.evaluate(() => (window as any).memoryFsFixture.write({ 'adv/world.md': 'Author changed the story constraints' }))
  await page.evaluate(() => (window as any).memoryFsFixture.flush())
  expect(await second.evaluate(() => (window as any).memoryFsFixture.resumeAdoption())).toMatchObject({ success: false, error: expect.stringContaining('ADV_STUDIO_SOURCE_CONFLICT') })
  const after = await second.evaluate(() => (window as any).memoryFsFixture.snapshot())
  expect(after.files[chapter]).toBe(original)
  expect(after.files['adv/world.md']).toBe('Author changed the story constraints')
  // An explicit new revision can be reviewed and adopted using the reusable candidate.
  await second.evaluate(({ revision, chapter, original }) => (window as any).memoryFsFixture.adopt(revision, [{ path: chapter, before: original, after: '# Reviewed with new world {#start}' }]), { revision: after.revision, chapter, original })
  await open(page, 'whole-project-race')
  expect(await page.evaluate(path => (window as any).memoryFsFixture.read(path), chapter)).toBe('# Reviewed with new world {#start}')
  expect(await page.evaluate(() => (window as any).memoryFsFixture.read('adv/world.md'))).toBe('Author changed the story constraints')
})
