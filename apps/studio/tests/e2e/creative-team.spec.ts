import type { CreativeTeamRun } from '@advjs/agent'
import type { Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { expect, test } from '@playwright/test'

const consoleEvidence = new WeakMap<Page, { errors: string[], warnings: string[], lifecycle: { event: string, path: string }[], vite: string[], requestsFailed: { method: string, path: string, error?: string }[], hmr: { type: string, path?: string }[] }>()
test.beforeEach(({ page }) => {
  const evidence = { errors: [] as string[], warnings: [] as string[], lifecycle: [] as { event: string, path: string }[], vite: [] as string[], requestsFailed: [] as { method: string, path: string, error?: string }[], hmr: [] as { type: string, path?: string }[] }
  const path = (value: string) => {
    try {
      return new URL(value).pathname
    }
    catch {
      return 'unavailable'
    }
  }
  consoleEvidence.set(page, evidence)
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame())
      evidence.lifecycle.push({ event: 'navigation', path: path(frame.url()) })
  })
  page.on('domcontentloaded', () => evidence.lifecycle.push({ event: 'domcontentloaded', path: path(page.url()) }))
  page.on('requestfailed', request => evidence.requestsFailed.push({ method: request.method(), path: path(request.url()), error: request.failure()?.errorText }))
  page.on('websocket', socket => socket.on('framereceived', (frame) => {
    try {
      const message = JSON.parse(String(frame.payload))
      if (['full-reload', 'update', 'error', 'connected'].includes(message.type))
        evidence.hmr.push({ type: message.type, ...(typeof message.path === 'string' ? { path: message.path } : {}) })
    }
    catch {}
  }))
  page.on('pageerror', error => evidence.errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error')
      evidence.errors.push(message.text())
    if (message.type() === 'warning')
      evidence.warnings.push(message.text())
    if (message.text().startsWith('[vite]'))
      evidence.vite.push(message.text())
  })
})
test.afterEach(async ({ page }, info) => {
  const evidence = consoleEvidence.get(page)!
  const startup = info.status !== info.expectedStatus
    ? await Promise.race([
        page.evaluate(() => ({ readyState: document.readyState, boot: (window as any).creativeMediaBoot, body: (document.body.textContent ?? '').slice(0, 5000), modules: performance.getEntriesByType('resource').slice(-12).map(item => ({ path: new URL(item.name).pathname.slice(0, 300), duration: item.duration })) })).catch(() => ({ unavailable: true })),
        new Promise(resolve => setTimeout(resolve, 1000, { unavailable: true })),
      ])
    : undefined
  await writeFile(info.outputPath('browser-console.json'), JSON.stringify({ ...evidence, ...(startup ? { startup } : {}) }, null, 2))
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
  await expect.poll(() => page.evaluate(() => Object.keys((window as any).creativeAuthorFixture.playtests()).length)).toBe(3)
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
  await expect(panel.getByText('已同步作者宿主报告，服务端未重放', { exact: true })).toBeVisible()
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

test('reviews grounded narrative evidence, dismisses a false positive and rechecks a writer repair against the same endings', async ({ page }, info) => {
  await page.goto('/tests/fixtures/creative-team/authoring.html?case=narrative-review')
  await expect(page).toHaveTitle('Creative candidate UI fixture')
  await expect(page.getByRole('heading', { name: '候选编辑 UI fixture', exact: true })).toBeVisible()
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeAuthorFixture))).toBe(true)
  const before = await page.evaluate(() => (window as any).creativeAuthorFixture.files())
  await page.locator('.team-artifact').filter({ hasText: '本地 fixture 人物初稿' }).getByRole('button', { name: '选定候选并继续' }).click()
  await page.locator('.team-artifact').filter({ hasText: '本地 fixture 章节初稿' }).getByRole('button', { name: '选定候选并继续' }).click()
  await expect(page.locator('.team-artifact').filter({ hasText: '本地 fixture 剧情检查' })).toBeVisible()
  const panel = page.getByTestId('creative-playtest')
  await panel.getByRole('combobox', { name: '执行快照', exact: true }).selectOption('candidate')
  await panel.getByRole('button', { name: '载入试玩员提出的路径', exact: true }).click()
  await panel.getByRole('checkbox', { name: '随本次报告保存剧情核对', exact: true }).check()
  const form = page.getByTestId('creative-narrative-review')
  await expect(form.getByRole('combobox', { name: '作者判断', exact: true }).first()).toHaveValue('pending')
  await expect(form).toContainText('科技水平与当代相同，不存在超能力。')
  await form.getByRole('combobox', { name: '作者判断', exact: true }).nth(0).selectOption('confirmed')
  await expect(panel.getByRole('button', { name: '执行这些路径', exact: true })).toBeDisabled()
  await form.getByLabel('判断理由', { exact: true }).fill('这是客观事件，没有梦境或误认条件，违反世界规则。')
  await form.getByRole('combobox', { name: '作者判断', exact: true }).nth(1).selectOption('dismissed')
  await form.getByLabel('判断理由', { exact: true }).nth(1).fill('小说可以描写现实世界没有的能力，这里没有人物实际施法。')
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await form.evaluate(element => element.scrollIntoView({ block: 'start' }))
    await page.screenshot({ path: info.outputPath(`narrative-review-${width}.png`), animations: 'disabled' })
  }
  await panel.getByRole('button', { name: '执行这些路径', exact: true }).click()
  await expect(panel.getByText('已同步作者宿主报告，服务端未重放', { exact: true })).toBeVisible()
  const report = page.getByTestId('creative-narrative-report')
  await expect(report).toContainText('作者确认需要修改')
  await expect(report).toContainText('作者排除本次疑点')
  await expect(report).toContainText('语义判断来自作者')
  await expect(report.locator('select, textarea')).toHaveCount(0)
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await report.evaluate(element => element.scrollIntoView({ block: 'start' }))
    await page.screenshot({ path: info.outputPath(`narrative-report-${width}.png`), animations: 'disabled' })
    expect(await report.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  }
  const first = await page.evaluate(() => ({ reports: (window as any).creativeAuthorFixture.playtests(), sources: (window as any).creativeAuthorFixture.playtestSources() })) as any
  const initial = Object.values(first.reports)[0] as any
  expect(initial.executions.map((item: any) => item.status)).toEqual(['passed', 'passed'])
  expect(initial.narrativeReview.rows.map((item: any) => item.decision.status)).toEqual(['confirmed', 'dismissed'])
  expect(await page.evaluate(() => (window as any).creativeAuthorFixture.files())).toEqual(before)
  await page.reload()
  await expect(page.getByTestId('creative-narrative-report')).toContainText('作者确认需要修改')
  expect((await page.evaluate(() => (window as any).creativeAuthorFixture.calls()) as string[]).filter(call => call.startsWith('POST'))).toEqual([])
  const repair = page.getByTestId('creative-playtest-repair')
  await expect(repair.getByRole('combobox', { name: '报告问题', exact: true }).locator('option[value="narrative:1"]')).toHaveCount(0)
  await repair.getByRole('combobox', { name: '报告问题', exact: true }).selectOption('narrative:0')
  await repair.getByRole('combobox', { name: '负责任务', exact: true }).selectOption('script')
  await repair.getByRole('button', { name: '按此报告返工', exact: true }).click()
  const fixed = page.locator('.team-artifact').filter({ hasText: '本地 fixture 章节初稿' }).filter({ hasText: '待审阅' }).last()
  await fixed.getByRole('button', { name: '选定候选并继续' }).click()
  const rerun = page.getByTestId('creative-task-rework').filter({ has: page.locator('#creative-rework-check') })
  await rerun.getByLabel('说明要调整的地方').fill('编剧已经修改动作，请重新独立核对这两个结局的剧情依据。')
  await rerun.getByRole('button', { name: '请求返工', exact: true }).click()
  await panel.getByRole('button', { name: '载入这份报告的复现输入', exact: true }).click()
  await panel.getByRole('checkbox', { name: '随本次报告保存剧情核对', exact: true }).check()
  await expect(form.getByRole('combobox', { name: '作者判断', exact: true })).toHaveCount(1)
  await form.getByRole('combobox', { name: '作者判断', exact: true }).selectOption('dismissed')
  await form.getByLabel('判断理由', { exact: true }).fill('已对照新稿：人物正常步行，小说内容也不违背现实规则。')
  await panel.getByRole('button', { name: '执行这些路径', exact: true }).click()
  await expect(panel.getByText('已同步作者宿主报告，服务端未重放', { exact: true })).toBeVisible()
  await expect(report).not.toContainText('作者确认需要修改')
  await expect.poll(() => page.evaluate(() => Object.keys((window as any).creativeAuthorFixture.playtests()).length)).toBe(2)
  const final = await page.evaluate(() => ({ run: (window as any).creativeAuthorFixture.run(), reports: (window as any).creativeAuthorFixture.playtests(), sources: (window as any).creativeAuthorFixture.playtestSources(), handoffs: (window as any).creativeAuthorFixture.repairHandoffs() })) as any
  const reports = Object.values(final.reports) as any[]
  expect(reports).toHaveLength(2)
  expect(reports.map(item => item.executions.map((execution: any) => execution.status))).toEqual([['passed', 'passed'], ['passed', 'passed']])
  expect(reports[0].executions.map((item: any) => item.scenario)).toEqual(reports[1].executions.map((item: any) => item.scenario))
  expect(reports[0].snapshotRevision).not.toBe(reports[1].snapshotRevision)
  expect(reports[0].narrativeReview.artifactId).not.toBe(reports[1].narrativeReview.artifactId)
  expect(final.handoffs[0].repair.finding.kind).toBe('narrative')
  expect(final.handoffs[0].repair.files['adv/chapters/station.adv.md']).toContain('瞬移')
  expect(final.handoffs[0].facts.files['adv/world.md']).toContain('不存在超能力')
  expect(await page.evaluate(() => (window as any).creativeAuthorFixture.files())).toEqual(before)
  const evidence = { scope: 'Actual source-quote verification, author decisions, compiler/core execution, HTTP client, candidate provenance and IndexedDB reload. Explicit fixture critic/writer responses, identity and service persistence. No paid model-quality, semantic certification or whole-work claim.', before, first, final }
  await writeFile(info.outputPath('narrative-review-evidence.json'), JSON.stringify(evidence, null, 2))
})

