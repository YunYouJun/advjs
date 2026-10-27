import type { EditorBridge } from 'advjs/node'
import { createHash } from 'node:crypto'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { expect, test } from '@playwright/test'
import { createEditorBridge } from 'advjs/node'
import { createEditorBreezeFixture } from '../fixtures/audio/editor-breeze'
import { editorJobLineIds } from '../fixtures/audio/editor-voice-jobs'

test.skip(process.env.ADVJS_REAL_BREEZE !== '1', 'Real Breeze inference is explicitly opt-in')
let fixture: Awaited<ReturnType<typeof createEditorBreezeFixture>>
let bridge: EditorBridge
const artifactRoot = resolve(process.env.ADVJS_BREEZE_ARTIFACTS ?? join(tmpdir(), `advjs-real-breeze-${Date.now()}`))

test.afterAll(async () => {
  await bridge?.stop()
  if (fixture)
    await rm(fixture.directory, { recursive: true, force: true })
})

test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus)
    return
  await mkdir(artifactRoot, { recursive: true })
  const panel = page.locator('.ae-audio-workspace')
  await writeFile(join(artifactRoot, 'failure-ui.txt'), await panel.textContent().catch(() => 'Panel unavailable') ?? 'Panel unavailable')
  await panel.screenshot({ path: join(artifactRoot, 'failure-ui.png') }).catch(() => {})
})

