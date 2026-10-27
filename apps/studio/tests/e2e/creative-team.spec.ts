import type { Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { expect, test } from '@playwright/test'

const consoleEvidence = new WeakMap<Page, { errors: string[], warnings: string[] }>()
test.beforeEach(({ page }) => {
  const evidence = { errors: [] as string[], warnings: [] as string[] }
  consoleEvidence.set(page, evidence)
  page.on('pageerror', error => evidence.errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error')
      evidence.errors.push(message.text())
    if (message.type() === 'warning')
      evidence.warnings.push(message.text())
  })
})
test.afterEach(async ({ page }, info) => {
  const evidence = consoleEvidence.get(page)!
  await writeFile(info.outputPath('browser-console.json'), JSON.stringify(evidence, null, 2))
  expect(evidence.errors).toEqual([])
  expect(evidence.warnings).toEqual([])
})

async function stageRealRecoveryVoice(page: Page, audioPath: string) {
  const panel = page.getByTestId('creative-voice-import')
  await panel.getByRole('button', { name: '核对实际对白', exact: true }).click()
  await panel.getByLabel('选择真实对白 WAV').setInputFiles(audioPath)
  await panel.getByLabel('制作来源、署名与使用说明').fill('本机真实 Tingting 外部制作；用于中断恢复验证，未调用托管服务。')
  await panel.getByRole('button', { name: '审阅未选配音候选', exact: true }).click()
  await expect(panel.getByText('请核对原始字节、音色来源与文件变化。确认仅登记 VoiceTake，尚未采用到游戏。')).toBeVisible()
  return panel
}

test('executes actual core paths, retains private reports across reload and retests a repaired source', async ({ page }, info) => {
  const errors: string[] = []
  const warnings: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error')
      errors.push(message.text())
    if (message.type() === 'warning')
      warnings.push(message.text())
  })
  await page.goto('/tests/fixtures/creative-team/authoring.html')
  await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeAuthorFixture))).toBe(true)
  const readFiles = () => page.evaluate(async () => (window as any).creativeAuthorFixture.files())
  const before = await readFiles()
  const tasks = await page.evaluate(() => (window as any).creativeAuthorFixture.run().tasks)
  const panel = page.getByTestId('creative-playtest')
  await panel.getByLabel('预期结局地址', { exact: true }).fill('stay#ending-stay')
  await panel.getByLabel('选择序列（从 0 开始，以英文逗号分隔）', { exact: true }).fill('0')
  await panel.getByRole('button', { name: '添加路径', exact: true }).click()
  await panel.getByLabel('预期结局地址', { exact: true }).nth(1).fill('leave#ending-leave')
  await panel.getByLabel('选择序列（从 0 开始，以英文逗号分隔）', { exact: true }).nth(1).fill('1')
  await panel.getByRole('button', { name: '执行这些路径', exact: true }).click()
  const report = page.getByTestId('creative-playtest-report')
  await expect(report.getByRole('heading', { name: '实际路径报告' })).toBeFocused()
  await expect(report.getByRole('heading', { name: /指定路径通过/ })).toHaveCount(2)
  await expect(panel.getByText('已同步作者宿主报告，服务端未重放', { exact: true })).toBeVisible()
  expect(await readFiles()).toEqual(before)
  expect(await page.evaluate(() => (window as any).creativeAuthorFixture.run().tasks)).toEqual(tasks)
  const stored = await page.evaluate(() => Object.values((window as any).creativeAuthorFixture.playtests())) as any[]
  expect(stored[0].executions.map((item: any) => [item.actualEnding, item.commands])).toEqual([['stay#ending-stay', 5], ['leave#ending-leave', 5]])
  await page.reload()
  await expect(report.getByRole('heading', { name: /指定路径通过/ })).toHaveCount(2)
  expect((await page.evaluate(() => (window as any).creativeAuthorFixture.calls()) as string[]).filter(call => call.startsWith('POST'))).toEqual([])
  await page.evaluate(() => (window as any).creativeAuthorFixture.editSource('adv/chapters/station.adv.md', '# 雨夜车站 {#arrival}\n\n- [缺失](missing#end)'))
  await panel.getByRole('button', { name: '核对当前源版本' }).click()
  await expect(report.getByText(/来源或候选版本已变化/)).toBeVisible()
  await panel.getByRole('button', { name: '载入这份报告的复现输入' }).click()
  await panel.getByRole('button', { name: '执行这些路径', exact: true }).click()
  await expect(report.getByRole('heading', { name: /未完成执行/ })).toHaveCount(2)
  await report.getByText(/静态诊断/).click()
  await expect(report.getByText('ADV_RUNTIME_UNKNOWN_TARGET', { exact: true })).toBeVisible()
  await page.evaluate(value => (window as any).creativeAuthorFixture.editSource('adv/chapters/station.adv.md', value), before['adv/chapters/station.adv.md'])
  await panel.getByRole('button', { name: '载入这份报告的复现输入' }).click()
  await panel.getByRole('button', { name: '执行这些路径', exact: true }).click()
  await expect(report.getByRole('heading', { name: /指定路径通过/ })).toHaveCount(2)
  await expect(panel.getByText('已同步作者宿主报告，服务端未重放', { exact: true })).toBeVisible()
  expect(await readFiles()).toEqual(before)
  await report.locator('.playtest-report__execution').first().getByText(/执行轨迹与源位置/).click()
  await expect(report.getByRole('button', { name: 'adv/chapters/stay.adv.md:3', exact: true })).toBeVisible()
  const viewports: unknown[] = []
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await report.scrollIntoViewIfNeeded()
    await report.locator('.playtest-report__trace').first().evaluate(element => element.scrollTop = 0)
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    await expect(report.locator('.playtest-report__trace').first().getByText('start', { exact: true })).toBeInViewport()
    viewports.push(await report.locator('.playtest-report__trace').first().evaluate(element => ({ width: innerWidth, scrollTop: element.scrollTop, height: element.clientHeight, textLength: element.textContent?.length })))
    await page.screenshot({ path: info.outputPath(`executed-path-report-${width}.png`), animations: 'disabled' })
  }
  await report.getByRole('button', { name: 'adv/chapters/stay.adv.md:3', exact: true }).click()
  await expect.poll(() => page.evaluate(() => {
    const route = new URL((window as any).creativeAuthorFixture.route(), location.origin)
    return { path: route.pathname, file: route.searchParams.get('file'), line: route.searchParams.get('line'), column: route.searchParams.get('column') }
  })).toEqual({ path: '/editor', file: 'adv/chapters/stay.adv.md', line: '3', column: '1' })
  const records = await page.evaluate(() => (window as any).creativeAuthorFixture.playtests())
  expect(Object.keys(records)).toHaveLength(3)
  expect(errors).toEqual([])
  expect(warnings).toEqual([])
  await writeFile(info.outputPath('executed-path-evidence.json'), JSON.stringify({ scope: 'Actual ADV.JS core runtime execution and private IndexedDB cache; explicitly mocked auth/history transport, no model, media playback or production service certification', records, viewports, errors, warnings }, null, 2))
})