test('retries an immutable legacy source revision, hands it downstream, adopts both files and conditionally undoes', async ({ page }, info) => {
  await page.goto('/tests/fixtures/creative-team/authoring.html?case=source-text')
  await expect(page).toHaveTitle('Creative candidate UI fixture')
  await expect(page.getByRole('heading', { name: '候选编辑 UI fixture', exact: true })).toBeVisible()
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeAuthorFixture))).toBe(true)
  const readFiles = () => page.evaluate(() => (window as any).creativeAuthorFixture.files())
  const before = await readFiles()
  const original = page.locator('.team-artifact').filter({ hasText: '本地 fixture 旧大纲' })
  await original.getByRole('button', { name: '编辑候选', exact: true }).click()
  const form = page.locator('[data-testid="creative-source-candidate-editor"]:visible')
  await expect(form.getByLabel('修订摘要')).toBeFocused()
  await form.getByLabel('修订摘要').fill('作者修订旧大纲')
  const outline = '# 雨夜车站\n\n先核对信封线索，再选择留下或离开。\n'
  await form.getByLabel('完整源文本', { exact: true }).fill(outline)
  await form.getByLabel('本次修改的原因').fill('明确交给编剧的信封线索')
  await page.evaluate(() => (window as any).creativeAuthorFixture.loseEditResponse())
  await form.getByRole('button', { name: '保存候选修订', exact: true }).click()
  await expect(form.getByRole('button', { name: '保存候选修订', exact: true })).toBeEnabled()
  await expect.poll(() => page.evaluate(() => (window as any).creativeAuthorFixture.editRequests().length)).toBe(1)
  await expect(form.getByLabel('完整源文本', { exact: true })).toHaveValue(outline)
  expect(await readFiles()).toEqual(before)
  await form.getByRole('button', { name: '保存候选修订', exact: true }).click()
  const revisedOutline = page.locator('.team-artifact').filter({ has: page.getByRole('heading', { name: '作者修订旧大纲', exact: true }) })
  await expect(revisedOutline).toHaveCount(1)
  const requests = await page.evaluate(() => (window as any).creativeAuthorFixture.editRequests()) as any[]
  expect(requests).toHaveLength(2)
  expect(requests[0]).toEqual(requests[1])
  await revisedOutline.getByRole('button', { name: '选定候选并继续', exact: true }).click()
  const chapter = page.locator('.team-artifact').filter({ hasText: '本地 fixture 旧章节' })
  await chapter.getByRole('button', { name: '编辑候选', exact: true }).click()
  const script = form.getByLabel('完整源文本', { exact: true })
  const originalChapter = await script.inputValue()
  expect(originalChapter).toContain('信封线索')
  const authored = originalChapter.replace('这封信还没有送到。', '列车还没有到，\n我们再**等一会儿**。')
  await script.fill(authored)
  await form.getByLabel('修订摘要').fill('作者修订旧章节')
  await form.getByLabel('本次修改的原因').fill('核对对白、旁白身份和两个分支')
  const callsBefore = await page.evaluate(() => (window as any).creativeAuthorFixture.calls())
  await form.getByRole('button', { name: '补齐台词身份', exact: true }).click()
  await expect(form.getByRole('status')).toContainText('已补齐 3 处，保留 0 处')
  const prepared = await script.inputValue()
  const markers = prepared.match(/ \{#line_[^}]+\}/g)!
  expect(markers).toHaveLength(3)
  expect(new Set(markers).size).toBe(3)
  expect(markers.reduce((text, marker) => text.replace(marker, ''), prepared)).toBe(authored)
  expect(await page.evaluate(() => (window as any).creativeAuthorFixture.calls())).toEqual(callsBefore)
  expect(await readFiles()).toEqual(before)
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await form.evaluate(element => element.scrollIntoView({ block: 'start' }))
    await page.screenshot({ path: info.outputPath(`legacy-source-editor-${width}.png`), animations: 'disabled' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await form.getByRole('button', { name: '保存候选修订', exact: true }).click()
  const revisedChapter = page.locator('.team-artifact').filter({ has: page.getByRole('heading', { name: '作者修订旧章节', exact: true }) })
  await revisedChapter.getByRole('button', { name: '选定候选并继续', exact: true }).click()
  const playtest = page.getByTestId('creative-playtest')
  await playtest.getByRole('combobox', { name: '执行快照', exact: true }).selectOption('candidate')
  await playtest.getByLabel('预期结局地址', { exact: true }).fill('stay#ending-stay')
  await playtest.getByLabel('选择序列（从 0 开始，以英文逗号分隔）', { exact: true }).fill('0')
  await playtest.getByRole('button', { name: '添加路径', exact: true }).click()
  await playtest.getByLabel('预期结局地址', { exact: true }).nth(1).fill('leave#ending-leave')
  await playtest.getByLabel('选择序列（从 0 开始，以英文逗号分隔）', { exact: true }).nth(1).fill('1')
  await playtest.getByRole('button', { name: '执行这些路径', exact: true }).click()
  await expect(playtest.getByText('已同步作者宿主报告，服务端未重放', { exact: true })).toBeVisible()
  await expect(page.getByTestId('creative-playtest-report').getByRole('heading', { name: /指定路径通过/ })).toHaveCount(2)
  const reviewed = await page.evaluate(() => ({ run: (window as any).creativeAuthorFixture.run(), reports: (window as any).creativeAuthorFixture.playtests() })) as any
  const report = Object.values(reviewed.reports)[0] as any
  expect(report.executions.map((execution: any) => execution.actualEnding)).toEqual(['stay#ending-stay', 'leave#ending-leave'])
  expect(report.executions.every((execution: any) => execution.trace.some((step: any) => step.kind === 'dialog' && step.text === '列车还没有到，\n我们再等一会儿。'))).toBe(true)
  expect(reviewed.run.artifacts).toHaveLength(4)
  expect(reviewed.run.artifacts.every((artifact: any) => !artifact.output)).toBe(true)
  const selectedOutline = reviewed.run.artifacts.find((artifact: any) => artifact.summary === '作者修订旧大纲')
  const selectedChapter = reviewed.run.artifacts.find((artifact: any) => artifact.summary === '作者修订旧章节')
  expect(selectedChapter.source.upstream).toEqual([{ artifactId: selectedOutline.id, fingerprint: selectedOutline.fingerprint }])
  expect(await readFiles()).toEqual(before)
  const milestone = page.getByTestId('creative-milestone')
  await milestone.getByRole('checkbox', { name: '作者修订旧大纲', exact: true }).check()
  await milestone.getByRole('checkbox', { name: '作者修订旧章节', exact: true }).check()
  await milestone.getByLabel('采用或撤销的原因').fill('将作者原文大纲与章节一起采用，保持交接依据')
  await milestone.getByRole('button', { name: '审阅采用', exact: true }).click()
  await expect(milestone.getByText('候选快照编译通过，请核对下面的文件变化。')).toBeVisible()
  await milestone.getByRole('button', { name: '确认写入项目', exact: true }).click()
  await expect(milestone.getByText(/最近一次采用已确认/)).toBeVisible()
  const adopted = await readFiles()
  expect(adopted['adv/outline.md']).toBe(outline)
  expect(adopted['adv/chapters/station.adv.md']).toBe(prepared)
  expect(adopted['adv/settings/game.json']).toBe(before['adv/settings/game.json'])
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await milestone.evaluate(element => element.scrollIntoView({ block: 'start' }))
    await page.screenshot({ path: info.outputPath(`legacy-source-adopted-${width}.png`), animations: 'disabled' })
  }
  await page.reload()
  await expect(milestone.getByText(/最近一次采用已确认/)).toBeVisible()
  expect(await readFiles()).toEqual(adopted)
  expect((await page.evaluate(() => (window as any).creativeAuthorFixture.calls()) as string[]).filter(call => call.startsWith('POST'))).toEqual([])
  await milestone.getByLabel('采用或撤销的原因').fill('条件恢复采用前的两个源文件，保留候选历史')
  await milestone.getByRole('button', { name: '审阅最近一次撤销', exact: true }).click()
  await milestone.getByRole('button', { name: '确认撤销本次采用', exact: true }).click()
  await expect(milestone.getByText(/最近一次撤销已确认/)).toBeVisible()
  expect(await readFiles()).toEqual(before)
  await writeFile(info.outputPath('legacy-source-evidence.json'), JSON.stringify({ scope: 'Actual fixed-source author editor, stable retry identity, compiler/core paths, transaction and IndexedDB reload/undo. Explicit legacy generator, transport and auth fixture; no model, billing or whole-work quality claim.', requests, before, originalChapter, prepared, reviewed, adopted, finalRun: await page.evaluate(() => (window as any).creativeAuthorFixture.run()) }, null, 2))
})

test('keeps legacy source candidates read-only when an older service omits raw text editing support', async ({ page }) => {
  await page.goto('/tests/fixtures/creative-team/authoring.html?case=source-text&legacyService=old')
  await expect(page).toHaveTitle('Creative candidate UI fixture')
  await expect(page.getByRole('heading', { name: '候选编辑 UI fixture', exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeAuthorFixture))).toBe(true)
  const before = await page.evaluate(() => (window as any).creativeAuthorFixture.files())
  await expect(page.locator('[data-edit-candidate]')).toHaveCount(0)
  await page.locator('.team-artifact').filter({ hasText: '本地 fixture 旧大纲' }).getByRole('button', { name: '选定候选并继续', exact: true }).click()
  await expect(page.locator('.team-artifact').filter({ hasText: '本地 fixture 旧章节' })).toBeVisible()
  await expect(page.locator('[data-edit-candidate]')).toHaveCount(0)
  await expect(page.getByTestId('creative-source-candidate-editor')).toHaveCount(0)
  expect(await page.evaluate(() => (window as any).creativeAuthorFixture.editRequests())).toEqual([])
  expect(await page.evaluate(() => (window as any).creativeAuthorFixture.files())).toEqual(before)
})

test('reconciles a save from the actual file editor on returning to the team and reopens unchanged sources without POST', async ({ page }, info) => {
  await page.goto('/tests/fixtures/creative-team/authoring.html?case=source-sync')
  await expect(page).toHaveTitle('Creative candidate UI fixture')
  await expect(page.getByRole('heading', { name: '候选编辑 UI fixture', exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeAuthorFixture))).toBe(true)
  await expect(page.getByText('正在核对已保存的项目来源，暂缓选定、采用与生成。', { exact: true })).toHaveCount(0)
  const calls = () => page.evaluate(() => (window as any).creativeAuthorFixture.calls()) as Promise<string[]>
  expect((await calls()).filter(call => call.startsWith('POST'))).toEqual([])
  await page.locator('.team-artifact').filter({ hasText: '本地 fixture 人物初稿' }).getByRole('button', { name: '选定候选并继续', exact: true }).click()
  await page.locator('.team-artifact').filter({ hasText: '本地 fixture 章节初稿' }).getByRole('button', { name: '选定候选并继续', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as any).creativeAuthorFixture.run().artifacts.find((item: any) => item.taskId === 'script')?.status)).toBe('selected')
  const before = await page.evaluate(() => (window as any).creativeAuthorFixture.files())
  const previousCalls = await calls()
  await page.getByRole('button', { name: '普通章节编辑器', exact: true }).click()
  const editor = page.locator('.editor-textarea')
  await expect(editor).toBeVisible()
  const source = before['adv/chapters/station.adv.md'].replace('你在等谁？', '普通编辑器保存的新对白。')
  await editor.fill(source)
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect.poll(() => page.evaluate(async () => (await (window as any).creativeAuthorFixture.files())['adv/chapters/station.adv.md'])).toBe(source)
  await page.getByRole('button', { name: '返回制作组 fixture', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as any).creativeAuthorFixture.run().artifacts.every((item: any) => item.status === 'stale'))).toBe(true)
  await expect(page.getByText('正在核对已保存的项目来源，暂缓选定、采用与生成。', { exact: true })).toHaveCount(0)
  const delta = (await calls()).slice(previousCalls.length)
  expect(delta.filter(call => call.startsWith('POST'))).toEqual(['POST /ai/v2/apps/advjs-studio-web/creative-team/runs/ui_fixture_run/facts'])
  await expect(page.getByRole('button', { name: '选定候选并继续', exact: true })).toHaveCount(0)
  const after = await page.evaluate(() => (window as any).creativeAuthorFixture.files())
  expect(after).toEqual({ ...before, 'adv/chapters/station.adv.md': source })
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.locator('.team-artifact').first().evaluate(element => element.scrollIntoView({ block: 'start' }))
    await page.screenshot({ path: info.outputPath(`source-sync-stale-${width}.png`), animations: 'disabled' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.reload()
  await expect(page.getByRole('heading', { name: '候选编辑 UI fixture', exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => (window as any).creativeAuthorFixture.calls().some((call: string) => call.includes('/source-state')))).toBe(true)
  await expect(page.getByText('正在核对已保存的项目来源，暂缓选定、采用与生成。', { exact: true })).toHaveCount(0)
  expect((await calls()).filter(call => call.startsWith('POST'))).toEqual([])
  expect(await page.evaluate(() => (window as any).creativeAuthorFixture.files())).toEqual(after)
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  await writeFile(info.outputPath('source-sync-editor-evidence.json'), JSON.stringify({ scope: 'Actual EditorPage file save, filesystem capture/flush, source client, shared invalidation and IndexedDB reload. Explicit auth/model/HTTP service fixture; no model or billing claim.', before, after, delta, run: await page.evaluate(() => (window as any).creativeAuthorFixture.run()) }, null, 2))
})

test('keeps source uncertainty blocked, allows cancellation and recovers a lost facts response through a read', async ({ page }, info) => {
  await page.goto('/tests/fixtures/creative-team/authoring.html?case=source-sync')
  await expect(page.getByRole('heading', { name: '候选编辑 UI fixture', exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeAuthorFixture))).toBe(true)
  await expect(page.getByText('正在核对已保存的项目来源，暂缓选定、采用与生成。', { exact: true })).toHaveCount(0)
  const before = await page.evaluate(() => (window as any).creativeAuthorFixture.files())
  await page.evaluate(async () => {
    const fixture = (window as any).creativeAuthorFixture
    fixture.loseFactsResponse()
    await fixture.editSource('adv/world.md', '# 作者保存的新世界\n')
  })
  const warning = page.getByText('来源核对未完成。草稿与历史保留，请重试后再继续。', { exact: true })
  await expect(warning).toBeVisible()
  await expect(page.getByRole('button', { name: '选定候选并继续', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: '停止后续任务', exact: true })).toBeEnabled()
  const calls = await page.evaluate(() => (window as any).creativeAuthorFixture.calls()) as string[]
  const factsCalls = calls.filter(call => call.startsWith('POST') && call.endsWith('/facts'))
  expect(factsCalls).toHaveLength(1)
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await warning.scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath(`source-sync-failed-${width}.png`), animations: 'disabled' })
  }
  await page.getByRole('button', { name: '重新核对来源', exact: true }).click()
  await expect(warning).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => (window as any).creativeAuthorFixture.run().artifacts[0].status)).toBe('stale')
  const recovered = await page.evaluate(() => (window as any).creativeAuthorFixture.calls()) as string[]
  expect(recovered.filter(call => call.startsWith('POST'))).toEqual(factsCalls)
  expect(await page.evaluate(() => (window as any).creativeAuthorFixture.files())).toEqual({ ...before, 'adv/world.md': '# 作者保存的新世界\n' })
  await writeFile(info.outputPath('source-sync-recovery-evidence.json'), JSON.stringify({ scope: 'Actual file observer and scoped source reconciliation, explicit transport failure after facts persistence. Retry reads existing state without another POST; cancellation remains available.', calls, recovered }, null, 2))
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
  await expect(page.locator('.game-player')).toContainText('这张图片已经采用到项目。', { timeout: 15000 })
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
  await expect(playtest.getByText('已同步作者宿主报告，服务端未重放', { exact: true })).toBeVisible()
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