test('existing Editor designs, auditions and applies a real Breeze voice', async ({ page }) => {
  page.setDefaultTimeout(20_000)
  const bodies: Array<Record<string, unknown>> = []
  const local = join(homedir(), '.local/share/breeze-tts')
  fixture = await createEditorBreezeFixture({ alignment: { python: join(local, '.venv/bin/python'), modelPath: join(local, 'models/Qwen3-ForcedAligner-0.6B-8bit'), revision: '0e1a68e91d815300c7c9754b2a7639378b23db15' }, fetch: async (url, init) => {
    if (init?.method === 'POST') {
      if (init.body instanceof FormData) {
        const fields: Record<string, unknown> = {}
        for (const [key, value] of init.body.entries()) {
          fields[key] = typeof value === 'string' ? value : { bytes: value.size, sha256: createHash('sha256').update(new Uint8Array(await value.arrayBuffer())).digest('hex') }
        }
        bodies.push(fields)
      }
      else {
        bodies.push(JSON.parse(init.body as string))
      }
    }
    return fetch(url, init)
  } })
  // Only disposable resources belong to the deletion acceptance test.
  const installation = { root: join(fixture.directory, 'installation'), id: 'e2e-breeze', protectedPaths: ['output'], resources: [{ id: 'cache', kind: 'cache' as const, path: 'cache', label: '临时缓存' }, { id: 'environment', kind: 'environment' as const, path: 'environment', label: '临时环境' }, { id: 'model', kind: 'model' as const, path: 'model', label: '临时模型' }], isRunning: async () => false }
  for (const path of ['cache', 'environment', 'model', 'output'])
    await mkdir(join(installation.root, path), { recursive: true })
  await writeFile(join(installation.root, 'cache/disposable'), 'cache only')
  await writeFile(join(installation.root, 'output/recording.wav'), 'protected unique recording')
  await writeFile(join(installation.root, 'output/generated.wav'), 'protected completed voice')
  await writeFile(join(installation.root, '.advjs-voice-installation.json'), JSON.stringify({ schemaVersion: 1, ...installation, providerId: fixture.provider.id }))
  fixture.provider.installation = installation
  await expect.poll(async () => (await fixture.provider.doctor!({ root: fixture.root })).ready, { timeout: 60_000 }).toBe(true)
  await mkdir(artifactRoot, { recursive: true })
  bridge = await createEditorBridge({ host: '127.0.0.1', port: 0, projectRoot: fixture.root, publicRoot: resolve('editor/core/dist'), audioJobs: { config: fixture.config, storeDirectory: fixture.storeDirectory } })
  const { url } = await bridge.start()
  const maintenanceUrl = `${new URL(url).origin}/__advjs/api/audio/providers`
  expect((await fetch(maintenanceUrl)).status).toBe(401)
  expect((await fetch(`${maintenanceUrl}/plan`, { method: 'POST', headers: { 'authorization': `Bearer ${bridge.token}`, 'content-type': 'application/json' }, body: JSON.stringify({ providerId: fixture.provider.id, resourceIds: ['cache'], allowShared: false, path: '/tmp/forged' }) })).status).toBe(409)
  await page.addInitScript(() => {
    localStorage.setItem('advjs:editor:locale', 'zh-CN')
    localStorage.setItem('advjs:editor:onboarded', 'true')
    localStorage.setItem('nuxt-color-mode', 'dark')
  })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 1000 })
  // Do not log the bridge's scoped launch credential in navigation failures.
  try {
    await page.goto(url)
  }
  catch {
    throw new Error('Breeze Editor navigation failed')
  }
  await expect(page.locator('body')).not.toBeEmpty()
  const main = page.locator('[data-editor-region="main"]')
  await expect(main).toBeVisible()
  expect(new URL(page.url()).origin).toBe(new URL(url).origin)
  await expect(page).toHaveTitle('ADV.JS Editor')
  const title = await page.title()
  await main.getByRole('tab', { name: '音频', exact: true }).click()
  const panel = main.locator('.ae-audio-workspace')
  await panel.getByRole('tab', { name: '音色设计', exact: true }).click()
  const design = panel.getByRole('region', { name: '音色设计', exact: true })
  await design.getByTestId('design-new').click()
  await design.getByRole('combobox', { name: '设计角色／旁白', exact: true }).click()
  await page.getByRole('option', { name: 'Hero', exact: true }).click()
  await design.getByLabel('音色名称', { exact: true }).fill('Breeze 开心女声')
  await design.getByLabel('音色描述', { exact: true }).fill('年轻明亮的女声，普通话自然清晰。')
  await design.getByLabel('说话风格', { exact: true }).fill('开心，带笑意，像迎接朋友一样说话。')
  await design.getByLabel('气质', { exact: true }).fill('温柔, 活泼')
  await design.getByTestId('design-save').click()
  await expect(design.getByTestId('design-new-version')).toBeEnabled()
  expect(bodies).toHaveLength(0)
  const referenceText = '你终于回来啦！我一直在这里等你。今天的阳光很温暖，我们沿着河边慢慢走，等天色暗下来，再找一家安静的小店，聊聊最近发生的事情。'
  await design.getByLabel('试听文本', { exact: true }).fill(referenceText)
  await design.getByRole('checkbox', { name: '当前费用无法估算；我允许在字符预算内生成试听', exact: true }).check()
  await design.getByTestId('design-plan').click()
  await expect(design.getByTestId('design-review')).toContainText('Breeze-TTS-2')
  await design.getByRole('checkbox', { name: '我已核对音色、语言、试听文本与预算', exact: true }).check()
  await design.getByTestId('design-execute').click()
  await expect(design.getByTestId('design-preview-ready')).toBeVisible({ timeout: 180_000 })
  expect(bodies).toHaveLength(1)
  const kwargs = JSON.parse(bodies[0]!.kwargs as string)
  expect(kwargs).toMatchObject({ seed: 42, cfg_scale: 4 })
  expect(kwargs.instruct).toContain('年轻明亮的女声')
  expect(kwargs.instruct).toContain('开心，带笑意')
  await design.getByTestId('design-audition').click()
  const audio = design.getByLabel('音色候选试听')
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.readyState)).toBeGreaterThanOrEqual(2)
  const measured = await audio.evaluate(async (element: HTMLAudioElement) => {
    const bytes = await (await fetch(element.src)).arrayBuffer()
    const context = new AudioContext()
    const buffer = await context.decodeAudioData(bytes)
    const samples = buffer.getChannelData(0)
    const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length)
    await context.close()
    return { duration: buffer.duration, rms }
  })
  expect(measured.duration).toBeGreaterThan(0.5)
  expect(measured.rms).toBeGreaterThan(0.005)
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(0)
  await panel.screenshot({ path: join(artifactRoot, 'breeze-normal.png'), animations: 'disabled' })
  const narrow = await page.addStyleTag({ content: '.ae-audio-workspace { width: 320px !important; max-width: 320px !important; }' })
  await expect.poll(() => panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await panel.screenshot({ path: join(artifactRoot, 'breeze-320.png'), animations: 'disabled' })
  await narrow.evaluate(element => element.remove())
  await design.getByTestId('design-stop-audition').click()
  await design.getByTestId('design-register').click()
  await expect(design.getByTestId('design-preview-registered')).toBeVisible()
  await design.getByTestId('design-select-sample').click()
  await design.getByTestId('design-apply').click()
  await expect.poll(async () => JSON.parse(await readFile(join(fixture.root, 'adv/settings/game.json'), 'utf8')).characters[0].voiceProfile?.locales?.['zh-CN']?.providers?.['breeze-tts']?.projectVoiceId).toBeTruthy()
  const generated = fixture.requests[0]!.candidate
  const alignedGenerated = generated as typeof generated & { alignment?: { units: Array<{ start: number, end: number, startTime: number, endTime: number }>, text: string, audioSha256: string } }
  expect(alignedGenerated.alignment).toMatchObject({ text: referenceText, audioSha256: generated.sha256 })
  expect(alignedGenerated.alignment!.units.length).toBeGreaterThan(20)
  await writeFile(join(artifactRoot, 'breeze-editor-preview.wav'), await readFile(join(fixture.root, generated.path)))

  await panel.getByRole('tab', { name: '配音任务', exact: true }).click()
  const jobs = panel.getByRole('region', { name: '配音生成任务', exact: true })
  await jobs.locator(`[data-line-id="${editorJobLineIds[0]}"]`).check()
  await jobs.getByRole('checkbox', { name: '我同意费用无法估算，按上述字符预算执行', exact: true }).check()
  await jobs.getByTestId('jobs-plan').click()
  await expect(jobs.getByTestId('jobs-plan-review')).toContainText('1 句')
  await jobs.getByRole('checkbox', { name: '我已审核范围、语言与预算；生成不会替换已选配音', exact: true }).check()
  await jobs.getByTestId('jobs-enqueue').click()
  await jobs.getByTestId('jobs-run').click()
  await expect(jobs.locator('[data-task-status="committed"]')).toHaveCount(1, { timeout: 180_000 })
  expect(bodies).toHaveLength(2)
  const ledgerPath = join(fixture.root, 'adv/audio/voice-ledger.json')
  const beforeSelection = JSON.parse(await readFile(ledgerPath, 'utf8')).lines[editorJobLineIds[0]!].locales['zh-CN']
  expect(beforeSelection.selectedTake).toBeNull()
  expect(beforeSelection.takes[0].providerId).toBe('breeze-tts')
  await panel.getByRole('tab', { name: '对白配音', exact: true }).click()
  const ledger = panel.getByRole('region', { name: '对白配音账本', exact: true })
  // An existing recording can acquire timings without another TTS request.
  const legacyLedger = JSON.parse(await readFile(ledgerPath, 'utf8'))
  delete legacyLedger.lines[editorJobLineIds[0]!].locales['zh-CN'].takes[0].alignment
  await writeFile(ledgerPath, JSON.stringify(legacyLedger))
  await ledger.getByTestId('ledger-refresh').click()
  await expect(ledger.getByTestId('take-align')).toHaveText('生成逐字时间轴')
  const alignedResponse = page.waitForResponse(response => response.url().endsWith('/audio/alignment') && response.request().method() === 'POST', { timeout: 180_000 })
  await ledger.getByTestId('take-align').click()
  const alignmentResponse = await alignedResponse
  expect(await alignmentResponse.json()).toHaveProperty('ledger')
  expect(alignmentResponse.status()).toBe(200)
  await expect(ledger.getByTestId('take-align')).toHaveText('重新对齐逐字时间轴', { timeout: 180_000 })
  expect(bodies).toHaveLength(2)
  await ledger.getByTestId('take-preview').click()
  await expect.poll(() => ledger.locator('audio').evaluate((element: HTMLAudioElement) => element.readyState)).toBeGreaterThanOrEqual(2)
  await ledger.getByTestId('take-select').click()
  await expect.poll(async () => JSON.parse(await readFile(ledgerPath, 'utf8')).lines[editorJobLineIds[0]!].locales['zh-CN'].selectedTake).toBe(beforeSelection.takes[0].id)
  await panel.screenshot({ path: join(artifactRoot, 'breeze-dialogue.png'), animations: 'disabled' })
  await writeFile(join(artifactRoot, 'breeze-editor-dialogue.wav'), await readFile(join(fixture.root, fixture.requests[1]!.candidate.path)))

  await main.getByRole('tab', { name: '游戏', exact: true }).click()
  const game = page.locator('.adv-screen')
  await expect(game).toBeVisible()
  await expect.poll(() => game.evaluate(() => {
    const adv = (document.querySelector('#__nuxt') as any).__vue_app__._context.provides['$advjs-context']
    return Boolean(Object.values(adv.gameConfig.value.audio?.voiceLedger?.lines ?? {}).some((line: any) => Object.values(line.locales).some((binding: any) => binding.selectedTake && binding.takes.some((take: any) => take.alignment))))
  })).toBe(true)
  await game.evaluate(async () => {
    const adv = (document.querySelector('#__nuxt') as any).__vue_app__._context.provides['$advjs-context']
    await adv.$audio.unlock()
    await adv.runtime.start()
  })
  await expect(game.locator('[data-voice-active]')).toBeVisible()
  const spoken = await game.evaluate(() => {
    const adv = (document.querySelector('#__nuxt') as any).__vue_app__._context.provides['$advjs-context']
    adv.$audio.pause()
    const highlight = adv.$audio.voiceHighlight.value
    return highlight.text.slice(highlight.unit.start, highlight.unit.end)
  })
  await expect(game.locator('[data-voice-active]')).toHaveText(spoken)
  await game.screenshot({ path: join(artifactRoot, 'breeze-player-highlight.png'), animations: 'disabled' })
  await game.evaluate(async () => {
    const adv = (document.querySelector('#__nuxt') as any).__vue_app__._context.provides['$advjs-context']
    await adv.$audio.resume()
    await adv.runtime.next()
  })
  await expect(game.locator('[data-voice-active]')).toHaveCount(0)
  await main.getByRole('tab', { name: '音频', exact: true }).click()

  // Use this run's original synthetic voice as reference, rather than a person's
  // recording. Import, registration, rights and playback all use real host ports.
  const referenceTitle = 'breeze-original-reference.wav'
  await panel.getByRole('tab', { name: '音频资源', exact: true }).click()
  const resources = panel.getByRole('region', { name: '项目音频资源', exact: true })
  await resources.getByRole('combobox', { name: '导入音频用途', exact: true }).click()
  await page.getByRole('option', { name: '声音参考 · Reference', exact: true }).click()
  await resources.locator('input[type="file"]').setInputFiles({ name: referenceTitle, mimeType: 'audio/wav', buffer: await readFile(join(fixture.root, generated.path)) })
  const catalogPath = join(fixture.root, 'adv/assets.json')
  await expect.poll(async () => JSON.parse(await readFile(catalogPath, 'utf8')).assets.some((asset: { title?: string }) => asset.title === referenceTitle)).toBe(true)
  const referenceAsset = JSON.parse(await readFile(catalogPath, 'utf8')).assets.find((asset: { title?: string }) => asset.title === referenceTitle)
  await mkdir(join(fixture.root, 'authoring/rights'), { recursive: true })
  await writeFile(join(fixture.root, 'authoring/rights/breeze-original.json'), JSON.stringify({ schemaVersion: 1, source: 'original-synthetic', subject: 'Fictional Breeze voice', assetId: referenceAsset.id, sha256: generated.sha256, text: referenceText, purpose: 'Local ADV.JS clone integration acceptance' }))
  await panel.getByRole('tab', { name: '音色设计', exact: true }).click()
  await design.getByTestId('design-reload').click()
  await design.getByTestId('design-new').click()
  await design.getByRole('combobox', { name: '设计角色／旁白', exact: true }).click()
  await page.getByRole('option', { name: 'Hero', exact: true }).click()
  await design.getByLabel('音色名称', { exact: true }).fill('Breeze 原创参考克隆')
  await design.getByRole('combobox', { name: 'zh-CN breeze-tts 音色来源', exact: true }).click()
  await page.getByRole('option', { name: '授权参考音色', exact: true }).click()
  await design.getByRole('combobox', { name: 'zh-CN breeze-tts 已登记参考', exact: true }).click()
  await page.getByRole('option', { name: referenceTitle, exact: true }).click()
  await design.getByRole('combobox', { name: 'zh-CN breeze-tts 参考模式', exact: true }).click()
  await expect(page.getByRole('option', { name: '仅声音特征', exact: true })).toHaveCount(0)
  await page.getByRole('option', { name: '参考音频与文本', exact: true }).click()
  await design.getByLabel('参考文本', { exact: true }).fill(referenceText)
  await design.getByLabel('说话风格', { exact: true }).fill('平静自然，保持参考音色。')
  await design.getByLabel('使用许可', { exact: true }).fill('原创合成音色，仅用于本机测试')
  await design.getByLabel('声音主体', { exact: true }).fill('Fictional Breeze voice')
  await design.getByLabel('项目同意文件', { exact: true }).fill('authoring/rights/breeze-original.json')
  expect(bodies).toHaveLength(2)
  await design.getByTestId('design-save').click()
  await expect(design.getByTestId('design-new-version')).toBeEnabled()
  await design.getByLabel('试听文本', { exact: true }).fill('我们又见面了。这一次，就让我陪你走到故事的最后。')
  await design.getByRole('checkbox', { name: '当前费用无法估算；我允许在字符预算内生成试听', exact: true }).check()
  await design.getByTestId('design-plan').click()
  await expect(design.getByTestId('design-review')).toContainText('cloned')
  await design.getByRole('checkbox', { name: '我已核对音色、语言、试听文本与预算', exact: true }).check()
  await design.getByTestId('design-execute').click()
  await expect(design.getByTestId('design-preview-ready')).toBeVisible({ timeout: 180_000 })
  expect(bodies).toHaveLength(3)
  expect(bodies[2]!.prompt_speech).toMatchObject({ sha256: generated.sha256, bytes: generated.bytes })
  expect(JSON.parse(bodies[2]!.kwargs as string)).toMatchObject({ prompt_text: referenceText, cfg_scale: 4, seed: 42 })
  await design.getByTestId('design-audition').click()
  await expect.poll(() => design.getByLabel('音色候选试听').evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(0)
  const clonedAlignment = (fixture.requests[2]!.candidate as typeof alignedGenerated).alignment!
  expect(clonedAlignment.text).toBe('我们又见面了。这一次，就让我陪你走到故事的最后。')
  const cloneAudio = design.getByLabel('音色候选试听')
  for (const unit of [clonedAlignment.units[1]!, clonedAlignment.units[9]!]) {
    await cloneAudio.evaluate((element: HTMLAudioElement, time) => {
      element.pause()
      element.currentTime = time
    }, (unit.startTime + unit.endTime) / 2)
    await expect(design.locator('[data-voice-active]')).toHaveText(clonedAlignment.text.slice(unit.start, unit.end))
  }
  await panel.screenshot({ path: join(artifactRoot, 'breeze-clone-normal.png'), animations: 'disabled' })
  const cloneNarrow = await page.addStyleTag({ content: '.ae-audio-workspace { width: 320px !important; max-width: 320px !important; }' })
  await expect.poll(() => panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await panel.screenshot({ path: join(artifactRoot, 'breeze-clone-320.png'), animations: 'disabled' })
  await cloneNarrow.evaluate(element => element.remove())
  await design.getByTestId('design-stop-audition').click()
  await design.getByTestId('design-register').click()
  await expect(design.getByTestId('design-preview-registered')).toBeVisible()
  await design.getByTestId('design-select-sample').click()
  await design.getByRole('checkbox', { name: '我确认替换此语言／供应商的已有角色音色绑定', exact: true }).check()
  await design.getByTestId('design-apply').click()
  const cloned = fixture.requests[2]!.candidate
  expect(cloned).toMatchObject({ providerVoiceId: `reference:${referenceAsset.id}:${generated.sha256}` })
  await expect.poll(async () => JSON.parse(await readFile(join(fixture.root, 'adv/settings/game.json'), 'utf8')).characters[0].voiceProfile.locales['zh-CN'].providers['breeze-tts'].source).toBe('cloned')
  await writeFile(join(artifactRoot, 'breeze-editor-clone.wav'), await readFile(join(fixture.root, cloned.path)))
  await panel.getByRole('tab', { name: '供应商与清理', exact: true }).click()
  const cleanup = panel.getByRole('region', { name: '语音供应商与卸载清理', exact: true })
  await expect(cleanup.locator('[data-resource-id]')).toHaveCount(3)
  await expect(cleanup.locator('input[type="checkbox"]:checked')).toHaveCount(0)
  await cleanup.locator('[data-resource-id="cache"]').check()
  await cleanup.getByTestId('cleanup-plan').click()
  await expect(cleanup.getByTestId('cleanup-review')).toContainText('参考录音')
  await panel.screenshot({ path: join(artifactRoot, 'breeze-cleanup-normal.png'), animations: 'disabled' })
  const cleanupNarrow = await page.addStyleTag({ content: '.ae-audio-workspace { width: 320px !important; max-width: 320px !important; }' })
  await expect.poll(() => panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await panel.screenshot({ path: join(artifactRoot, 'breeze-cleanup-320.png'), animations: 'disabled' })
  await cleanupNarrow.evaluate(element => element.remove())
  await cleanup.getByTestId('cleanup-reviewed').check()
  const removal = page.waitForResponse(response => response.url().endsWith('/audio/providers/execute') && response.request().method() === 'POST')
  await cleanup.getByTestId('cleanup-execute').click()
  const cleanupResult = await (await removal).json()
  expect(cleanupResult).toMatchObject({ removed: ['cache'], removedBytes: 10, packageRemoved: false })
  await expect(cleanup.getByTestId('cleanup-result')).toBeVisible()
  await expect(readFile(join(installation.root, 'cache/disposable'))).rejects.toMatchObject({ code: 'ENOENT' })
  expect(await readFile(join(installation.root, 'output/recording.wav'), 'utf8')).toBe('protected unique recording')
  expect(await readFile(join(installation.root, 'output/generated.wav'), 'utf8')).toBe('protected completed voice')
  expect(await readFile(join(fixture.root, cloned.path))).toBeTruthy()
  await cleanup.getByTestId('cleanup-enable').click()
  await expect(cleanup.getByTestId('cleanup-enable')).toHaveCount(0)
  if (process.env.ADVJS_BREEZE_DEMO) {
    const destination = resolve(process.env.ADVJS_BREEZE_DEMO)
    // A fresh user-requested demo keeps native author data and registered audio,
    // sharing the existing model instead of retaining temporary preview copies.
    await cp(fixture.root, destination, { recursive: true, force: false, errorOnExist: true, filter: path => !path.split(/[\\/]/u).includes('.advjs') })
  }
  await writeFile(join(artifactRoot, 'qa.json'), `${JSON.stringify({ backend: 'real local Xinference Breeze', browser: 'Browser plugin not available; Playwright Chromium', title, measured, candidate: generated, cloned, selectedTake: beforeSelection.takes[0], cleanupResult, bodies, errors }, null, 2)}\n`)
  expect(errors).toEqual([])
})