test('returns an actual candidate compiler finding to the writer, reviews a repair and retests the same inputs', async ({ page }, info) => {
  const errors: string[] = []
  const warnings: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error')
      errors.push(message.text())
    if (message.type() === 'warning')
      warnings.push(message.text())
  })
  await page.goto('/tests/fixtures/creative-team/authoring.html')
  await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeAuthorFixture))).toBe(true)
  const before = await page.evaluate(() => (window as any).creativeAuthorFixture.files())
  await page.locator('.team-artifact').filter({ hasText: '本地 fixture 人物初稿' }).getByRole('button', { name: '选定候选并继续' }).click()
  const original = page.locator('.team-artifact').filter({ hasText: '本地 fixture 章节初稿' }).first()
  await original.getByRole('button', { name: '编辑候选', exact: true }).click()
  const form = page.getByTestId('creative-candidate-editor')
  await form.getByLabel('AdvScript', { exact: true }).fill('# 车站 {#arrival}\n\n- [悬空引用](missing#ending)')
  await form.getByLabel('本次修改的原因').fill('明确植入一个用于修复流程验收的悬空引用')
  await form.getByRole('button', { name: '保存候选修订' }).click()
  await page.locator('.team-artifact').filter({ hasText: '作者修订 · 尚未写入项目' }).getByRole('button', { name: '选定候选并继续' }).click()
  const panel = page.getByTestId('creative-playtest')
  await panel.getByRole('combobox', { name: '执行快照', exact: true }).selectOption('candidate')
  await panel.getByLabel('预期结局地址', { exact: true }).fill('stay#ending-stay')
  await panel.getByLabel('选择序列（从 0 开始，以英文逗号分隔）', { exact: true }).fill('0')
  await panel.getByRole('button', { name: '执行这些路径', exact: true }).click()
  await expect(panel.getByText('已同步作者宿主报告，服务端未重放', { exact: true })).toBeVisible()
  const repair = page.getByTestId('creative-playtest-repair')
  await repair.getByRole('combobox', { name: '报告问题', exact: true }).selectOption({ label: 'ADV_RUNTIME_UNKNOWN_TARGET · adv/chapters/station.adv.md' })
  await repair.getByRole('combobox', { name: '负责任务', exact: true }).selectOption('script')
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await repair.scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath(`repair-review-${width}.png`), animations: 'disabled' })
  }
  await repair.getByRole('button', { name: '按此报告返工', exact: true }).click()
  await expect(page.getByTestId('creative-repair-reference')).toContainText('diagnostic:')
  const fixed = page.locator('.team-artifact').filter({ hasText: '本地 fixture 章节初稿' }).filter({ hasText: '待审阅' }).last()
  await expect(fixed.getByRole('button', { name: '选定候选并继续' })).toBeVisible()
  const handoffs = await page.evaluate(() => (window as any).creativeAuthorFixture.repairHandoffs()) as any[]
  expect(handoffs).toHaveLength(1)
  expect(handoffs[0].repair.finding.code).toBe('ADV_RUNTIME_UNKNOWN_TARGET')
  expect(handoffs[0].repair.files['adv/chapters/station.adv.md']).toContain('missing#ending')
  expect(handoffs[0].facts.files['adv/chapters/station.adv.md']).toBe(before['adv/chapters/station.adv.md'])
  expect(await page.evaluate(() => (window as any).creativeAuthorFixture.files())).toEqual(before)
  await fixed.getByRole('button', { name: '选定候选并继续' }).click()
  await panel.getByRole('button', { name: '载入这份报告的复现输入' }).click()
  await panel.getByRole('button', { name: '执行这些路径', exact: true }).click()
  await expect(page.getByTestId('creative-playtest-report').getByRole('heading', { name: /指定路径通过/ })).toHaveCount(1)
  const run = await page.evaluate(() => (window as any).creativeAuthorFixture.run()) as any
  expect(run.tasks.find((item: any) => item.taskId === 'script').attempt).toBe(2)
  expect(run.decisions.filter((item: any) => item.playtestRepair)).toHaveLength(1)
  const reports = await page.evaluate(() => (window as any).creativeAuthorFixture.playtests()) as any
  expect(Object.values(reports).map((item: any) => item.executions[0].code)).toEqual(['compile_failed', 'completed'])
  expect(Object.values(reports).map((item: any) => item.executions[0].scenario)).toEqual([{ id: 'path-1', expectedEnding: 'stay#ending-stay', choices: [0] }, { id: 'path-1', expectedEnding: 'stay#ending-stay', choices: [0] }])
  await page.reload()
  await expect(page.getByTestId('creative-repair-reference')).toBeVisible()
  expect((await page.evaluate(() => (window as any).creativeAuthorFixture.calls()) as string[]).filter(call => call.startsWith('POST'))).toEqual([])
  expect(errors).toEqual([])
  expect(warnings).toEqual([])
  await writeFile(info.outputPath('owner-repair-evidence.json'), JSON.stringify({ scope: 'Actual compiler, candidate editing, isolated execution and report persistence. Explicit fixture owner response/auth/history; no model quality or billing claim.', run, handoffs, reports, errors, warnings }, null, 2))
})