test('prepares actual dialogue identities in an author revision, reaches both endings and persists the reviewed source', async ({ page }, info) => {
  await page.goto('/tests/fixtures/creative-team/authoring.html')
  await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeAuthorFixture))).toBe(true)
  const readFiles = () => page.evaluate(async () => (window as any).creativeAuthorFixture.files())
  const before = await readFiles()
  await page.locator('.team-artifact').filter({ hasText: '本地 fixture 人物初稿' }).getByRole('button', { name: '选定候选并继续' }).click()
  await page.locator('.team-artifact').filter({ hasText: '本地 fixture 章节初稿' }).getByRole('button', { name: '编辑候选', exact: true }).click()
  const form = page.getByTestId('creative-candidate-editor')
  const script = form.getByLabel('AdvScript', { exact: true })
  const original = await script.inputValue()
  const canonical = original.replace('林舟：「你在等谁？」', '@lin\n列车还没有到，\n我们再**等一会儿**。').replace('乔雨：「一个还没回来的人。」', '@qiao\n一个还没回来的人。').replace('- [留下线索]', '> 雨声渐渐停了。\n\n- [留下线索]')
  await script.fill(canonical)
  const callsBefore = await page.evaluate(() => (window as any).creativeAuthorFixture.calls())
  await form.getByRole('button', { name: '补齐台词身份', exact: true }).click()
  await expect(form.getByRole('status')).toContainText('已补齐 3 处，保留 0 处')
  const prepared = await script.inputValue()
  const markers = prepared.match(/ \{#line_[^}]+\}/g)!
  expect(markers).toHaveLength(3)
  expect(new Set(markers).size).toBe(3)
  expect(markers.reduce((content, marker) => content.replace(marker, ''), prepared)).toBe(canonical)
  await form.getByRole('button', { name: '补齐台词身份', exact: true }).click()
  await expect(form.getByRole('status')).toContainText('已补齐 0 处，保留 3 处')
  expect(await script.inputValue()).toBe(prepared)
  expect(await page.evaluate(() => (window as any).creativeAuthorFixture.calls())).toEqual(callsBefore)
  expect(await readFiles()).toEqual(before)
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await form.getByRole('button', { name: '补齐台词身份', exact: true }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath(`chapter-identities-${width}.png`), animations: 'disabled' })
    await script.evaluate((element) => {
      element.scrollTop = 0
    })
    await script.scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath(`chapter-identity-source-${width}.png`), animations: 'disabled' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await form.getByLabel('本次修改的原因').fill('作者核对完整对白并准备后续配音交接')
  await form.getByRole('button', { name: '保存候选修订', exact: true }).click()
  const revision = page.locator('.team-artifact').filter({ hasText: '作者修订 · 尚未写入项目' }).filter({ hasText: '本地 fixture 章节初稿' })
  await expect(revision).toHaveCount(1)
  await revision.getByRole('button', { name: '选定候选并继续', exact: true }).click()
  const playtest = page.getByTestId('creative-playtest')
  await playtest.getByRole('combobox', { name: '执行快照', exact: true }).selectOption('candidate')
  await playtest.getByLabel('预期结局地址', { exact: true }).fill('stay#ending-stay')
  await playtest.getByLabel('选择序列（从 0 开始，以英文逗号分隔）', { exact: true }).fill('0')
  await playtest.getByRole('button', { name: '添加路径', exact: true }).click()
  await playtest.getByLabel('预期结局地址', { exact: true }).nth(1).fill('leave#ending-leave')
  await playtest.getByLabel('选择序列（从 0 开始，以英文逗号分隔）', { exact: true }).nth(1).fill('1')
  await playtest.getByRole('button', { name: '执行这些路径', exact: true }).click()
  await expect(page.getByTestId('creative-playtest-report').getByRole('heading', { name: /指定路径通过/ })).toHaveCount(2)
  await expect(playtest.getByText('已同步作者宿主报告，服务端未重放', { exact: true })).toBeVisible()
  const reports = await page.evaluate(() => (window as any).creativeAuthorFixture.playtests())
  const report = Object.values(reports)[0] as any
  expect(report.executions.every((execution: any) => execution.trace.some((step: any) => step.kind === 'dialog' && step.text === '列车还没有到，\n我们再等一会儿。'))).toBe(true)
  expect(await readFiles()).toEqual(before)
  const milestone = page.getByTestId('creative-milestone')
  await milestone.getByRole('checkbox', { name: '本地 fixture 人物初稿', exact: true }).check()
  await milestone.getByRole('checkbox', { name: '本地 fixture 章节初稿', exact: true }).check()
  await milestone.getByLabel('采用或撤销的原因').fill('采用已审阅、具有稳定台词身份的章节与人物')
  await milestone.getByRole('button', { name: '审阅采用', exact: true }).click()
  await expect(milestone.getByText('候选快照编译通过，请核对下面的文件变化。')).toBeVisible()
  await milestone.getByRole('button', { name: '确认写入项目', exact: true }).click()
  await expect(milestone.getByText(/最近一次采用已确认/)).toBeVisible()
  const adopted = await readFiles()
  expect(adopted['adv/chapters/station.adv.md']).toBe(`${prepared.trim()}\n`)
  await page.reload()
  await expect(milestone.getByText(/最近一次采用已确认/)).toBeVisible()
  expect(await readFiles()).toEqual(adopted)
  expect((await page.evaluate(() => (window as any).creativeAuthorFixture.calls()) as string[]).filter(call => call.startsWith('POST'))).toEqual([])
  await writeFile(info.outputPath('chapter-identity-handoff.json'), JSON.stringify({ scope: 'Explicit local identity/proposal service fixture, actual parser, author revision, compiler, both core-runtime paths, project adoption and reopen; no model or billing', original, canonical, prepared, reports, before, adopted, run: await page.evaluate(() => (window as any).creativeAuthorFixture.run()) }, null, 2))
})

test('reviews director advice from actual saved paths, reopens it without generation and closes only on an independent author decision', async ({ page }, info) => {
  await page.goto('/tests/fixtures/creative-team/authoring.html?case=director-summary')
  await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeAuthorFixture))).toBe(true)
  const readFiles = () => page.evaluate(async () => (window as any).creativeAuthorFixture.files())
  await page.locator('.team-artifact').filter({ hasText: '本地 fixture 人物初稿' }).getByRole('button', { name: '选定候选并继续', exact: true }).click()
  const chapter = page.locator('.team-artifact').filter({ hasText: '本地 fixture 章节初稿' }).first()
  await chapter.getByRole('button', { name: '编辑候选', exact: true }).click()
  const form = page.getByTestId('creative-candidate-editor')
  await form.getByRole('button', { name: '补齐台词身份', exact: true }).click()
  await expect(form.getByRole('status')).toContainText('已补齐 2 处')
  await form.getByLabel('本次修改的原因').fill('作者核对实际对白并准备稳定交接')
  await form.getByRole('button', { name: '保存候选修订', exact: true }).click()
  await page.locator('.team-artifact').filter({ hasText: '作者修订 · 尚未写入项目' }).getByRole('button', { name: '选定候选并继续', exact: true }).click()
  const milestone = page.getByTestId('creative-milestone')
  await milestone.getByRole('checkbox', { name: '本地 fixture 人物初稿', exact: true }).check()
  await milestone.getByRole('checkbox', { name: '本地 fixture 章节初稿', exact: true }).check()
  await milestone.getByLabel('采用或撤销的原因').fill('先采用已审阅源文件，再验证实际保存版本')
  await milestone.getByRole('button', { name: '审阅采用', exact: true }).click()
  await expect(milestone.getByText('候选快照编译通过，请核对下面的文件变化。')).toBeVisible()
  await milestone.getByRole('button', { name: '确认写入项目', exact: true }).click()
  await expect(milestone.getByText(/最近一次采用已确认/)).toBeVisible()
  const playtest = page.getByTestId('creative-playtest')
  await playtest.getByRole('combobox', { name: '执行快照', exact: true }).selectOption('saved')
  await playtest.getByLabel('预期结局地址', { exact: true }).fill('stay#ending-stay')
  await playtest.getByLabel('选择序列（从 0 开始，以英文逗号分隔）', { exact: true }).fill('0')
  await playtest.getByRole('button', { name: '添加路径', exact: true }).click()
  await playtest.getByLabel('预期结局地址', { exact: true }).nth(1).fill('leave#ending-leave')
  await playtest.getByLabel('选择序列（从 0 开始，以英文逗号分隔）', { exact: true }).nth(1).fill('1')
  await playtest.getByRole('button', { name: '执行这些路径', exact: true }).click()
  await expect(page.getByTestId('creative-playtest-report').getByRole('heading', { name: /指定路径通过/ })).toHaveCount(2)
  expect(await page.evaluate(() => (window as any).creativeAuthorFixture.summaryHandoffs())).toEqual([])
  const before = await readFiles()
  await page.getByRole('button', { name: '生成导演交付建议', exact: true }).click()
  const card = page.locator('.team-artifact').filter({ hasText: '本地 fixture 导演交付建议' })
  await expect(card).toHaveCount(1)
  await card.getByText('查看完整内容', { exact: true }).click()
  const summary = page.getByTestId('creative-director-summary')
  await expect(summary).toContainText('与本次快照版本一致')
  await expect(summary).toContainText('通过 2 · 失败 0')
  await expect(summary).toContainText('选定此建议不会结束制作组')
  expect(await readFiles()).toEqual(before)
  const handoffs = await page.evaluate(() => (window as any).creativeAuthorFixture.summaryHandoffs())
  expect(handoffs).toHaveLength(1)
  expect(handoffs[0].reports[0].executions.map((item: any) => item.status)).toEqual(['passed', 'passed'])
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await summary.evaluate(element => element.scrollIntoView({ block: 'start' }))
    await page.screenshot({ path: info.outputPath(`director-advice-${width}.png`), animations: 'disabled' })
    await summary.getByRole('heading', { name: '已保存的作者宿主试玩记录', exact: true }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath(`director-records-${width}.png`), animations: 'disabled' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await card.getByRole('button', { name: '选定候选并继续', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as any).creativeAuthorFixture.run().tasks.find((item: any) => item.taskId === 'delivery')?.status)).toBe('completed')
  const selected = await page.evaluate(() => (window as any).creativeAuthorFixture.run())
  expect(selected.status).toBe('awaiting_review')
  expect(selected.delivery).toBeUndefined()
  await page.reload()
  await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeAuthorFixture))).toBe(true)
  await card.getByText('查看完整内容', { exact: true }).click()
  await expect(summary).toContainText('通过 2 · 失败 0')
  expect(await readFiles()).toEqual(before)
  expect((await page.evaluate(() => (window as any).creativeAuthorFixture.calls()) as string[]).filter(call => call.startsWith('POST'))).toEqual([])
  const delivery = page.getByTestId('creative-delivery')
  for (const reason of await delivery.getByLabel('采用、保留或排除的理由', { exact: true }).all())
    await reason.fill('保留实际采用与试玩记录；导演建议仅供作者参考。')
  await delivery.getByLabel('作者交付说明与剩余事项', { exact: true }).fill('结束本次本地协议验证；真实模型创作、画面和声音品质仍未验收。')
  await delivery.getByRole('checkbox').check()
  await delivery.getByRole('button', { name: '审阅交付记录', exact: true }).click()
  await expect(delivery.getByText(/项目已编译/)).toBeVisible()
  await delivery.getByRole('button', { name: '确认记录并结束本次制作组', exact: true }).click()
  await expect(delivery.getByText(/作者已结束本次制作组/)).toBeVisible()
  const closed = await page.evaluate(() => (window as any).creativeAuthorFixture.run())
  expect(closed.status).toBe('completed')
  expect(closed.delivery.dispositions.map((item: any) => item.disposition).sort()).toEqual(['adopted', 'adopted', 'reference'])
  expect(await readFiles()).toEqual(before)
  await writeFile(info.outputPath('director-summary-handoff.json'), JSON.stringify({ scope: 'Explicit local proposals, model text and service storage fixture; actual AST identities, author revision, project adoption, both saved core paths, summary evidence and independent author closure; no paid calls or new media', before, handoffs, selected, closed }, null, 2))
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
  test.setTimeout(90000)
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
  await expect(workspace).toBeVisible({ timeout: 30000 })
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
    await writeFile(info.outputPath('partial-voice-recovery.json'), JSON.stringify({ scope: 'Explicit legacy per-file adapter injection disables atomic staging before navigation interrupts durable binary and first text write; reload uses the current atomic adapter to recover the actual private journal and original genuine speech bytes.', destination, before, interrupted, result, pending, journal }, null, 2))
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
  await writeFile(info.outputPath('cross-media-pending-recovery.json'), JSON.stringify({ scope: 'Explicit legacy per-file adapter injection interrupts image adoption after its durable first text file; reload restores the current atomic adapter, the common IndexedDB intent guard refuses a new voice write, and explicit recovery preserves image bytes.', before, partial }, null, 2))
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

