import type { Locator } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { expect, test } from '@playwright/test'

async function displayedImage(locator: Locator, background = false) {
  return locator.evaluate(async (element, background) => {
    const src = background ? JSON.parse(getComputedStyle(element).backgroundImage.slice(4, -1)) : (element as HTMLImageElement).src
    const image = new Image()
    image.src = src
    await image.decode()
    const data = await (await fetch(src)).arrayBuffer()
    return { local: src.startsWith('blob:'), width: image.naturalWidth, height: image.naturalHeight, sha256: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), value => value.toString(16).padStart(2, '0')).join('') }
  }, background)
}

test('adopts portrait, expression and background, renders their exact bytes and inspects missing, corrupt and stale art', async ({ page, browserName }, info) => {
  const expression = process.env.STUDIO_CREATIVE_EXPRESSION_IMAGE
  const background = process.env.STUDIO_CREATIVE_BACKGROUND_IMAGE
  test.skip(!expression || !background, 'Requires existing real expression/background inputs; no generated substitute is used')
  const errors: string[] = []
  const warnings: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error')
      errors.push(message.text())
    if (message.type() === 'warning')
      warnings.push(message.text())
  })
  const fixture = `/tests/fixtures/creative-team/media-milestones.html?case=art-targets-${browserName}`
  await page.goto(fixture)
  await expect(page).toHaveTitle('Creative media milestone UI fixture')
  await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeMediaFixture))).toBe(true)
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  const files = () => page.evaluate(() => (window as any).creativeMediaFixture.files())
  const before = await files()
  const coverage = page.getByTestId('creative-art-coverage')
  async function inspect() {
    await coverage.getByRole('button', { name: '核对项目图片', exact: true }).click()
    await expect(coverage.locator('li')).toHaveCount(4)
  }
  await inspect()
  await expect(coverage.locator('li[data-status="missing"]')).toHaveCount(4)
  await writeFile(info.outputPath('initial-inspection.txt'), await coverage.textContent() ?? '')
  const art = page.getByTestId('creative-art-import')
  for (const input of [
    { id: 'character/lin/default', size: '619 × 619', path: process.env.STUDIO_CREATIVE_PORTRAIT_IMAGE || resolve(import.meta.dirname, '../../../../demo/starter/public/img/characters/xiaoyun.webp') },
    { id: 'character/lin/good', size: '619 × 619', path: expression! },
    { id: 'background/station', size: '1920 × 1088', path: background! },
  ]) {
    const sourceBeforeCandidate = await files()
    const writesBeforeCandidate = await page.evaluate(() => (window as any).creativeMediaFixture.writes())
    await art.getByRole('combobox', { name: '美术素材需求', exact: true }).selectOption({ label: `${input.id} · ${input.size}` })
    await art.getByLabel('选择图片文件', { exact: true }).setInputFiles(input.path)
    await art.getByLabel('素材来源与署名', { exact: true }).fill('仓库已有演示素材，仅用于本地字节、绑定和播放回归；不声明新作品美术品质或供应商生成。')
    await art.getByRole('button', { name: '保存图片候选', exact: true }).click()
    const candidate = page.getByTestId('creative-art-candidate').filter({ hasText: input.id })
    await expect(candidate.getByRole('img')).toBeVisible()
    await candidate.getByRole('button', { name: '审阅导入', exact: true }).click()
    await candidate.getByRole('button', { name: '登记制作组候选（项目未变）', exact: true }).click()
    await expect(candidate.getByRole('heading', { name: /制作组候选已登记，项目未变/ })).toBeVisible()
    expect(await files()).toEqual(sourceBeforeCandidate)
    expect(await page.evaluate(() => (window as any).creativeMediaFixture.writes())).toEqual(writesBeforeCandidate)
    await inspect()
    await expect(coverage.locator(`li[data-asset-id="${input.id}"][data-status="missing"]`)).toHaveCount(1)
    const milestone = page.getByTestId('creative-milestone')
    await expect(milestone.getByRole('checkbox')).toHaveCount(1)
    await milestone.getByRole('checkbox').check()
    await milestone.getByLabel('采用或撤销的原因', { exact: true }).fill(`逐项采用已审阅的 ${input.id}；保留 missing 需求待制作。`)
    await milestone.getByRole('button', { name: '审阅采用', exact: true }).click()
    await milestone.getByRole('button', { name: '确认写入项目', exact: true }).click()
    await expect(candidate.getByRole('heading', { name: /已采用到本机项目/ })).toBeVisible()
  }
  await inspect()
  await expect(coverage.locator('li[data-status="ready"]')).toHaveCount(3)
  await expect(coverage.locator('li[data-status="missing"]')).toHaveCount(1)
  const adopted = await files()
  expect(adopted['adv/scenes/station.md']).toContain('custom: 42')
  expect(adopted['adv/scenes/station.md']).toContain('assetId: background/station')
  expect(adopted['adv/scenes/station.md']).toContain('保留原有场景正文。')
  expect(adopted['adv/characters/lin.character.md']).toBe(before['adv/characters/lin.character.md'])
  const media = await page.evaluate(() => (window as any).creativeMediaFixture.media()) as { id: string, sha256: string, expectedSha256: string, bytes: number, expectedBytes: number }[]
  expect(media).toHaveLength(3)
  expect(media.find(item => item.id === 'character/lin/default')?.sha256).not.toBe(media.find(item => item.id === 'character/lin/good')?.sha256)
  for (const row of media) {
    expect(row.sha256).toBe(row.expectedSha256)
    expect(row.bytes).toBe(row.expectedBytes)
  }
  await page.reload()
  await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeMediaFixture))).toBe(true)
  expect(await files()).toEqual(adopted)
  expect(await page.evaluate(() => (window as any).creativeMediaFixture.writes())).toEqual([])
  expect((await page.evaluate(() => (window as any).creativeMediaFixture.calls()) as any[]).filter(item => item.method === 'POST')).toEqual([])
  await inspect()
  await expect(coverage.locator('li[data-status="ready"]')).toHaveCount(3)
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await coverage.scrollIntoViewIfNeeded()
    expect(await coverage.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`art-inventory-${width}.png`), animations: 'disabled' })
  }
  const fragment = JSON.parse(adopted['adv/assets/other.json'])
  const path = `adv/assets/${fragment.assets.find((item: any) => item.id === 'character/lin/good').path}`
  const original = await page.evaluate(path => (window as any).creativeMediaFixture.corruptImage(path), path)
  await expect(coverage.locator('li')).toHaveCount(0)
  await inspect()
  await expect(coverage.locator('li[data-status="unavailable"]')).toHaveCount(1)
  await expect(coverage.locator('li[data-status="ready"]')).toHaveCount(2)
  await page.evaluate(({ path, data }) => (window as any).creativeMediaFixture.restoreImage(path, data), { path, data: original })
  await inspect()
  await expect(coverage.locator('li[data-status="ready"]')).toHaveCount(3)
  await page.evaluate(() => (window as any).creativeMediaFixture.editSource('adv/chapters/intro.adv.md', (window as any).creativeMediaFixture.artPlayerChapter))
  await expect(coverage.locator('li')).toHaveCount(0)
  await inspect()
  await expect(coverage.locator('li[data-status="stale"]')).toHaveCount(4)
  await page.goto('/tabs/play')
  await expect(page).toHaveURL(/\/tabs\/play/)
  await expect(page.locator('.game-player')).toContainText('默认立绘和背景已经采用。', { timeout: 15000 })
  const tachie = page.locator('img.tachie-character')
  const backdrop = page.locator('.adv-background__layer--current')
  await expect(tachie).toBeVisible()
  await writeFile(info.outputPath('game-diagnostic.json'), JSON.stringify({ errors, warnings, state: await page.locator('.game-player').evaluate((element) => {
    let component = (element as any).__vueParentComponent
    while (component && !component.exposed?.getCurrentSnapshot)
      component = component.parent
    return component?.exposed?.getCurrentSnapshot()
  }), dom: await page.locator('.game-player').evaluate(element => element.innerHTML) }, null, 2))
  await expect(backdrop).toBeVisible()
  const portraitPaint = await displayedImage(tachie)
  const backgroundPaint = await displayedImage(backdrop, true)
  expect(portraitPaint.sha256).toBe(media.find(item => item.id === 'character/lin/default')?.sha256)
  expect(backgroundPaint.sha256).toBe(media.find(item => item.id === 'background/station')?.sha256)
  expect(portraitPaint.local && backgroundPaint.local).toBe(true)
  await expect(page.locator('.adv-dialog-box .typed-cursor')).toBeVisible()
  // The first click completes the current typing run; the second advances it.
  await page.locator('.adv-dialog-box').click()
  await page.locator('.adv-dialog-box').click()
  await expect(page.locator('.game-player')).toContainText('现在切换到 good 表情。')
  await expect.poll(async () => (await displayedImage(tachie)).sha256).toBe(media.find(item => item.id === 'character/lin/good')?.sha256)
  const expressionPaint = await displayedImage(tachie)
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(tachie).toBeInViewport()
    await page.screenshot({ path: info.outputPath(`art-player-good-${width}.png`), animations: 'disabled' })
  }
  expect(errors).toEqual([])
  expect(warnings).toEqual([])
  await writeFile(info.outputPath('art-targets-evidence.json'), JSON.stringify({ scope: 'Actual shared media registration/adoption, IndexedDB reopen, image decode, exact displayed bytes and product GamePlayer. Identity, plan and local service are fixtures. No generation or billing; no story/art-quality certification.', before, adopted, media, portraitPaint, backgroundPaint, expressionPaint, errors, warnings }, null, 2))
})