test('imports a real character image, reviews the catalog and renders the adopted bytes in the product player after reopen', async ({ page }, info) => {
  const errors: string[] = []
  const warnings: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error')
      errors.push(message.text())
    if (message.type() === 'warning')
      warnings.push(message.text())
  })
  await page.goto('/tests/fixtures/creative-team/art-import.html')
  await expect(page).toHaveTitle('Creative art import UI fixture')
  await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeArtFixture))).toBe(true)
  const files = () => page.evaluate(() => (window as any).creativeArtFixture.files())
  const before = await files()
  const panel = page.getByTestId('creative-art-import')
  await panel.getByRole('combobox', { name: '美术素材需求', exact: true }).selectOption({ label: 'character/xiaoyun/default · 619 × 619' })
  await panel.getByLabel('选择图片文件', { exact: true }).setInputFiles(resolve(import.meta.dirname, '../../../../demo/starter/public/img/characters/xiaoyun.webp'))
  await panel.getByLabel('素材来源与署名', { exact: true }).fill('ADV.JS demo/starter 已有小云图片，仅用于本地回流集成回归。')
  await panel.getByRole('button', { name: '保存图片候选', exact: true }).click()
  const candidate = page.getByTestId('creative-art-candidate')
  await expect(candidate.getByRole('img')).toBeVisible()
  await expect.poll(() => candidate.getByRole('img').evaluate((element: HTMLImageElement) => ({ loaded: element.complete, width: element.naturalWidth, height: element.naturalHeight }))).toEqual({ loaded: true, width: 619, height: 619 })
  expect(await files()).toEqual(before)
  await page.reload()
  await expect(candidate.getByRole('img')).toBeVisible()
  expect(await files()).toEqual(before)
  expect((await page.evaluate(() => (window as any).creativeArtFixture.calls()) as string[]).filter(call => call.startsWith('POST'))).toEqual([])
  await candidate.getByRole('button', { name: '审阅导入', exact: true }).click()
  await expect(candidate.getByText('adv/assets/other.json', { exact: true })).toBeVisible()
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await candidate.scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath(`image-adoption-review-${width}.png`), animations: 'disabled' })
  }
  await candidate.getByRole('button', { name: '确认采用此图片', exact: true }).click()
  await expect(candidate.getByRole('heading', { name: /已采用到本机项目/ })).toBeVisible()
  const media = await page.evaluate(() => (window as any).creativeArtFixture.media()) as any[]
  expect(media).toHaveLength(1)
  expect(media[0].sha256).toBe(media[0].expectedSha256)
  expect(media[0].bytes).toBe(media[0].expectedBytes)
  const adopted = await files()
  expect(adopted['adv/characters/xiaoyun.character.md']).toBe(before['adv/characters/xiaoyun.character.md'])
  await page.reload()
  await expect(candidate.getByRole('heading', { name: /已采用到本机项目/ })).toBeVisible()
  await expect(candidate.getByRole('button', { name: '撤销图片目录与绑定' })).toBeVisible()
  await candidate.getByRole('button', { name: '撤销图片目录与绑定' }).click()
  await expect(candidate.getByRole('heading', { name: /目录与绑定已撤销/ })).toBeVisible()
  expect(await files()).toEqual(before)
  // Import again through the same author controls; the immutable bytes may be reused safely.
  await panel.getByRole('combobox', { name: '美术素材需求', exact: true }).selectOption({ label: 'character/xiaoyun/default · 619 × 619' })
  await panel.getByLabel('选择图片文件', { exact: true }).setInputFiles(resolve(import.meta.dirname, '../../../../demo/starter/public/img/characters/xiaoyun.webp'))
  await panel.getByLabel('素材来源与署名', { exact: true }).fill('ADV.JS demo/starter 既有角色素材。')
  await panel.getByRole('button', { name: '保存图片候选', exact: true }).click()
  const fresh = candidate.filter({ hasText: '图片候选，未写入项目' })
  await fresh.getByRole('button', { name: '审阅导入', exact: true }).click()
  await fresh.getByRole('button', { name: '确认采用此图片', exact: true }).click()
  await expect(candidate.filter({ hasText: '已采用到本机项目' })).toHaveCount(1)
  const finalFiles = await files()
  const calls = await page.evaluate(() => (window as any).creativeArtFixture.calls()) as string[]
  expect(calls.filter(call => call.startsWith('POST'))).toEqual([])
  await page.goto('/tabs/play')
  await expect(page).toHaveURL(/\/tabs\/play/)
  const avatar = page.locator('.dialog-avatar-wrap img')
  await expect(avatar).toBeVisible()
  await expect.poll(() => avatar.evaluate((element: HTMLImageElement) => ({ loaded: element.complete, width: element.naturalWidth, height: element.naturalHeight, local: element.src.startsWith('blob:') }))).toEqual({ loaded: true, width: 619, height: 619, local: true })
  const paints: unknown[] = []
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    const toolbar = page.getByTestId('play-toolbar-actions')
    await expect(toolbar.locator('ion-button:visible')).toHaveCount(width === 390 ? 1 : 8)
    if (width === 390) {
      await toolbar.getByRole('button', { name: '设置', exact: true }).click()
      const menu = page.locator('.adv-popover-menu:visible')
      await expect(menu.getByText('存档', { exact: true })).toBeVisible()
      await expect(menu.getByText('读档', { exact: true })).toBeVisible()
      await expect(menu.getByText('全屏', { exact: true })).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(menu).toHaveCount(0)
    }
    await expect(avatar).toBeVisible()
    await expect.poll(() => avatar.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(619)
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    await expect(avatar).toBeInViewport()
    paints.push(await avatar.evaluate((element) => {
      const result = []
      for (let parent: Element | null = element; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent)
        result.push({ tag: parent.tagName, class: parent.className, opacity: style.opacity, display: style.display, visibility: style.visibility, animation: style.animationName })
      }
      return result
    }))
    await page.screenshot({ path: info.outputPath(`adopted-image-player-${width}.png`), animations: 'allow' })
  }
  expect(errors).toEqual([])
  expect(warnings).toEqual([])
  await writeFile(info.outputPath('image-import-evidence.json'), JSON.stringify({ scope: 'Actual existing repository image imported through browser decoding, native project transaction, IndexedDB recovery and real product GamePlayer. Art proposal/auth/history are explicit fixtures. No generation, fees or final story art-quality claim.', media, before, finalFiles, calls, paints, errors, warnings }, null, 2))
})