async function stageUnifiedMedia(page: Page, audioPath: string, review = true) {
  const art = page.getByTestId('creative-art-import')
  await art.getByRole('combobox', { name: '美术素材需求', exact: true }).selectOption({ label: 'character/lin/default · 619 × 619' })
  await art.getByLabel('选择图片文件', { exact: true }).setInputFiles(resolve(import.meta.dirname, '../../../../demo/starter/public/img/characters/xiaoyun.webp'))
  await art.getByLabel('素材来源与署名', { exact: true }).fill('ADV.JS 既有小云 WebP，仅用于真实媒体事务验证，不代表角色美术质量。')
  await art.getByRole('button', { name: '保存图片候选', exact: true }).click()
  const image = page.getByTestId('creative-art-candidate')
  await image.getByRole('button', { name: '审阅导入', exact: true }).click()
  await image.getByRole('button', { name: '登记制作组候选（项目未变）', exact: true }).click()
  await expect(image.getByRole('heading', { name: /制作组候选已登记，项目未变/ })).toBeVisible()
  const voice = await stageRealRecoveryVoice(page, audioPath)
  await voice.getByRole('button', { name: '登记制作组候选（项目未变）', exact: true }).click()
  await expect(voice.getByRole('heading', { name: /制作组候选已登记，项目未变/ })).toBeVisible()
  const milestone = page.getByTestId('creative-milestone')
  await expect(milestone.getByRole('checkbox')).toHaveCount(2)
  if (!review)
    return milestone
  for (const checkbox of await milestone.getByRole('checkbox').all())
    await checkbox.check()
  await milestone.getByLabel('采用或撤销的原因', { exact: true }).fill('将已核验的真实图片与未选 VoiceTake 一同写入；不选用配音，不调用模型。')
  await milestone.getByRole('button', { name: '审阅采用', exact: true }).click()
  await expect(milestone.getByRole('button', { name: '确认写入项目', exact: true })).toBeVisible()
  return milestone
}

async function fillDeliveryReview(page: Page) {
  const panel = page.getByTestId('creative-delivery')
  await expect(panel.getByLabel('采用、保留或排除的理由', { exact: true }).first()).toBeVisible()
  for (const input of await panel.getByLabel('采用、保留或排除的理由', { exact: true }).all())
    await input.fill('核对本次范围：已有素材保留采用；方案仅供参考，未选配音仍待处理。')
  await panel.getByLabel('作者交付说明与剩余事项', { exact: true }).fill('作者结束本次事务验证。配音尚未选用；画面、表演与完整剧情仍须另行验收。')
  await panel.getByRole('checkbox').check()
  return panel
}

test('keeps real image, selected speech, both endings, director evidence and author closure on the same saved story', async ({ page }, info) => {
  test.setTimeout(120000)
  const audioPath = process.env.STUDIO_CREATIVE_VOICE_WAV
  test.skip(!audioPath, 'Requires the existing real external spoken WAV; no substitute media is generated')
  interface Bridge {
    files: () => Promise<Record<string, string>>
    media: () => Promise<Array<{ id: string, sha256: string, expectedSha256: string, bytes: number, expectedBytes: number }>>
    run: () => CreativeTeamRun
    calls: () => Array<{ method: string, path: string }>
    writes: () => string[]
    editSource: (path: string, content: string) => Promise<void>
  }
  const read = () => page.evaluate(async () => {
    const fixture = (window as unknown as { creativeMediaFixture: Bridge }).creativeMediaFixture
    return { files: await fixture.files(), media: await fixture.media(), run: fixture.run(), calls: fixture.calls(), writes: fixture.writes() }
  })
  await page.addInitScript(() => {
    const playback: Array<{ duration: number, state: string, ended: boolean, trusted: boolean, elapsed: number }> = []
    Object.assign(window, { storyJourneyPlayback: playback })
    const start = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (...args: Parameters<typeof start>) {
      if (this.buffer && this.buffer.duration > 1) {
        const at = this.context.currentTime
        const row = { duration: this.buffer.duration, state: this.context.state, ended: false, trusted: false, elapsed: 0 }
        playback.push(row)
        this.addEventListener('ended', event => Object.assign(row, { ended: true, trusted: event.isTrusted, elapsed: this.context.currentTime - at }), { once: true })
      }
      return start.apply(this, args)
    }
  })
  const url = '/tests/fixtures/creative-team/media-milestones.html?case=delivery-story'
  await page.goto(url)
  await expect(page).toHaveTitle('Creative media milestone UI fixture')
  await expect(page.getByRole('note')).toContainText('无模型或计费')
  await expect.poll(() => page.evaluate(() => Boolean((window as unknown as { creativeMediaFixture?: Bridge }).creativeMediaFixture))).toBe(true)
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  const initial = await read()
  const milestone = await stageUnifiedMedia(page, audioPath!)
  expect((await read()).files).toEqual(initial.files)
  await milestone.getByRole('button', { name: '确认写入项目', exact: true }).click()
  await expect(milestone.getByText(/最近一次采用已确认/)).toBeVisible()
  const lineId = 'line_01900400-0000-7000-8000-000000000001'
  await page.goto(`/tabs/workspace/audio?section=review&speaker=lin&line=${lineId}`)
  const audio = page.getByTestId('audio-workspace')
  await audio.locator('.voice-review__take').getByRole('button', { name: '试听', exact: true }).click()
  await expect.poll(() => audio.locator('audio').evaluate((element: HTMLAudioElement) => element.duration)).toBeGreaterThan(1)
  await audio.getByRole('button', { name: '播放试听', exact: true }).click()
  await expect.poll(() => audio.locator('audio').evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(0.4)
  await page.goto(url)
  await expect.poll(() => page.evaluate(() => Boolean((window as unknown as { creativeMediaFixture?: Bridge }).creativeMediaFixture))).toBe(true)
  const candidate = page.getByTestId('creative-voice-candidate')
  await candidate.getByRole('checkbox', { name: '我已试听，并确认将此候选设为当前选用（如有旧选择，将替换它）', exact: true }).check()
  await candidate.getByRole('button', { name: '审阅此配音的选用绑定', exact: true }).click()
  const selection = candidate.filter({ hasText: '本候选只改变当前台词的选用绑定' })
  await selection.getByRole('button', { name: '登记制作组候选（项目未变）', exact: true }).click()
  await milestone.getByRole('checkbox').check()
  await milestone.getByLabel('采用或撤销的原因', { exact: true }).fill('同一项目中已实际试听，明确选用该录音。')
  await milestone.getByRole('button', { name: '审阅采用', exact: true }).click()
  await milestone.getByRole('button', { name: '确认写入项目', exact: true }).click()
  await expect(selection.getByRole('heading', { name: /选用绑定已确认/ })).toBeVisible()
  const oldPlan = page.locator('.team-artifact').filter({ hasText: '双结局实际路径待执行' })
  await expect(oldPlan).toContainText('已过期')
  const checkTask = page.getByRole('listitem').filter({ hasText: '双结局路径与报告' })
  await checkTask.getByLabel('说明要调整的地方', { exact: true }).fill('媒体和选用绑定已采用，按当前保存版本重新核对路径。')
  await checkTask.getByRole('button', { name: '请求返工', exact: true }).click()
  await page.locator('.team-artifact').filter({ hasText: '当前保存版本的双结局路径' }).getByRole('button', { name: '选定候选并继续', exact: true }).click()
  const playtest = page.getByTestId('creative-playtest')
  await playtest.getByRole('button', { name: '载入试玩员提出的路径', exact: true }).click()
  await playtest.getByRole('button', { name: '执行这些路径', exact: true }).click()
  await expect(page.getByTestId('creative-playtest-report').getByRole('heading', { name: /指定路径通过/ })).toHaveCount(2)
  await expect(playtest.getByText('已同步作者宿主报告，服务端未重放', { exact: true })).toBeVisible()
  const saved = await read()
  expect(saved.run.playtests).toHaveLength(1)
  expect(saved.run.playtests![0]).toMatchObject({ passed: 2, failed: 0, blocked: 0, scope: 'saved' })
  expect(saved.media).toHaveLength(2)
  expect(saved.media.every(item => item.sha256 === item.expectedSha256 && item.bytes === item.expectedBytes)).toBe(true)
  const ledger = JSON.parse(saved.files['adv/audio/voice-ledger.json'])
  expect(ledger.lines[lineId].locales['zh-CN'].selectedTake).toBeTruthy()
  await page.goto('/tabs/play')
  await expect(page.locator('.game-player')).toContainText('列车还没有到，我们再等一会儿。')
  const image = page.locator('.dialog-avatar-wrap img')
  await expect(image).toBeVisible()
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => ({ loaded: element.complete, width: element.naturalWidth, local: element.src.startsWith('blob:') }))).toEqual({ loaded: true, width: 619, local: true })
  await page.locator('.game-player .adv-ui').click({ position: { x: 200, y: 300 } })
  await page.getByTestId('play-toolbar-actions').getByRole('button', { name: '设置', exact: true }).click()
  await page.locator('.adv-popover-menu:visible').getByText('重新开始', { exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { storyJourneyPlayback: Array<{ ended: boolean, trusted: boolean, state: string, elapsed: number, duration: number }> }).storyJourneyPlayback.some(item => item.ended && item.trusted && item.state === 'running' && item.elapsed >= item.duration - 0.15)), { timeout: 12000 }).toBe(true)
  const playback = await page.evaluate(() => (window as unknown as { storyJourneyPlayback: unknown }).storyJourneyPlayback)
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(image).toBeInViewport()
    await page.screenshot({ path: info.outputPath(`same-story-player-${width}.png`), animations: 'allow' })
  }
  await page.goto(url)
  await expect.poll(() => page.evaluate(() => Boolean((window as unknown as { creativeMediaFixture?: Bridge }).creativeMediaFixture))).toBe(true)
  expect((await read()).calls.every(call => call.method === 'GET')).toBe(true)
  expect((await read()).writes).toEqual([])
  await page.getByRole('button', { name: '生成导演交付建议', exact: true }).click()
  const summaryCard = page.locator('.team-artifact').filter({ hasText: '同项目媒体与双结局的替身导演建议' })
  await summaryCard.getByText('查看完整内容', { exact: true }).click()
  const summary = page.getByTestId('creative-director-summary')
  await expect(summary).toContainText('通过 2 · 失败 0')
  await expect(summary).toContainText('与本次快照版本一致')
  await summaryCard.getByRole('button', { name: '选定候选并继续', exact: true }).click()
  const panel = await fillDeliveryReview(page)
  await panel.getByLabel('作者交付说明与剩余事项', { exact: true }).fill('同一保存版本的图片、选用对白与两个结局已验证；其余媒体和真实模型创作品质未验收。')
  await panel.getByRole('button', { name: '审阅交付记录', exact: true }).click()
  await expect(panel.getByText(/项目已编译/)).toBeVisible()
  await panel.getByRole('button', { name: '确认记录并结束本次制作组', exact: true }).click()
  await expect(panel.getByText(/作者已结束本次制作组/)).toBeVisible()
  const closed = await read()
  expect(closed.run.status).toBe('completed')
  expect(closed.run.delivery!.playtestIds).toEqual([saved.run.playtests![0].id])
  expect(closed.files).toEqual(saved.files)
  expect(closed.media).toEqual(saved.media)
  expect(closed.run.chargedMicroPoints).toBe(0)
  await page.reload()
  await expect(panel.getByText(/作者已结束本次制作组/)).toBeVisible()
  const reopened = await read()
  expect(reopened.files).toEqual(closed.files)
  expect(reopened.media).toEqual(closed.media)
  expect(reopened.run.delivery).toEqual(closed.run.delivery)
  expect(reopened.calls.every(call => call.method === 'GET')).toBe(true)
  expect(reopened.writes).toEqual([])
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await panel.scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath(`same-story-closed-${width}.png`), animations: 'disabled' })
  }
  await writeFile(info.outputPath('same-story-journey.json'), JSON.stringify({ scope: 'One actual saved project, real existing WebP and external WAV, HTTP client/shared authoring contracts, IndexedDB and product transactions, both core paths, product image/audio playback, grounded substitute director summary and independent author closure. Initial story and specialist plans, identity and local service storage are explicit fixtures; no real models, billing or quality certification.', initial, saved, playback, closed, reopened }, null, 2))
})