test('writes reviewed text through the project transaction, recovers a lost receipt after reload and conditionally undoes', async ({ page }, info) => {
  const errors: string[] = []
  const warnings: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error')
      errors.push(message.text())
    if (message.type() === 'warning')
      warnings.push(message.text())
  })
  await page.goto('/tests/fixtures/creative-team/authoring.html')
  await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeAuthorFixture))).toBe(true)
  const readFiles = () => page.evaluate(async () => (window as any).creativeAuthorFixture.files())
  const before = await readFiles()
  await page.locator('.team-artifact').filter({ hasText: '本地 fixture 人物初稿' }).getByRole('button', { name: '选定候选并继续' }).click()
  await page.locator('.team-artifact').filter({ hasText: '本地 fixture 章节初稿' }).getByRole('button', { name: '选定候选并继续' }).click()
  const panel = page.getByTestId('creative-milestone')
  await panel.getByRole('checkbox', { name: '本地 fixture 人物初稿' }).check()
  await panel.getByRole('checkbox', { name: '本地 fixture 章节初稿' }).check()
  await panel.getByLabel('采用或撤销的原因').fill('采用已审阅的两个文字成果')
  await panel.getByRole('button', { name: '审阅采用', exact: true }).click()
  await expect(panel.getByText('候选快照编译通过，请核对下面的文件变化。')).toBeVisible()
  expect(await readFiles()).toEqual(before)
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await panel.scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath(`milestone-review-fixture-${width}.png`), animations: 'disabled' })
  }
  await page.evaluate(() => (window as any).creativeAuthorFixture.loseMilestoneResponse('confirm'))
  await panel.getByRole('button', { name: '确认写入项目', exact: true }).click()
  await expect(panel.getByRole('button', { name: '同步采用回执' })).toBeVisible()
  const after = await readFiles()
  expect(after).not.toEqual(before)
  expect(after['adv/characters/lin.character.md']).toContain('## 理念')
  expect(after['adv/chapters/station.adv.md']).toContain('确定性 UI fixture')
  await page.reload()
  await expect(panel.getByRole('button', { name: '同步采用回执' })).toBeVisible()
  const calls = await page.evaluate(() => (window as any).creativeAuthorFixture.calls()) as string[]
  expect(calls.filter(call => call.startsWith('POST'))).toEqual([])
  expect(await readFiles()).toEqual(after)
  await panel.getByRole('button', { name: '同步采用回执' }).click()
  await expect(panel.getByText(/最近一次采用已确认/)).toBeVisible()
  expect(await readFiles()).toEqual(after)
  await panel.getByLabel('采用或撤销的原因').fill('条件撤销这次文字采用')
  await panel.getByRole('button', { name: '审阅最近一次撤销' }).click()
  await panel.getByRole('button', { name: '确认撤销本次采用' }).click()
  await expect(panel.getByText(/最近一次撤销已确认/)).toBeVisible()
  expect(await readFiles()).toEqual(before)
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await panel.scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath(`milestone-fixture-${width}.png`), animations: 'disabled' })
  }
  expect(errors).toEqual([])
  expect(warnings).toEqual([])
  await writeFile(info.outputPath('milestone-scope.json'), JSON.stringify({ scope: 'local protocol fixture; actual project transaction and durable IndexedDB journal; no model or billing; exact files restored by conditional undo', errors, warnings }, null, 2))
})

/** Positive authoring states use an explicitly labelled local fixture, never a model service. */
test('edits cast and chapter candidates with an explicit fixture and restores the saved revisions', async ({ page }, info) => {
  const errors: string[] = []
  const warnings: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error')
      errors.push(message.text())
    if (message.type() === 'warning')
      warnings.push(message.text())
  })
  await page.goto('/tests/fixtures/creative-team/authoring.html')
  await expect(page.getByText('仅验证界面与创作协议，不作为六角色真实交付。')).toBeVisible()
  const readFiles = () => page.evaluate(async () => (window as any).creativeAuthorFixture.files())
  await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeAuthorFixture))).toBe(true)
  const before = await readFiles()
  const original = page.locator('.team-artifact').filter({ hasText: '本地 fixture 人物初稿' }).first()
  await original.getByRole('button', { name: '编辑候选', exact: true }).click()
  const form = page.getByTestId('creative-candidate-editor')
  await expect(form.getByLabel('修订摘要')).toBeFocused()
  await form.locator('textarea[id$="-lin-motivation"]').fill('先找到信的主人，再决定如何归还')
  await form.getByLabel('本次修改的原因').fill('让人物的选择更明确')
  await form.getByRole('button', { name: '保存候选修订' }).click()
  const revisedCast = page.locator('.team-artifact').filter({ hasText: '作者修订 · 尚未写入项目' })
  await expect(revisedCast).toHaveCount(1)
  await expect(revisedCast.getByRole('heading', { name: '本地 fixture 人物初稿' })).toBeFocused()
  await revisedCast.getByRole('button', { name: '选定候选并继续' }).click()
  const chapter = page.locator('.team-artifact').filter({ hasText: '本地 fixture 章节初稿' }).first()
  await chapter.getByRole('button', { name: '编辑候选', exact: true }).click()
  const script = form.getByLabel('AdvScript', { exact: true })
  await expect(script).toHaveValue(/先找到信的主人/)
  await script.fill((await script.inputValue()).replace('你在等谁？', '请告诉我，你在等谁？'))
  await form.getByLabel('本次修改的原因').fill('作者调整开场对白')
  await form.getByRole('button', { name: '保存候选修订' }).click()
  await expect(page.locator('.team-artifact').filter({ hasText: '作者修订 · 尚未写入项目' })).toHaveCount(2)
  expect(await readFiles()).toEqual(before)
  const editedChapter = page.locator('.team-artifact').filter({ hasText: '作者修订 · 尚未写入项目' }).filter({ hasText: '本地 fixture 章节初稿' }).last()
  await editedChapter.getByRole('button', { name: '选定候选并继续' }).click()
  const playtest = page.getByTestId('creative-playtest')
  await playtest.getByRole('combobox', { name: '执行快照', exact: true }).selectOption('candidate')
  await playtest.getByLabel('预期结局地址', { exact: true }).fill('stay#ending-stay')
  await playtest.getByLabel('选择序列（从 0 开始，以英文逗号分隔）', { exact: true }).fill('0')
  await playtest.getByRole('button', { name: '执行这些路径', exact: true }).click()
  const pathReport = page.getByTestId('creative-playtest-report')
  await expect(pathReport.getByRole('heading', { name: /指定路径通过/ })).toHaveCount(1)
  const executed = await page.evaluate(() => Object.values((window as any).creativeAuthorFixture.playtests())[0]) as any
  expect(executed.scope).toBe('candidate')
  expect(executed.snapshotRevision).not.toBe(executed.baselineRevision)
  expect(executed.executions[0].trace.some((step: any) => step.text?.includes('请告诉我，你在等谁？'))).toBe(true)
  expect(await readFiles()).toEqual(before)

  await page.reload()
  await expect(page.locator('.team-artifact').filter({ hasText: '作者修订 · 尚未写入项目' })).toHaveCount(2)
  const revisedChapter = page.locator('.team-artifact').filter({ hasText: '作者修订 · 尚未写入项目' }).filter({ hasText: '本地 fixture 章节初稿' }).last()
  await revisedChapter.getByRole('button', { name: '编辑候选', exact: true }).click()
  await expect(page.getByTestId('creative-candidate-editor').getByLabel('AdvScript', { exact: true })).toHaveValue(/请告诉我，你在等谁？/)
  expect(await readFiles()).toEqual(before)
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.getByTestId('creative-candidate-editor').scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath(`candidate-editor-fixture-${width}.png`), animations: 'disabled' })
  }
  expect(errors).toEqual([])
  await writeFile(info.outputPath('fixture-scope.json'), JSON.stringify({ scope: 'explicit local UI fixture; no model or billing; candidates only; project unchanged', errors, warnings }, null, 2))
})

/** Real product entry, local project only: this test never configures or calls a paid service. */
test('opens creative partners, prevents unavailable generation and preserves the content editor draft', async ({ page }, info) => {
  test.setTimeout(120000)
  const errors: string[] = []
  const warnings: string[] = []
  const paidRequests: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error')
      errors.push(message.text())
    if (message.type() === 'warning')
      warnings.push(message.text())
  })
  await page.route('**/ai/v2/apps/advjs-studio-web/creative-team/**', async (route) => {
    if (route.request().method() === 'POST')
      paidRequests.push(route.request().url())
    await route.abort()
  })
  await page.goto('/tabs/workspace')
  await page.getByText('立即体验', { exact: true }).first().click()
  await expect(page).toHaveURL(/\/tabs\/world$/)
  await page.goto('/tabs/workspace')
  await page.getByRole('link', { name: /与制作组一起创作/ }).click()
  await expect(page).toHaveURL(/workspace\/creative-team/)
  await expect(page).toHaveTitle(/ADV.JS Studio/)
  const workspace = page.locator('.team-workspace')
  await expect(workspace).toContainText('登录后可查看制作组服务')
  await expect(workspace.locator('.partner-roster__item')).toHaveCount(6)
  await expect(page.locator('.managed-agent-dock, .managed-agent-rail')).toHaveCount(0)
  await expect.poll(() => workspace.evaluate(element => new DOMMatrix(getComputedStyle(element.closest('.ion-page')!).transform).m41)).toBe(0)
  const writer = workspace.getByRole('button', { name: /^编剧/ })
  await writer.focus()
  await writer.press('Enter')
  await expect(writer).toHaveAttribute('aria-pressed', 'true')
  await workspace.getByLabel('这次想完成什么？').fill('请润色一段很长的中文对白，保留人物的克制口吻、明确的说话动机与雨夜车站的悬疑氛围。'.repeat(3))
  await workspace.getByLabel('本次总点数上限').fill('20')
  await workspace.getByLabel('本次总点数上限').blur()
  await expect(workspace.getByRole('button', { name: '建立任务并审阅' })).toBeDisabled()
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  await expect.poll(() => workspace.evaluate(element => new DOMMatrix(getComputedStyle(element.closest('.ion-page')!).transform).m41)).toBe(0)
  await expect(page.locator('ion-toast')).toHaveCount(0)
  await workspace.evaluate(async element => (element.closest('ion-content') as HTMLElement & { scrollToTop: (duration: number) => Promise<void> }).scrollToTop(0))
  await page.screenshot({ path: info.outputPath('creative-team-desktop.png'), fullPage: true, animations: 'disabled' })
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    await workspace.evaluate(async element => (element.closest('ion-content') as HTMLElement & { scrollToTop: (duration: number) => Promise<void> }).scrollToTop(0))
    // Ionic's page transition may still be running after the route and text are ready.
    await expect.poll(async () => {
      const bounds = await workspace.boundingBox()
      return bounds!.x + bounds!.width
    }).toBeLessThanOrEqual(width + 1)
    expect((await workspace.boundingBox())!.x).toBeGreaterThanOrEqual(0)
    await page.screenshot({ path: info.outputPath(`creative-team-${width}.png`), fullPage: true, animations: 'disabled' })
  }

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/tabs/workspace/characters')
  await page.locator('.cc').first().click()
  const editor = page.locator('ion-modal.show-modal').last()
  const name = editor.getByRole('textbox', { name: '角色名', exact: true })
  await name.fill('未保存的创作草稿')
  await editor.getByRole('button', { name: '创作伙伴', exact: true }).click()
  const team = page.locator('ion-modal.show-modal').last()
  await expect(team.locator('.team-workspace')).toContainText('编辑器中未保存的内容不会发送')
  await team.getByRole('button', { name: '返回编辑', exact: true }).click()
  await expect(name).toHaveValue('未保存的创作草稿')
  await expect(editor).toBeVisible()
  await editor.getByRole('button', { name: '创作伙伴', exact: true }).click()
  await team.getByRole('link', { name: '打开文件编辑器', exact: true }).click()
  await expect(page).toHaveURL(/\/editor$/)
  await expect(page.locator('ion-modal.show-modal')).toHaveCount(0)
  expect(await page.evaluate(() => Object.entries(localStorage).some(([key, value]) => key.startsWith('advjs-studio-draft-') && value.includes('未保存的创作草稿')))).toBe(true)
  expect(paidRequests).toEqual([])
  expect(errors).toEqual([])
  await writeFile(info.outputPath('browser-checks.json'), JSON.stringify({ url: page.url(), title: await page.title(), widths: [1280, 390, 320], errors, warnings, paidRequests, scope: 'real product entry; local project; no managed service execution' }, null, 2))
})