test('closes adopted real media through an independent author decision and reopens a lost receipt without rewriting files', async ({ page }, info) => {
  const audioPath = process.env.STUDIO_CREATIVE_VOICE_WAV
  test.skip(!audioPath, 'Requires genuine external speech; no placeholder is substituted')
  await page.goto('/tests/fixtures/creative-team/media-milestones.html?case=delivery-receipt')
  await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeMediaFixture))).toBe(true)
  const milestone = await stageUnifiedMedia(page, audioPath!)
  await milestone.getByRole('button', { name: '确认写入项目', exact: true }).click()
  await expect(milestone.getByText(/最近一次采用已确认/)).toBeVisible()
  const before = await page.evaluate(async () => ({ run: (window as any).creativeMediaFixture.run(), files: await (window as any).creativeMediaFixture.files(), media: await (window as any).creativeMediaFixture.media(), writes: (window as any).creativeMediaFixture.writes() }))
  expect(before.run.status).toBe('awaiting_review')
  const panel = await fillDeliveryReview(page)
  await panel.getByRole('button', { name: '审阅交付记录', exact: true }).click()
  await expect(panel.getByText(/项目已编译/)).toBeVisible()
  await expect(panel.getByText('尚无已采用且选定的实际素材：1 项请求', { exact: true })).toBeVisible()
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await panel.evaluate(element => element.scrollIntoView({ block: 'start' }))
    await page.screenshot({ path: info.outputPath(`delivery-review-${width}.png`), animations: 'disabled' })
    await panel.getByRole('button', { name: '确认记录并结束本次制作组', exact: true }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath(`delivery-confirm-${width}.png`), animations: 'disabled' })
  }
  await page.evaluate(() => (window as any).creativeMediaFixture.lose('delivery'))
  await panel.getByRole('button', { name: '确认记录并结束本次制作组', exact: true }).click()
  await expect(panel.getByRole('button', { name: '读取并重试收尾', exact: true })).toBeVisible()
  await page.reload()
  await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeMediaFixture))).toBe(true)
  await expect(panel.getByText(/作者已结束本次制作组。这是决定当时的历史记录/)).toBeVisible()
  const after = await page.evaluate(async () => ({ run: (window as any).creativeMediaFixture.run(), files: await (window as any).creativeMediaFixture.files(), media: await (window as any).creativeMediaFixture.media(), writes: (window as any).creativeMediaFixture.writes(), calls: (window as any).creativeMediaFixture.calls() }))
  expect(after.run.status).toBe('completed')
  expect(after.run.delivery.dispositions.map((item: any) => item.disposition).sort()).toEqual(['adopted', 'adopted', 'reference', 'reference'])
  expect(after.run.delivery.pendingMedia).toHaveLength(1)
  expect(after.run.delivery.playtestIds).toEqual([])
  expect(after.files).toEqual(before.files)
  expect(after.media).toEqual(before.media)
  expect(after.writes).toEqual([])
  expect(after.calls.every((call: any) => call.method === 'GET')).toBe(true)
  await expect(page.getByTestId('creative-milestone')).toHaveCount(0)
  await expect(page.getByTestId('creative-art-import')).toHaveCount(0)
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await panel.evaluate(element => element.scrollIntoView({ block: 'start' }))
    await page.screenshot({ path: info.outputPath(`delivery-receipt-${width}.png`), animations: 'disabled' })
    await panel.locator('p').last().scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath(`delivery-remaining-${width}.png`), animations: 'disabled' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await writeFile(info.outputPath('delivery-record.json'), JSON.stringify({ scope: 'explicit local service, real compiler/HTTP client/IndexedDB/media and project transaction; no model or billing', before, after }, null, 2))
})

test('blocks author closure for another run’s pending local write and a source changed after review', async ({ page }, info) => {
  await page.goto('/tests/fixtures/creative-team/media-milestones.html?case=delivery-stale')
  await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeMediaFixture))).toBe(true)
  const panel = await fillDeliveryReview(page)
  await page.evaluate(() => (window as any).creativeMediaFixture.pendingDeliveryWrite(true))
  await panel.getByRole('button', { name: '审阅交付记录', exact: true }).click()
  await expect(panel.getByRole('alert')).toBeVisible()
  await expect(panel.getByRole('button', { name: '确认记录并结束本次制作组', exact: true })).toHaveCount(0)
  await page.evaluate(() => (window as any).creativeMediaFixture.pendingDeliveryWrite(false))
  await panel.getByRole('button', { name: '审阅交付记录', exact: true }).click()
  await expect(panel.getByText(/项目已编译/)).toBeVisible()
  await page.evaluate(() => (window as any).creativeMediaFixture.editSource('adv/chapters/intro.adv.md', '# 作者改稿 {#start}\n\n交付审阅后发生的修改。'))
  await panel.getByRole('button', { name: '确认记录并结束本次制作组', exact: true }).click()
  await expect(panel.getByRole('alert')).toBeVisible()
  const result = await page.evaluate(() => ({ run: (window as any).creativeMediaFixture.run(), calls: (window as any).creativeMediaFixture.calls() }))
  expect(result.run.status).toBe('awaiting_review')
  expect(result.calls.filter((call: any) => call.path.includes('/delivery'))).toEqual([])
  await writeFile(info.outputPath('delivery-negative.json'), JSON.stringify({ scope: 'actual private IndexedDB across two run IDs; actual source edit after successful review', result }, null, 2))
})

test('preserves independent media across unrelated edits and expires only the changed speech source', async ({ page }, info) => {
  test.setTimeout(90000)
  const audioPath = process.env.STUDIO_CREATIVE_VOICE_WAV
  test.skip(!audioPath, 'Requires the existing real externally produced spoken WAV')
  interface Bridge {
    run: () => CreativeTeamRun
    files: () => Promise<Record<string, string>>
    media: () => Promise<Array<{ id: string, sha256: string, bytes: number, expectedSha256: string, expectedBytes: number }>>
    calls: () => Array<{ method: string, path: string }>
    editSource: (path: string, content: string) => Promise<void>
  }
  const read = () => page.evaluate(async () => {
    const fixture = (window as unknown as { creativeMediaFixture: Bridge }).creativeMediaFixture
    return { run: fixture.run(), files: await fixture.files(), media: await fixture.media(), calls: fixture.calls() }
  })
  await page.goto('/tests/fixtures/creative-team/media-milestones.html?case=media-source-dependencies')
  await expect(page).toHaveTitle('Creative media milestone UI fixture')
  await expect(page.getByRole('heading', { name: '真实媒体统一采用验证', exact: true })).toBeVisible()
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  const milestone = await stageUnifiedMedia(page, audioPath!, false)
  const registered = await read()
  const candidates = registered.run.artifacts.filter(item => item.media)
  expect(candidates).toHaveLength(2)
  const unrelated = 'adv/chapters/unrelated.adv.md'
  const edited = `${registered.files[unrelated]}\nSaved independent author edit.\n`
  await page.evaluate(({ path, content }) => (window as unknown as { creativeMediaFixture: Bridge }).creativeMediaFixture.editSource(path, content), { path: unrelated, content: edited })
  await page.getByRole('button', { name: '重新读取状态', exact: true }).click()
  await expect.poll(async () => (await read()).calls.some(item => item.method === 'POST' && item.path.endsWith('/facts'))).toBe(true)
  const refreshed = await read()
  expect(refreshed.run.artifacts.filter(item => item.media).map(item => item.status)).toEqual(['selected', 'selected'])
  expect(refreshed.run.artifacts.filter(item => item.media).map(item => item.fingerprint)).toEqual(candidates.map(item => item.fingerprint))
  expect(refreshed.files[unrelated]).toBe(edited)
  for (const checkbox of await milestone.getByRole('checkbox').all())
    await checkbox.check()
  await milestone.getByLabel('采用或撤销的原因', { exact: true }).fill('保留独立章节改稿，采用两份已核验媒体；不调用模型或重导入。')
  await milestone.getByRole('button', { name: '审阅采用', exact: true }).click()
  await milestone.getByRole('button', { name: '确认写入项目', exact: true }).click()
  await expect(milestone.getByText(/最近一次采用已确认/)).toBeVisible()
  const adopted = await read()
  expect(adopted.files[unrelated]).toBe(edited)
  expect(adopted.media).toHaveLength(2)
  for (const asset of adopted.media) {
    expect(asset.sha256).toBe(asset.expectedSha256)
    expect(asset.bytes).toBe(asset.expectedBytes)
  }
  await page.reload()
  await expect(milestone.getByText(/最近一次采用已确认/)).toBeVisible()
  const reopened = await read()
  expect(reopened.files).toEqual(adopted.files)
  expect(reopened.media).toEqual(adopted.media)
  expect(reopened.calls.filter(item => item.method === 'POST')).toEqual([])
  const voice = candidates.find(item => item.media!.target.kind === 'voice')!
  const image = candidates.find(item => item.media!.target.kind === 'image')!
  const voiceCard = page.locator(`[data-creative-artifact="${voice.id}"]`)
  const imageCard = page.locator(`[data-creative-artifact="${image.id}"]`)
  await expect(imageCard.getByText('已采用', { exact: true })).toBeVisible()
  await expect(voiceCard.getByText('已采用', { exact: true })).toBeVisible()
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await voiceCard.scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath(`independent-media-adopted-${width}.png`), animations: 'disabled' })
  }
  const chapter = 'adv/chapters/intro.adv.md'
  await page.evaluate(({ path, content }) => (window as unknown as { creativeMediaFixture: Bridge }).creativeMediaFixture.editSource(path, content), { path: chapter, content: reopened.files[chapter]!.replace('列车还没有到，我们再等一会儿。', '列车已经到了，现在出发。') })
  await page.getByRole('button', { name: '重新读取状态', exact: true }).click()
  await expect(voiceCard.getByText('已过期', { exact: true })).toBeVisible()
  await expect(imageCard.getByText('已采用', { exact: true })).toBeVisible()
  const changed = await read()
  expect(changed.media).toEqual(adopted.media)
  expect(changed.run.chargedMicroPoints).toBe(0)
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await voiceCard.scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath(`related-voice-stale-image-retained-${width}.png`), animations: 'disabled' })
  }
  await writeFile(info.outputPath('media-source-dependencies.json'), JSON.stringify({ scope: 'Real WebP/WAV, HTTP source refresh, shared candidate registration/adoption and actual IndexedDB reopen; identities, proposals and service storage remain explicit fixtures, no model or production billing', registered, refreshed, adopted, reopened, changed }, null, 2))
})

test('adopts real image and speech in one shared milestone, recovers a lost confirmation and conditionally undoes both', async ({ page }, info) => {
  test.setTimeout(90000)
  const audioPath = process.env.STUDIO_CREATIVE_VOICE_WAV
  test.skip(!audioPath, 'Requires a real externally produced spoken WAV; no substitute tone is used')
  await page.goto('/tests/fixtures/creative-team/media-milestones.html?case=batch-receipt')
  await expect(page).toHaveTitle('Creative media milestone UI fixture')
  await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeMediaFixture))).toBe(true)
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  const before = await page.evaluate(() => (window as any).creativeMediaFixture.files())
  const milestone = await stageUnifiedMedia(page, audioPath!)
  expect(await page.evaluate(() => (window as any).creativeMediaFixture.files())).toEqual(before)
  expect(await page.evaluate(() => (window as any).creativeMediaFixture.writes())).toEqual([])
  const reviewed = await page.evaluate(() => (window as any).creativeMediaFixture.candidates())
  expect(reviewed.image[0].retainedBytes).toBe(39460)
  expect(reviewed.voice[0].retainedBytes).toBeGreaterThan(100000)
  const mediaArtifacts = await page.evaluate(() => (window as any).creativeMediaFixture.run().artifacts.filter((item: any) => item.kind === 'media-adoption').map((item: any) => ({ id: item.id, kind: item.media.target.kind, sha256: item.media.sha256 })))
  for (const artifact of mediaArtifacts) {
    const card = page.locator(`[data-creative-artifact="${artifact.id}"]`)
    await card.getByText('查看完整内容', { exact: true }).click()
    await expect(card.getByText('核验来源：作者宿主', { exact: true })).toBeVisible()
    await expect(card.getByText(artifact.sha256, { exact: true })).toBeVisible()
    if (artifact.kind === 'voice')
      await expect(card.getByText('登记 VoiceTake，尚未选用', { exact: true })).toBeVisible()
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 })
      await card.scrollIntoViewIfNeeded()
      await page.screenshot({ path: info.outputPath(`shared-media-${artifact.kind}-details-${width}.png`), animations: 'disabled' })
    }
  }
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await milestone.scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath(`shared-media-review-${width}.png`), animations: 'disabled' })
  }
  await page.evaluate(() => (window as any).creativeMediaFixture.lose('confirm'))
  await milestone.getByRole('button', { name: '确认写入项目', exact: true }).click()
  await expect(milestone.getByRole('button', { name: '同步采用回执', exact: true })).toBeVisible()
  const after = await page.evaluate(() => (window as any).creativeMediaFixture.files())
  const ledger = JSON.parse(after['adv/audio/voice-ledger.json'])
  expect(ledger.lines['line_01900400-0000-7000-8000-000000000001'].locales['zh-CN'].selectedTake).toBeNull()
  await page.reload()
  await expect(milestone.getByRole('button', { name: '同步采用回执', exact: true })).toBeVisible()
  expect(await page.evaluate(() => (window as any).creativeMediaFixture.writes())).toEqual([])
  expect((await page.evaluate(() => (window as any).creativeMediaFixture.calls()) as any[]).filter(item => item.method === 'POST')).toEqual([])
  await milestone.getByRole('button', { name: '同步采用回执', exact: true }).click()
  await expect(milestone.getByText(/最近一次采用已确认/)).toBeVisible()
  const adopted = await page.evaluate(async () => ({ files: await (window as any).creativeMediaFixture.files(), media: await (window as any).creativeMediaFixture.media(), candidates: await (window as any).creativeMediaFixture.candidates(), journal: await (window as any).creativeMediaFixture.journal(), run: (window as any).creativeMediaFixture.run(), writes: (window as any).creativeMediaFixture.writes() }))
  expect(adopted.files).toEqual(after)
  expect(adopted.media).toHaveLength(2)
  for (const item of adopted.media) {
    expect(item.sha256).toBe(item.expectedSha256)
    expect(item.bytes).toBe(item.expectedBytes)
  }
  expect(adopted.candidates.image[0].retainedBytes).toBe(0)
  expect(adopted.candidates.voice[0].retainedBytes).toBe(0)
  expect(adopted.candidates.image[0].state).toBe('adopted')
  expect(adopted.candidates.voice[0].state).toBe('registered')
  expect(adopted.journal.state).toBe('confirmed')
  expect(adopted.writes).toEqual([])
  expect(adopted.run.artifacts.filter((item: any) => item.kind.endsWith('direction')).map((item: any) => item.status)).toEqual(['selected', 'selected'])
  expect(adopted.run.status).not.toBe('completed')
  await milestone.getByLabel('采用或撤销的原因', { exact: true }).fill('条件撤销这次图片与配音登记，保留两个原始媒体文件。')
  await milestone.getByRole('button', { name: '审阅最近一次撤销', exact: true }).click()
  await milestone.getByRole('button', { name: '确认撤销本次采用', exact: true }).click()
  await expect(milestone.getByText(/最近一次撤销已确认/)).toBeVisible()
  expect(await page.evaluate(() => (window as any).creativeMediaFixture.files())).toEqual(before)
  const undone = await page.evaluate(async () => ({ candidates: await (window as any).creativeMediaFixture.candidates(), journal: await (window as any).creativeMediaFixture.journal(), run: (window as any).creativeMediaFixture.run() }))
  expect(undone.candidates.image[0].state).toBe('undone')
  expect(undone.candidates.voice[0].state).toBe('restored')
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await milestone.scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath(`shared-media-undo-${width}.png`), animations: 'disabled' })
  }
  await writeFile(info.outputPath('shared-media-evidence.json'), JSON.stringify({ before, reviewed, adopted, undone }, null, 2))
})