test('returns real external speech to a stable line, auditions and adopts it, and plays it through the product audio backend', async ({ page }, info) => {
  const audioPath = process.env.STUDIO_CREATIVE_VOICE_WAV
  test.skip(!audioPath, 'Requires a genuine spoken WAV supplied by STUDIO_CREATIVE_VOICE_WAV; no placeholder tone is substituted')
  const errors: string[] = []
  const warnings: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error')
      errors.push(message.text())
    if (message.type() === 'warning')
      warnings.push(message.text())
  })
  await page.addInitScript(() => {
    const records: any[] = []
    const connections: any[] = []
    Object.assign(window, { realVoicePlayback: { records, connections } })
    const start = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (...args: Parameters<typeof start>) {
      if (this.buffer && this.buffer.duration > 0.1) {
        const row = { duration: this.buffer.duration, sampleRate: this.buffer.sampleRate, channels: this.buffer.numberOfChannels, state: this.context.state, startedAt: this.context.currentTime, wallStart: performance.now(), ended: false, elapsed: 0, wallElapsed: 0, trusted: false }
        records.push(row)
        this.addEventListener('ended', (event) => {
          row.ended = true
          row.elapsed = this.context.currentTime - row.startedAt
          row.wallElapsed = performance.now() - row.wallStart
          row.trusted = event.isTrusted
        }, { once: true })
      }
      return start.apply(this, args)
    }
    const connect = AudioNode.prototype.connect
    AudioNode.prototype.connect = function (...args: any[]) {
      connections.push({ from: this.constructor.name, to: args[0]?.constructor.name, gain: this instanceof GainNode ? this.gain.value : undefined })
      return (connect as any).apply(this, args)
    }
  })
  const fixtureUrl = '/tests/fixtures/creative-team/voice-import.html'
  const lineId = 'line_01900400-0000-7000-8000-000000000001'
  const reviewUrl = `/tabs/workspace/audio?section=review&speaker=lin&line=${lineId}`
  await page.goto(fixtureUrl)
  await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeVoiceFixture))).toBe(true)
  const files = () => page.evaluate(async () => (window as any).creativeVoiceFixture.files())
  const before = await files()
  const panel = page.getByTestId('creative-voice-import')
  await panel.getByRole('button', { name: '核对实际对白', exact: true }).click()
  await expect(panel.getByText(lineId, { exact: true })).toBeVisible()
  await panel.getByLabel('选择真实对白 WAV').setInputFiles(audioPath!)
  await panel.getByLabel('制作来源、署名与使用说明').fill('本机 macOS say Tingting 175 wpm 外部制作，ffmpeg 转为 22050 Hz 单声道 PCM WAV，人工回流；没有托管媒体回执。')
  await panel.getByRole('button', { name: '审阅未选配音候选', exact: true }).click()
  await expect(panel.getByText('请核对原始字节、音色来源与文件变化。确认仅登记 VoiceTake，尚未采用到游戏。')).toBeVisible()
  expect(await files()).toEqual(before)
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await panel.locator('.voice-import__review').scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath(`voice-import-review-${width}.png`), animations: 'disabled' })
  }
  await panel.getByRole('button', { name: '登记未选配音候选', exact: true }).click()
  await expect(panel.getByText('已登记到项目对白账本，尚未采用。请试听并独立确认采用。')).toBeVisible()
  const registered = await files()
  const binding = JSON.parse(registered['adv/audio/voice-ledger.json']).lines[lineId].locales['zh-CN']
  expect(binding.selectedTake).toBeNull()
  expect(binding.takes).toHaveLength(1)
  await page.reload()
  await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeVoiceFixture))).toBe(true)
  expect(await files()).toEqual(registered)
  const media = await page.evaluate(async () => (window as any).creativeVoiceFixture.media())
  expect(media).toHaveLength(1)
  expect(media[0].sha256).toBe(createHash('sha256').update(await readFile(audioPath!)).digest('hex'))
  expect(media[0].sha256).toBe(media[0].expectedSha256)
  expect(media[0].bytes).toBe(media[0].expectedBytes)
  const calls = await page.evaluate(() => (window as any).creativeVoiceFixture.calls()) as string[]
  expect(calls.filter(call => call.startsWith('POST'))).toEqual([])
  await page.goto(reviewUrl)
  const workspace = page.getByTestId('audio-workspace')
  const take = workspace.locator('.voice-review__take')
  await expect(take).toHaveCount(1)
  await expect(take.locator('.voice-review__warning')).toHaveCount(0)
  await take.getByRole('button', { name: '试听', exact: true }).click()
  const player = workspace.locator('audio')
  await expect.poll(() => player.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(0.4)
  const audition = await player.evaluate((element: HTMLAudioElement) => ({ duration: element.duration, currentTime: element.currentTime, paused: element.paused, src: element.currentSrc, muted: element.muted, volume: element.volume }))
  expect(audition.duration).toBeGreaterThan(1)
  expect(audition.muted).toBe(false)
  await take.getByRole('button', { name: '绑定此 take', exact: true }).click()
  await workspace.getByRole('checkbox', { name: '我已试听并确认本次采用与替换范围' }).check()
  await workspace.getByRole('button', { name: '确认采用', exact: true }).click()
  await expect(take.locator('.voice-review__take-header')).toContainText('已选')
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await take.scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath(`voice-adopted-${width}.png`), animations: 'disabled' })
  }
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/tabs/play')
  await expect(page.locator('.game-player')).toContainText('列车还没有到，我们再等一会儿。')
  // Real pointer activation unlocks the existing backend; restarting replays the adopted first line.
  await page.locator('.game-player .adv-ui').click({ position: { x: 200, y: 300 } })
  await page.getByTestId('play-toolbar-actions').getByRole('button', { name: '设置', exact: true }).click()
  await page.locator('.adv-popover-menu:visible').getByText('重新开始', { exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as any).realVoicePlayback.records.some((record: any) => record.ended && record.trusted && record.state === 'running' && record.elapsed >= record.duration - 0.15 && record.wallElapsed >= (record.duration - 0.2) * 1000)), { timeout: 12000 }).toBe(true)
  const playback = await page.evaluate(() => (window as any).realVoicePlayback)
  expect(playback.connections.some((connection: any) => connection.to === 'AudioDestinationNode' && connection.gain > 0)).toBe(true)
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.screenshot({ path: info.outputPath(`voice-product-player-${width}.png`), animations: 'allow' })
  }
  await page.goto(fixtureUrl)
  await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeVoiceFixture))).toBe(true)
  const adopted = await files()
  expect(JSON.parse(adopted['adv/audio/voice-ledger.json']).lines[lineId].locales['zh-CN'].selectedTake).toBe(binding.takes[0].id)
  await page.evaluate(() => (window as any).creativeVoiceFixture.replaceDialogue())
  await page.goto(reviewUrl)
  await expect(workspace.locator('.voice-review__warning')).toContainText('文本已变化')
  await expect(workspace.locator('.voice-review__text').first()).toContainText('列车已经到了，我们走吧。')
  await page.screenshot({ path: info.outputPath('voice-stale-after-dialogue-edit-390.png'), animations: 'disabled' })
  expect(errors).toEqual([])
  expect(warnings).toEqual([])
  await writeFile(info.outputPath('real-voice-evidence.json'), JSON.stringify({ scope: 'External macOS say speech manually imported, decoded, persisted, auditioned and explicitly adopted through actual Studio code. Actual GamePlayer Web Audio graph used original browser methods, running context, nonzero destination gain and a natural-duration trusted end event. No physical-speaker measurement, human quality score, hosted generation or final-team receipt.', media, before, registered, adopted, audition, playback, calls, errors, warnings }, null, 2))
})