for (const destination of ['resume', 'restore'] as const) {
  test(`recovers a genuinely interrupted shared image/voice milestone through explicit ${destination}`, async ({ page }, info) => {
    test.setTimeout(60000)
    const audioPath = process.env.STUDIO_CREATIVE_VOICE_WAV
    test.skip(!audioPath, 'Requires a real externally produced spoken WAV; no substitute tone is used')
    await page.goto(`/tests/fixtures/creative-team/media-milestones.html?case=partial-${destination}-${info.repeatEachIndex}`)
    await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeMediaFixture))).toBe(true)
    const before = await page.evaluate(() => (window as any).creativeMediaFixture.files())
    const milestone = await stageUnifiedMedia(page, audioPath!)
    await page.evaluate(() => (window as any).creativeMediaFixture.crashAfterText(1))
    await milestone.getByRole('button', { name: '确认写入项目', exact: true }).click()
    await expect.poll(() => page.evaluate(() => (window as any).creativeMediaFixture.crashed())).toBe(true)
    const partial = await page.evaluate(async () => ({ files: await (window as any).creativeMediaFixture.files(), candidates: await (window as any).creativeMediaFixture.candidates(), journal: await (window as any).creativeMediaFixture.journal() }))
    expect(partial.files).not.toEqual(before)
    expect(partial.journal.state).toBe('prepared')
    await page.reload()
    await expect(milestone.getByText(/项目仅写入了一部分/)).toBeVisible()
    expect(await page.evaluate(() => (window as any).creativeMediaFixture.files())).toEqual(partial.files)
    expect(await page.evaluate(() => (window as any).creativeMediaFixture.writes())).toEqual([])
    expect((await page.evaluate(() => (window as any).creativeMediaFixture.calls()) as any[]).filter(item => item.method === 'POST')).toEqual([])
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 })
      await milestone.getByText(/项目仅写入了一部分/).scrollIntoViewIfNeeded()
      await page.screenshot({ path: info.outputPath(`shared-partial-pending-${destination}-${width}.png`), animations: 'disabled' })
    }
    await milestone.getByRole('button', { name: destination === 'resume' ? '恢复这次写入' : '恢复写前项目并放弃此意图', exact: true }).click()
    await expect.poll(() => page.evaluate(async () => (await (window as any).creativeMediaFixture.journal()).state)).toBe(destination === 'resume' ? 'confirmed' : 'abandoned')
    const recovered = await page.evaluate(async () => ({ files: await (window as any).creativeMediaFixture.files(), candidates: await (window as any).creativeMediaFixture.candidates(), journal: await (window as any).creativeMediaFixture.journal(), run: (window as any).creativeMediaFixture.run() }))
    expect(recovered.journal.state).toBe(destination === 'resume' ? 'confirmed' : 'abandoned')
    if (destination === 'restore') {
      expect(recovered.files).toEqual(before)
      expect(recovered.candidates.image[0].retainedBytes).toBe(39460)
      expect(recovered.candidates.voice[0].retainedBytes).toBeGreaterThan(100000)
    }
    else {
      const media = await page.evaluate(() => (window as any).creativeMediaFixture.media())
      expect(media).toHaveLength(2)
      expect(media.every((item: any) => item.sha256 === item.expectedSha256 && item.bytes === item.expectedBytes)).toBe(true)
    }
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 })
      await milestone.scrollIntoViewIfNeeded()
      await page.screenshot({ path: info.outputPath(`shared-partial-${destination}-${width}.png`), animations: 'disabled' })
    }
    await writeFile(info.outputPath('shared-partial-evidence.json'), JSON.stringify({ destination, before, partial, recovered }, null, 2))
  })
}

test('retries an image candidate registration with the original durable request after its HTTP response is lost', async ({ page }, info) => {
  await page.goto('/tests/fixtures/creative-team/media-milestones.html?case=lost-registration')
  await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeMediaFixture))).toBe(true)
  const before = await page.evaluate(() => (window as any).creativeMediaFixture.files())
  const art = page.getByTestId('creative-art-import')
  await art.getByRole('combobox', { name: '美术素材需求', exact: true }).selectOption({ label: 'character/lin/default · 619 × 619' })
  await art.getByLabel('选择图片文件', { exact: true }).setInputFiles(resolve(import.meta.dirname, '../../../../demo/starter/public/img/characters/xiaoyun.webp'))
  await art.getByLabel('素材来源与署名', { exact: true }).fill('既有图片；本次仅验证登记 HTTP 响应丢失，不写正式项目。')
  await art.getByRole('button', { name: '保存图片候选', exact: true }).click()
  const candidate = page.getByTestId('creative-art-candidate')
  await candidate.getByRole('button', { name: '审阅导入', exact: true }).click()
  await page.evaluate(() => (window as any).creativeMediaFixture.lose('register'))
  await candidate.getByRole('button', { name: '登记制作组候选（项目未变）', exact: true }).click()
  await expect(candidate.getByRole('button', { name: '核对并重试原登记', exact: true })).toBeVisible()
  const pending = await page.evaluate(() => (window as any).creativeMediaFixture.candidates())
  await page.reload()
  await expect(candidate.getByRole('button', { name: '核对并重试原登记', exact: true })).toBeVisible()
  expect((await page.evaluate(() => (window as any).creativeMediaFixture.calls()) as any[]).filter(item => item.method === 'POST')).toEqual([])
  await candidate.getByRole('button', { name: '核对并重试原登记', exact: true }).click()
  await expect(candidate.getByRole('heading', { name: /制作组候选已登记，项目未变/ })).toBeVisible()
  const final = await page.evaluate(async () => ({ files: await (window as any).creativeMediaFixture.files(), candidates: await (window as any).creativeMediaFixture.candidates(), calls: (window as any).creativeMediaFixture.calls(), run: (window as any).creativeMediaFixture.run() }))
  expect(final.files).toEqual(before)
  expect(final.candidates.image[0].managed.id).toBe(pending.image[0].managed.id)
  const posts = final.calls.filter((item: any) => item.method === 'POST')
  expect(posts).toHaveLength(1)
  expect(posts[0].key).toBe(pending.image[0].managed.id)
  expect(posts[0].body).toEqual(pending.image[0].managed.request)
  expect(final.run.artifacts.filter((item: any) => item.kind === 'media-adoption')).toHaveLength(1)
  await writeFile(info.outputPath('shared-registration-evidence.json'), JSON.stringify({ before, pending, final }, null, 2))
})