for (const destination of ['after', 'before'] as const) {
  test(`recovers a real interrupted voice registration to ${destination} through the durable media journal`, async ({ page }, info) => {
    const audioPath = process.env.STUDIO_CREATIVE_VOICE_WAV
    test.skip(!audioPath, 'Requires genuine external speech; no test waveform substitute')
    await page.goto('/tests/fixtures/creative-team/voice-import.html')
    await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeVoiceFixture))).toBe(true)
    const files = () => page.evaluate(async () => (window as any).creativeVoiceFixture.files())
    const before = await files()
    const panel = await stageRealRecoveryVoice(page, audioPath!)
    await page.reload()
    await expect(panel.getByRole('button', { name: '登记未选配音候选', exact: true })).toBeVisible()
    expect(await files()).toEqual(before)
    await page.evaluate(() => (window as any).creativeVoiceFixture.crashAfterText(1))
    await panel.getByRole('button', { name: '登记未选配音候选', exact: true }).click()
    await expect.poll(() => page.evaluate(() => (window as any).creativeVoiceFixture.crashed())).toBe(true)
    const interrupted = await files()
    expect(interrupted).not.toEqual(before)
    const pending = await page.evaluate(async () => (window as any).creativeVoiceFixture.journal())
    expect(pending[0].state).toBe('registering')
    expect(pending[0].retainedBytes).toBeGreaterThan(0)
    await page.reload()
    await expect(panel.getByText('检测到本次操作的部分写入。已核对其余源文件未变；请审阅原始变化后，明确继续或恢复写前文件。')).toBeVisible()
    expect(await files()).toEqual(interrupted)
    expect(await page.evaluate(() => (window as any).creativeVoiceFixture.writes())).toEqual([])
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 })
      await panel.getByTestId('creative-voice-candidate').scrollIntoViewIfNeeded()
      await page.screenshot({ path: info.outputPath(`partial-voice-${destination}-${width}.png`), animations: 'disabled' })
    }
    await panel.getByRole('button', { name: destination === 'after' ? '继续已审阅配音登记' : '恢复配音登记前文件', exact: true }).click()
    await expect(panel.getByText(destination === 'after' ? '已登记，采用状态见配音审阅' : '登记文件已恢复，原始音频保留', { exact: false })).toBeVisible()
    const result = await files()
    if (destination === 'before') {
      expect(result).toEqual(before)
    }
    else {
      const ledger = JSON.parse(result['adv/audio/voice-ledger.json'])
      expect(ledger.lines[pending[0].target].locales['zh-CN'].selectedTake).toBeNull()
      expect(ledger.lines[pending[0].target].locales['zh-CN'].takes.map((take: any) => take.id)).toEqual([pending[0].takeId])
    }
    const journal = await page.evaluate(async () => (window as any).creativeVoiceFixture.journal())
    expect(journal[0].mediaHash).toBe(pending[0].mediaHash)
    expect(journal[0].mediaBytes).toBe(pending[0].mediaBytes)
    await page.reload()
    await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeVoiceFixture))).toBe(true)
    expect(await files()).toEqual(result)
    expect(await page.evaluate(() => (window as any).creativeVoiceFixture.writes())).toEqual([])
    await writeFile(info.outputPath('partial-voice-recovery.json'), JSON.stringify({ scope: 'Actual browser navigation interrupts a live native transaction after durable binary and first text write; actual private journal, filesystem recovery and original genuine speech bytes.', destination, before, interrupted, result, pending, journal }, null, 2))
  })
}

test('reopens an unacknowledged voice registration and confirms its local journal without another file write', async ({ page }, info) => {
  const audioPath = process.env.STUDIO_CREATIVE_VOICE_WAV
  test.skip(!audioPath, 'Requires genuine external speech')
  await page.goto('/tests/fixtures/creative-team/voice-import.html')
  await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeVoiceFixture))).toBe(true)
  const panel = await stageRealRecoveryVoice(page, audioPath!)
  await page.evaluate(() => (window as any).creativeVoiceFixture.loseRegistrationAck())
  await panel.getByRole('button', { name: '登记未选配音候选', exact: true }).click()
  await expect(panel.getByRole('alert')).toBeVisible()
  const written = await page.evaluate(async () => (window as any).creativeVoiceFixture.files())
  await page.reload()
  await expect(panel.getByText('登记待核对', { exact: false })).toBeVisible()
  await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeVoiceFixture))).toBe(true)
  expect(await page.evaluate(() => (window as any).creativeVoiceFixture.writes())).toEqual([])
  await panel.getByRole('button', { name: '核对媒体操作记录', exact: true }).click()
  await expect(panel.getByText('已登记，采用状态见配音审阅', { exact: false })).toBeVisible()
  expect(await page.evaluate(() => (window as any).creativeVoiceFixture.writes())).toEqual([])
  expect(await page.evaluate(async () => (window as any).creativeVoiceFixture.files())).toEqual(written)
  const journal = await page.evaluate(async () => (window as any).creativeVoiceFixture.journal())
  expect(journal[0].retainedBytes).toBe(0)
  await writeFile(info.outputPath('voice-registration-ack-recovery.json'), JSON.stringify({ scope: 'Real completed project write; explicit local journal acknowledgement fault; reopen and reconciliation perform no project writes.', written, journal }, null, 2))
})

test('blocks another media write while an image is partially adopted and restores its reviewed source', async ({ page }, info) => {
  const audioPath = process.env.STUDIO_CREATIVE_VOICE_WAV
  test.skip(!audioPath, 'Requires genuine external speech')
  await page.goto('/tests/fixtures/creative-team/voice-import.html')
  await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeVoiceFixture))).toBe(true)
  const files = () => page.evaluate(async () => (window as any).creativeVoiceFixture.files())
  const before = await files()
  const art = page.getByTestId('creative-art-import')
  await art.getByRole('combobox', { name: '美术素材需求', exact: true }).selectOption({ label: 'character/lin/default · 619 × 619' })
  await art.getByLabel('选择图片文件').setInputFiles(resolve(import.meta.dirname, '../../../../demo/starter/public/img/characters/xiaoyun.webp'))
  await art.getByLabel('素材来源与署名').fill('仓库现有小云图片，仅验证图片与配音的共同恢复互斥。')
  await art.getByRole('button', { name: '保存图片候选', exact: true }).click()
  await art.getByRole('button', { name: '审阅导入', exact: true }).click()
  await page.evaluate(() => (window as any).creativeVoiceFixture.crashAfterText(1))
  await art.getByRole('button', { name: '确认采用此图片', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as any).creativeVoiceFixture.crashed())).toBe(true)
  await page.reload()
  await expect(art.getByText('检测到本次操作的部分写入。已核对其余源文件未变；请审阅原始变化后，明确继续或恢复写前文件。')).toBeVisible()
  const partial = await files()
  const voice = await stageRealRecoveryVoice(page, audioPath!)
  await voice.getByRole('button', { name: '登记未选配音候选', exact: true }).click()
  await expect(voice.getByRole('alert')).toBeVisible()
  expect(await files()).toEqual(partial)
  expect(await page.evaluate(() => (window as any).creativeVoiceFixture.writes())).toEqual([])
  await art.getByRole('button', { name: '恢复图片采用前文件', exact: true }).click()
  await expect(art.getByText('图片候选，未写入项目', { exact: false })).toBeVisible()
  expect(await files()).toEqual(before)
  await writeFile(info.outputPath('cross-media-pending-recovery.json'), JSON.stringify({ scope: 'Actual image transaction interrupted after durable first text file; common IndexedDB intent guard refuses a new voice write; explicit original-file restoration preserves image bytes.', before, partial }, null, 2))
})

test('upgrades the original image journal without losing its pending candidate bytes', async ({ page }, info) => {
  const bytes = await readFile(resolve(import.meta.dirname, '../../../../demo/starter/public/img/characters/xiaoyun.webp'))
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const fixtureUrl = '/tests/fixtures/creative-team/art-import.html'
  await page.route(url => url.searchParams.get('legacySeed') === '1', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body>Explicit v1 journal migration seed</body></html>' }))
  await page.goto(`${fixtureUrl}?legacySeed=1`)
  await page.evaluate(async ({ bytes, sha256 }) => {
    const request = indexedDB.open('advjs-studio-creative-art-imports', 10)
    request.onupgradeneeded = () => {
      const table = request.result.createObjectStore('entries', { keyPath: ['accountId', 'projectId', 'runId', 'id'] })
      table.createIndex('[accountId+projectId+runId]', ['accountId', 'projectId', 'runId'])
    }
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const transaction = database.transaction('entries', 'readwrite')
    transaction.objectStore('entries').put({ accountId: 'art-fixture-author', projectId: 'creative-art-ui-fixture', runId: 'art_fixture_run', id: 'legacy-image', artifactId: 'art-fixture-proposal', artifactFingerprint: 'art-fixture-proposal-v1', request: { assetId: 'character/xiaoyun/default', kind: 'portrait', characterId: 'xiaoyun', width: 619, height: 619, prompt: '将仓库已有小云图片按原样导入对应角色，保留来源。', constraints: ['使用现有图片验证回流，不代表雨夜车站最终美术质量'] }, fileName: 'xiaoyun.webp', attribution: 'Existing v1 private image candidate; retain original bytes during schema upgrade', license: '', image: { mimeType: 'image/webp', sha256, bytes: bytes.length, width: 619, height: 619 }, data: new Uint8Array(bytes).buffer, createdAt: 0, state: 'candidate' })
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
  }, { bytes: [...bytes], sha256 })
  await page.goto(fixtureUrl)
  await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeArtFixture))).toBe(true)
  const candidate = page.getByTestId('creative-art-candidate')
  await expect(candidate).toContainText('Existing v1 private image candidate')
  await expect(candidate.getByRole('img')).toBeVisible()
  const before = await page.evaluate(async () => (window as any).creativeArtFixture.files())
  await candidate.getByRole('button', { name: '审阅导入', exact: true }).click()
  expect(await page.evaluate(async () => (window as any).creativeArtFixture.files())).toEqual(before)
  await candidate.getByRole('button', { name: '确认采用此图片', exact: true }).click()
  await expect(candidate).toContainText('已采用到本机项目')
  const media = await page.evaluate(async () => (window as any).creativeArtFixture.media())
  expect(media[0].sha256).toBe(sha256)
  expect(media[0].bytes).toBe(bytes.length)
  const schema = await page.evaluate(async () => {
    const request = indexedDB.open('advjs-studio-creative-art-imports')
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const result = { version: database.version, stores: [...database.objectStoreNames] }
    database.close()
    return result
  })
  expect(schema.version).toBe(20)
  expect(schema.stores).toContain('voiceEntries')
  await writeFile(info.outputPath('media-journal-v1-upgrade.json'), JSON.stringify({ scope: 'Actual native IndexedDB v1 schema and genuine retained image bytes; real Dexie v2 upgrade, canonical review and native image adoption.', schema, media }, null, 2))
})