for (const format of ['adv-md', 'flow', 'markdown-dialogue', 'markdown-narration'] as const) {
  test(`auditions the registered real take, adopts its separate team selection and plays it with the imported image in the actual ${format} game`, async ({ page }, info) => {
    test.setTimeout(90000)
    const audioPath = process.env.STUDIO_CREATIVE_VOICE_WAV
    test.skip(!audioPath, 'Requires a real externally produced spoken WAV; no substitute tone is used')
    await page.addInitScript(() => {
      const records: any[] = []
      const gains: any[] = []
      Object.assign(window, { unifiedMediaPlayback: { records, gains } })
      const start = AudioBufferSourceNode.prototype.start
      AudioBufferSourceNode.prototype.start = function (...args: Parameters<typeof start>) {
        if (this.buffer && this.buffer.duration > 0.1) {
          const row = { duration: this.buffer.duration, rate: this.buffer.sampleRate, channels: this.buffer.numberOfChannels, state: this.context.state, start: this.context.currentTime, wallStart: performance.now(), ended: false, elapsed: 0, wallElapsed: 0, trusted: false }
          records.push(row)
          this.addEventListener('ended', (event) => {
            row.ended = true
            row.elapsed = this.context.currentTime - row.start
            row.wallElapsed = performance.now() - row.wallStart
            row.trusted = event.isTrusted
          }, { once: true })
        }
        return start.apply(this, args)
      }
      const connect = AudioNode.prototype.connect
      AudioNode.prototype.connect = function (...args: any[]) {
        if (args[0] instanceof AudioDestinationNode)
          gains.push({ from: this.constructor.name, gain: this instanceof GainNode ? this.gain.value : undefined })
        return (connect as any).apply(this, args)
      }
    })
    const multiline = format.startsWith('markdown-')
    const narration = format === 'markdown-narration'
    const speakerId = narration ? 'narrator' : 'lin'
    const spokenText = multiline ? '列车还没有到，\n我们再等一会儿。' : '列车还没有到，我们再等一会儿。'
    const targetLineId = format === 'flow' ? 'line_01900400-0000-7000-8000-000000000002' : 'line_01900400-0000-7000-8000-000000000001'
    const fixture = `/tests/fixtures/creative-team/media-milestones.html?case=${format === 'flow' ? 'flow-selected-playback' : multiline ? `${format}-selected` : 'selected-playback'}`
    await page.goto(fixture)
    await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeMediaFixture))).toBe(true)
    const milestone = await stageUnifiedMedia(page, audioPath!)
    if (multiline) {
      const voice = page.getByTestId('creative-voice-import')
      await expect(voice).toContainText(`adv/chapters/intro.adv.md:${narration ? '6–7' : '3–5'}`)
      await expect(voice.locator('.voice-import__text')).toHaveText(spokenText)
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 })
        await voice.locator('.voice-import__text').scrollIntoViewIfNeeded()
        await page.screenshot({ path: info.outputPath(`markdown-source-${width}.png`), animations: 'disabled' })
      }
    }
    await milestone.getByRole('button', { name: '确认写入项目', exact: true }).click()
    await expect(milestone.getByText(/最近一次采用已确认/)).toBeVisible()
    await page.goto(`/tabs/workspace/audio?section=review&speaker=${speakerId}&line=${targetLineId}`)
    const audioWorkspace = page.getByTestId('audio-workspace')
    const take = audioWorkspace.locator('.voice-review__take')
    await expect(take).toHaveCount(1)
    await take.getByRole('button', { name: '试听', exact: true }).click()
    const player = audioWorkspace.locator('audio')
    await expect.poll(() => player.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(0.4)
    const audition = await player.evaluate((element: HTMLAudioElement) => ({ duration: element.duration, time: element.currentTime, muted: element.muted, volume: element.volume }))
    expect(audition.duration).toBeGreaterThan(1)
    expect(audition.muted).toBe(false)
    await page.goto(fixture)
    await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeMediaFixture))).toBe(true)
    const original = page.getByTestId('creative-voice-candidate')
    await original.getByRole('checkbox', { name: '我已试听，并确认将此候选设为当前选用（如有旧选择，将替换它）', exact: true }).check()
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 })
      await original.getByRole('checkbox').scrollIntoViewIfNeeded()
      await page.screenshot({ path: info.outputPath(`shared-voice-selection-${width}.png`), animations: 'disabled' })
    }
    await original.getByRole('button', { name: '审阅此配音的选用绑定', exact: true }).click()
    const selection = page.getByTestId('creative-voice-candidate').filter({ hasText: '本候选只改变当前台词的选用绑定' })
    await expect(selection.getByRole('button', { name: '登记制作组候选（项目未变）', exact: true })).toBeVisible()
    const before = await page.evaluate(() => (window as any).creativeMediaFixture.files())
    await selection.getByRole('button', { name: '登记制作组候选（项目未变）', exact: true }).click()
    await expect(milestone.getByRole('checkbox')).toHaveCount(1)
    expect(await page.evaluate(() => (window as any).creativeMediaFixture.files())).toEqual(before)
    await milestone.getByRole('checkbox').check()
    await milestone.getByLabel('采用或撤销的原因', { exact: true }).fill('已通过正式音频工作区试听；本次只改变原 take 的选用绑定。')
    await milestone.getByRole('button', { name: '审阅采用', exact: true }).click()
    await milestone.getByRole('button', { name: '确认写入项目', exact: true }).click()
    await expect(selection.getByRole('heading', { name: /选用绑定已确认/ })).toBeVisible()
    const adopted = await page.evaluate(async () => ({ files: await (window as any).creativeMediaFixture.files(), media: await (window as any).creativeMediaFixture.media(), candidates: await (window as any).creativeMediaFixture.candidates(), run: (window as any).creativeMediaFixture.run() }))
    const binding = JSON.parse(adopted.files['adv/audio/voice-ledger.json']).lines[targetLineId].locales['zh-CN']
    expect(binding.selectedTake).toBe(binding.takes[0].id)
    expect(adopted.run.artifacts.filter((item: any) => item.media?.target.kind === 'voice').map((item: any) => [item.media.target.phase, item.status])).toEqual([['registered', 'adopted'], ['selected', 'adopted']])
    expect(adopted.run.artifacts.filter((item: any) => item.kind.endsWith('direction')).map((item: any) => item.status)).toEqual(['selected', 'selected'])
    expect(adopted.media).toHaveLength(2)
    expect(adopted.media.every((item: any) => item.sha256 === item.expectedSha256 && item.bytes === item.expectedBytes)).toBe(true)
    await writeFile(info.outputPath('shared-selected-input.json'), JSON.stringify({ audition, before, adopted }, null, 2))
    const voiceReports: unknown[] = []
    async function inspectSavedVoice(expected: 'ready' | 'stale') {
      const panel = page.getByTestId('creative-playtest')
      await panel.getByLabel('预期结局地址', { exact: true }).first().fill('intro#start')
      await panel.getByRole('button', { name: '执行这些路径', exact: true }).click()
      const voice = page.getByTestId('creative-playtest-voice-report')
      const row = voice.locator('li').filter({ hasText: targetLineId })
      await expect(row).toContainText(expected === 'ready' ? '已选用，字节匹配' : '已选配音过期')
      await expect(voice).toContainText('缺少配音')
      await expect(voice).toContainText('不证明实际播放或表演质量')
      const reports = await page.evaluate(() => (window as any).creativeMediaFixture.reports())
      const current = reports[0].report
      expect(current.voiceCoverage.rows.find((item: any) => item.lineId === targetLineId).status).toBe(expected)
      expect(current.voiceCoverage.snapshotRevision).toBe(current.snapshotRevision)
      expect(current.unverified).toContain('audio-playback')
      expect(current.executions[0].status).toBe('passed')
      voiceReports.push(current)
      if (expected === 'ready') {
        for (const width of [1280, 390]) {
          await page.setViewportSize({ width, height: 900 })
          await voice.getByRole('heading').scrollIntoViewIfNeeded()
          expect(await voice.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
          await page.screenshot({ path: info.outputPath(`voice-playtest-report-${width}.png`), animations: 'disabled' })
        }
      }
    }
    if (format === 'flow' || narration) {
      await inspectSavedVoice('ready')
      expect(await page.evaluate(() => (window as any).creativeMediaFixture.files())).toEqual(adopted.files)
      const postCount = await page.evaluate(() => (window as any).creativeMediaFixture.calls().filter((item: any) => item.method === 'POST').length)
      await page.reload()
      await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeMediaFixture))).toBe(true)
      await expect(page.getByTestId('creative-playtest-voice-report')).toContainText('已选用，字节匹配')
      expect(await page.evaluate(() => (window as any).creativeMediaFixture.calls().filter((item: any) => item.method === 'POST').length)).toBe(0)
      expect(postCount).toBeGreaterThan(0)
    }

    await page.goto('/tabs/play')
    try {
      await expect(page.locator('.game-player')).toContainText(format === 'flow' || narration ? '这是第一句，尚未配置配音。' : spokenText, { timeout: 15000 })
    }
    catch (cause) {
      const diagnostics = await page.evaluate(() => {
        const adv = (window as any).$adv
        const component = (document.querySelector('.game-player') as any)?.__vueParentComponent
        return { url: location.href, title: document.title, body: document.body.textContent, componentKeys: Object.keys(component?.setupState ?? {}), ready: component?.setupState?.ready, error: component?.setupState?.error, runtime: adv ? { cursor: adv.store?.state?.cursor, status: adv.store?.state?.status, title: adv.gameConfig?.value?.title } : null, resources: performance.getEntriesByType('resource').map((item: any) => ({ name: item.name, duration: item.duration, size: item.transferSize })) }
      })
      await writeFile(info.outputPath('shared-game-load-diagnostic.json'), JSON.stringify(diagnostics, null, 2))
      throw cause
    }
    const avatar = page.locator('.dialog-avatar-wrap img')
    await expect(avatar).toBeVisible()
    await expect.poll(() => avatar.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(619)
    await page.locator('.game-player .adv-ui').click({ position: { x: 200, y: 300 } })
    await page.getByTestId('play-toolbar-actions').getByRole('button', { name: '设置', exact: true }).click()
    await page.evaluate(() => {
      (window as any).unifiedMediaPlayback.records.length = 0
    })
    await page.locator('.adv-popover-menu:visible').getByText('重新开始', { exact: true }).click()
    if (format === 'flow' || narration) {
      const dialogue = page.locator('.game-player .adv-dialog-box')
      await expect(dialogue).toContainText('这是第一句，尚未配置配音。')
      if (narration) {
        for (let action = 0; action < 3 && !await page.locator('.game-player .adv-black').isVisible(); action++)
          await dialogue.click()
        await expect(page.locator('.game-player .adv-black')).toContainText('我们再等一会儿。')
        await expect(dialogue).toHaveCount(0)
      }
      else {
        for (let action = 0; action < 3 && !((await dialogue.textContent()) ?? '').includes('我们再等一会儿。'); action++)
          await dialogue.click()
        await expect(dialogue).toContainText(spokenText)
      }
      expect(Object.keys(JSON.parse(adopted.files['adv/audio/voice-ledger.json']).lines)).toEqual([targetLineId])
    }
    await expect.poll(() => page.evaluate(() => (window as any).unifiedMediaPlayback.records.some((item: any) => item.ended && item.trusted && item.state === 'running' && item.elapsed >= item.duration - 0.15 && item.wallElapsed >= (item.duration - 0.2) * 1000)), { timeout: 12000 }).toBe(true)
    const playback = await page.evaluate(() => (window as any).unifiedMediaPlayback)
    expect(playback.gains.some((item: any) => item.gain > 0)).toBe(true)
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 })
      await expect(narration ? page.locator('.game-player .adv-black') : avatar).toBeInViewport()
      await page.screenshot({ path: info.outputPath(`shared-selected-game-${width}.png`), animations: 'allow' })
    }
    let changedSource: unknown
    if (format === 'flow' || multiline) {
      await page.goto(fixture)
      await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeMediaFixture))).toBe(true)
      const path = format === 'flow' ? 'adv/chapters/intro.chapter.json' : 'adv/chapters/intro.adv.md'
      let content: string
      if (format === 'flow') {
        const chapter = JSON.parse(adopted.files[path])
        chapter.nodes[0].dialogues[1].text = '列车到了，我们走吧。'
        content = JSON.stringify(chapter, null, 2)
      }
      else {
        content = adopted.files[path].replace('等一会儿', '继续等下去')
      }
      await page.evaluate(({ path, content }) => (window as any).creativeMediaFixture.editSource(path, content), { path, content })
      const coverage = page.getByTestId('creative-voice-coverage')
      await coverage.getByRole('button', { name: '检查全部对白配音', exact: true }).click()
      const row = coverage.getByTestId('creative-voice-coverage-row').filter({ hasText: targetLineId })
      await expect(row).toContainText(format === 'flow' ? '列车到了，我们走吧。' : '我们再继续等下去。')
      await expect(row).toContainText('已选配音过期')
      const files = await page.evaluate(() => (window as any).creativeMediaFixture.files())
      expect(files['adv/audio/voice-ledger.json']).toBe(adopted.files['adv/audio/voice-ledger.json'])
      changedSource = { files, status: await row.textContent(), media: await page.evaluate(() => (window as any).creativeMediaFixture.media()) }
      if (format === 'flow' || narration)
        await inspectSavedVoice('stale')
    }
    await writeFile(info.outputPath('shared-selected-playback.json'), JSON.stringify({ format, speakerId, spokenText, targetLineId, voiceReports, changedFlow: format === 'flow' ? changedSource : undefined, changedMarkdown: multiline ? changedSource : undefined, scope: 'Actual WebP + external system speech; direction, identity and local service storage remain explicit fixtures. Native methods are observed, not replaced with fake playback. No physical speaker measurement or performance-quality claim.', audition, before, adopted, playback }, null, 2))
  })
}

test('reviews voice dictionary and intent as an immutable revision, adopts the actual sources, reopens read-only and conditionally undoes', async ({ page }, info) => {
  test.setTimeout(60000)
  await page.goto('/tests/fixtures/creative-team/media-milestones.html?case=voice-plan-review')
  await expect(page).toHaveTitle('Creative media milestone UI fixture')
  await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeMediaFixture))).toBe(true)
  const before = await page.evaluate(() => (window as any).creativeMediaFixture.files())
  const original = page.locator('[data-creative-artifact="voice-direction"]')
  await original.getByRole('button', { name: '编辑候选', exact: true }).click()
  const editor = original.getByTestId('creative-voice-plan-editor')
  await expect(editor.getByLabel('修订摘要', { exact: true })).toBeFocused()
  await editor.getByLabel('修订摘要', { exact: true }).fill('作者审阅的配音词典与声音意图')
  await editor.getByLabel('配音语言（如 zh-CN）', { exact: true }).fill('zh-CN')
  const lin = editor.getByRole('group', { name: 'lin', exact: true })
  await lin.getByRole('checkbox').check()
  await lin.getByLabel('表演与说话风格', { exact: true }).fill('轻声说话，句尾放缓')
  await lin.getByRole('combobox', { name: '语速', exact: true }).selectOption('slow')
  const narrator = editor.getByRole('group', { name: 'narrator', exact: true })
  await narrator.getByRole('checkbox').check()
  await narrator.getByLabel('表演与说话风格', { exact: true }).fill('从容的独立旁白')
  await editor.getByLabel('本次修改的原因', { exact: true }).fill('合并中文读法和受审声音意图，保留现有音色身份与其他语言。')
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await editor.evaluate(element => element.scrollIntoView({ block: 'start' }))
    await page.screenshot({ path: info.outputPath(`voice-plan-editor-${width}.png`), animations: 'disabled' })
  }
  await editor.getByRole('button', { name: '保存候选修订', exact: true }).click()
  const revised = page.locator('[data-creative-artifact]').filter({ has: page.getByRole('heading', { name: '作者审阅的配音词典与声音意图', exact: true }) })
  await expect(revised.getByRole('heading')).toBeFocused()
  expect(await page.evaluate(() => (window as any).creativeMediaFixture.files())).toEqual(before)
  await revised.getByRole('button', { name: '选定候选并继续', exact: true }).click()
  const milestone = page.getByTestId('creative-milestone')
  await expect(milestone.getByRole('checkbox')).toHaveCount(1)
  await milestone.getByRole('checkbox').check()
  await milestone.getByLabel('采用或撤销的原因', { exact: true }).fill('在同一事务采用词典、角色与旁白声音意图。')
  await milestone.getByRole('button', { name: '审阅采用', exact: true }).click()
  await expect(milestone.getByText('adv/audio/pronunciation.json', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => (window as any).creativeMediaFixture.files())).toEqual(before)
  await milestone.getByRole('button', { name: '确认写入项目', exact: true }).click()
  await expect(milestone.getByText(/最近一次采用已确认/)).toBeVisible()
  const adopted = await page.evaluate(() => (window as any).creativeMediaFixture.files())
  const dictionary = JSON.parse(adopted['adv/audio/pronunciation.json'])
  expect(dictionary).toMatchObject({ revision: 5, replacements: { ADV: '冒险' }, locales: { 'en': { replacements: { station: 'station' } }, 'zh-CN': { replacements: { 车站: '车站', 列车: '火车' } } } })
  const profile = JSON.parse(adopted['adv/characters/lin.character.md'].split('---')[1]).voiceProfile
  expect(profile).toMatchObject({ intent: { speakingStyle: '轻声说话，句尾放缓', pace: 'slow' }, locales: { 'zh-CN': { providers: { 'local-system': { voiceId: 'Tingting', model: 'macos-say', source: 'system' } } } } })
  expect(JSON.parse(adopted['adv/audio/voice-profiles.json'])).toMatchObject({ revision: 3, narrator: { intent: { temperament: ['从容'], speakingStyle: '从容的独立旁白' } } })
  expect(adopted).not.toHaveProperty('adv/audio/voice-ledger.json')
  const coverage = page.getByTestId('creative-voice-coverage')
  await coverage.getByRole('button', { name: '检查全部对白配音', exact: true }).click()
  await expect(coverage.getByRole('status')).toContainText('共 3 条对白，3 条待处理')
  await expect(coverage.getByTestId('creative-voice-coverage-row')).toHaveCount(3)
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await coverage.scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath(`voice-plan-coverage-${width}.png`), animations: 'disabled' })
  }
  await page.reload()
  await expect(milestone.getByText(/最近一次采用已确认/)).toBeVisible()
  expect(await page.evaluate(() => (window as any).creativeMediaFixture.files())).toEqual(adopted)
  expect(await page.evaluate(() => (window as any).creativeMediaFixture.writes())).toEqual([])
  expect((await page.evaluate(() => (window as any).creativeMediaFixture.calls()) as any[]).filter(item => item.method === 'POST')).toEqual([])
  await milestone.getByLabel('采用或撤销的原因', { exact: true }).fill('条件恢复写前的词典与声音意图，保留历史方案。')
  await milestone.getByRole('button', { name: '审阅最近一次撤销', exact: true }).click()
  await milestone.getByRole('button', { name: '确认撤销本次采用', exact: true }).click()
  await expect(milestone.getByText(/最近一次撤销已确认/)).toBeVisible()
  expect(await page.evaluate(() => (window as any).creativeMediaFixture.files())).toEqual(before)
  const run = await page.evaluate(() => (window as any).creativeMediaFixture.run())
  expect(run.toolCalls).toBe(0)
  expect(run.chargedMicroPoints).toBe(0)
  expect(run.status).not.toBe('completed')
  await writeFile(info.outputPath('voice-plan-adoption.json'), JSON.stringify({ scope: 'Actual shared source transforms, Studio transaction and IndexedDB; proposals, identity and local HTTP storage are explicit fixtures, no model or synthesis.', before, adopted, run }, null, 2))
})

test('inventories every actual Flow dialogue and narration, including unplanned missing voices, and filters without project writes', async ({ page }, info) => {
  await page.goto('/tests/fixtures/creative-team/media-milestones.html?case=voice-plan-flow')
  await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeMediaFixture))).toBe(true)
  const before = await page.evaluate(() => (window as any).creativeMediaFixture.files())
  const panel = page.getByTestId('creative-voice-coverage')
  await panel.getByRole('button', { name: '检查全部对白配音', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('共 3 条对白，3 条待处理')
  const rows = panel.getByTestId('creative-voice-coverage-row')
  await expect(rows).toHaveCount(3)
  await expect(rows.filter({ hasText: '这是方案未列出的 Flow 对白。' })).toContainText('缺少配音')
  await expect(rows.filter({ hasText: '站台上的灯亮了。' })).toContainText('narrator')
  await expect(rows.first()).toContainText('adv/chapters/intro.chapter.json')
  await panel.getByLabel('搜索台词、说话者或源位置', { exact: true }).fill('方案未列出')
  await expect(rows).toHaveCount(1)
  await panel.getByLabel('搜索台词、说话者或源位置', { exact: true }).fill('')
  await panel.getByRole('combobox', { name: '配音状态', exact: true }).selectOption('ready')
  await expect(rows).toHaveCount(0)
  await panel.getByRole('combobox', { name: '配音状态', exact: true }).selectOption('all')
  await expect(rows).toHaveCount(3)
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await panel.scrollIntoViewIfNeeded()
    if (width === 390) {
      await rows.nth(1).evaluate(element => element.scrollIntoView({ block: 'start' }))
      await expect(rows.nth(1)).toBeInViewport()
      await expect(rows.last()).toBeInViewport()
    }
    await page.screenshot({ path: info.outputPath(`flow-voice-coverage-${width}.png`), animations: 'disabled' })
  }
  expect(await page.evaluate(() => (window as any).creativeMediaFixture.files())).toEqual(before)
  expect(await page.evaluate(() => (window as any).creativeMediaFixture.writes())).toEqual([])
  expect((await page.evaluate(() => (window as any).creativeMediaFixture.calls()) as any[]).filter(item => item.method === 'POST')).toEqual([])
  await writeFile(info.outputPath('flow-voice-coverage.json'), JSON.stringify({ scope: 'Actual compiled Flow program, standard ledger inspection and scoped UI; no guessed line identity, project writes, generation or billing.', files: before, rows: await rows.allTextContents() }, null, 2))
})

test('merges actual candidate sources, restores a lost receipt without writes and conditionally undoes the authored result', async ({ page }, info) => {
  await page.goto('/tests/fixtures/creative-team/media-milestones.html?case=source-merge')
  await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeMediaFixture))).toBe(true)
  const files = () => page.evaluate(() => (window as any).creativeMediaFixture.files())
  const original = await files()
  const panel = page.getByTestId('creative-milestone')
  await panel.getByLabel('候选甲：等待末班车', { exact: true }).check()
  await panel.getByLabel('候选乙：主动归还信件', { exact: true }).check()
  await panel.getByLabel('采用或撤销的原因', { exact: true }).fill('先归还信件，再等待末班车；保留两份候选的贡献')
  const merge = panel.getByTestId('creative-milestone-merge')
  await expect(merge).toHaveCount(1)
  await expect(panel.getByRole('button', { name: '审阅采用', exact: true })).toBeDisabled()
  await merge.getByText('候选甲：等待末班车', { exact: true }).click()
  await merge.getByRole('button', { name: '以此候选起稿', exact: true }).first().click()
  const result = '# 等车 {#start}\n\n@lin\n先归还信件，再等末班车。\n'
  await merge.getByLabel('合并后的完整文件', { exact: true }).fill(result)
  await merge.getByLabel('我已核对各候选，确认此合并结果', { exact: true }).check()
  await panel.getByRole('button', { name: '审阅采用', exact: true }).click()
  await expect(panel.getByText('候选快照编译通过，请核对下面的文件变化。', { exact: true })).toBeVisible()
  expect(await files()).toEqual(original)
  expect((await page.evaluate(() => (window as any).creativeMediaFixture.calls()) as any[]).filter(item => item.method === 'POST')).toEqual([])
  await merge.getByLabel('合并后的完整文件', { exact: true }).fill(`${result}\n雨仍在下。\n`)
  await expect(panel.getByRole('button', { name: '确认写入项目', exact: true })).toHaveCount(0)
  await expect(merge.getByLabel('我已核对各候选，确认此合并结果')).not.toBeChecked()
  await merge.getByLabel('合并后的完整文件', { exact: true }).fill(result)
  await merge.getByLabel('我已核对各候选，确认此合并结果', { exact: true }).check()
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await merge.evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }))
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    await expect(merge.getByRole('heading')).toBeInViewport()
    await expect(merge.getByLabel('合并后的完整文件', { exact: true })).toBeInViewport()
    await page.screenshot({ path: info.outputPath(`source-merge-${width}.png`), animations: 'disabled' })
    const bounds = await merge.evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth }))
    expect(bounds.scroll).toBeLessThanOrEqual(bounds.width + 1)
  }
  await panel.getByRole('button', { name: '审阅采用', exact: true }).click()
  await page.evaluate(() => (window as any).creativeMediaFixture.lose('confirm'))
  await panel.getByRole('button', { name: '确认写入项目', exact: true }).click()
  await expect.poll(() => page.evaluate(async () => (await (window as any).creativeMediaFixture.journal())?.state)).toBe('applied')
  const adopted = await files()
  expect(adopted['adv/chapters/intro.adv.md']).toBe(result)
  const receipt = await page.evaluate(() => (window as any).creativeMediaFixture.journal())
  expect(receipt.request.merges).toEqual([{ path: 'adv/chapters/intro.adv.md', after: result }])
  await page.reload()
  await expect(panel.getByRole('button', { name: '同步采用回执', exact: true })).toBeVisible()
  expect(await files()).toEqual(adopted)
  expect(await page.evaluate(() => (window as any).creativeMediaFixture.writes())).toEqual([])
  expect((await page.evaluate(() => (window as any).creativeMediaFixture.calls()) as any[]).filter(item => item.method === 'POST')).toEqual([])
  await panel.getByRole('button', { name: '同步采用回执', exact: true }).click()
  await expect.poll(() => page.evaluate(async () => (await (window as any).creativeMediaFixture.journal())?.state)).toBe('confirmed')
  expect(await page.evaluate(() => (window as any).creativeMediaFixture.writes())).toEqual([])
  const recorded = panel.getByTestId('creative-merge-receipt')
  await recorded.getByRole('button').count().then(count => expect(count).toBe(0))
  await recorded.getByText(/记录的作者合并结果/).click()
  await expect(recorded.locator('pre')).toHaveText(result.trim())
  await panel.getByLabel('采用或撤销的原因', { exact: true }).fill('撤销作者合并稿，逐字节恢复原稿')
  await panel.getByRole('button', { name: '审阅最近一次撤销', exact: true }).click()
  await panel.getByRole('button', { name: '确认撤销本次采用', exact: true }).click()
  await expect(panel.getByText(/最近一次撤销已确认/)).toBeVisible()
  expect(await files()).toEqual(original)
  const run = await page.evaluate(() => (window as any).creativeMediaFixture.run())
  expect(run.artifacts.map((item: any) => item.status)).toEqual(['selected', 'selected'])
  expect(run.chargedMicroPoints).toBe(0)
  expect(run.toolCalls).toBe(0)
  await writeFile(info.outputPath('source-merge-evidence.json'), JSON.stringify({ scope: 'Actual source compiler, workspace transaction and IndexedDB; proposal/auth/service storage are explicit fixtures, no model or billing', original, adopted, receipt, run }, null, 2))
})

test('keeps a later author source intact when a reviewed merge is confirmed', async ({ page }, info) => {
  await page.goto('/tests/fixtures/creative-team/media-milestones.html?case=source-merge-conflict')
  await expect.poll(() => page.evaluate(() => Boolean((window as any).creativeMediaFixture))).toBe(true)
  const panel = page.getByTestId('creative-milestone')
  await panel.getByLabel('候选甲：等待末班车', { exact: true }).check()
  await panel.getByLabel('候选乙：主动归还信件', { exact: true }).check()
  await panel.getByLabel('采用或撤销的原因', { exact: true }).fill('综合两份候选')
  const merge = panel.getByTestId('creative-milestone-merge')
  await merge.getByLabel('合并后的完整文件', { exact: true }).fill('# 等车 {#start}\n\n先归还信件，再等车。')
  await merge.getByLabel('我已核对各候选，确认此合并结果', { exact: true }).check()
  await panel.getByRole('button', { name: '审阅采用', exact: true }).click()
  await expect(panel.getByRole('button', { name: '确认写入项目', exact: true })).toBeVisible()
  const authored = '# 等车 {#start}\n\n作者刚刚在另一个编辑入口保存的内容。\n'
  await page.evaluate(content => (window as any).creativeMediaFixture.editSource('adv/chapters/intro.adv.md', content), authored)
  await panel.getByRole('button', { name: '确认写入项目', exact: true }).click()
  await expect(panel.getByRole('alert')).toBeVisible()
  const files = await page.evaluate(() => (window as any).creativeMediaFixture.files())
  expect(files['adv/chapters/intro.adv.md']).toBe(authored)
  const writes = await page.evaluate(() => (window as any).creativeMediaFixture.writes())
  expect(writes).toEqual(['adv/chapters/intro.adv.md'])
  const calls = await page.evaluate(() => (window as any).creativeMediaFixture.calls())
  expect(calls.filter((item: any) => item.method === 'POST')).toEqual([])
  expect(await page.evaluate(() => (window as any).creativeMediaFixture.journal())).toBeUndefined()
  await writeFile(info.outputPath('source-merge-conflict.json'), JSON.stringify({ scope: 'Actual workspace revision guard after author edit; no POST, overwrite or adoption intent', authored, files, writes, calls }, null, 2))
})
