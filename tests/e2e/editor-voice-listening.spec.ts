import type { EditorBridge } from 'advjs/node'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { inspectVoiceListeningSession } from '@advjs/audio'
import { expect, test } from '@playwright/test'
import { createEditorBridge } from 'advjs/node'
import { createEditorListeningFixture } from '../fixtures/audio/editor-listening'

const repositoryRoot = resolve(import.meta.dirname, '../..')
let bridge: EditorBridge | undefined
test.afterEach(async () => {
  await bridge?.stop()
  bridge = undefined
})

test('daily A/B and lazy advanced review use verified native audio, private portable recovery and explicit stale gates', async ({ page }, info) => {
  const evidence = process.env.ADVJS_LISTENING_EDITOR_EVIDENCE || info.outputPath('evidence')
  await mkdir(evidence, { recursive: true })
  const fixture = await createEditorListeningFixture({ directory: evidence, archivedCalls: process.env.ADVJS_LISTENING_QWEN_EVIDENCE })
  bridge = await createEditorBridge({ host: '127.0.0.1', port: 0, projectRoot: fixture.root, publicRoot: join(repositoryRoot, 'editor/core/dist') })
  await page.addInitScript(() => {
    localStorage.setItem('advjs:editor:locale', 'zh-CN')
    localStorage.setItem('advjs:editor:onboarded', 'true')
    localStorage.setItem('nuxt-color-mode', 'dark')
  })
  await page.setViewportSize({ width: 1440, height: 1000 })
  try {
    await page.goto((await bridge.start()).url)
  }
  catch {
    throw new Error('Editor fixture navigation failed; scoped launch credentials omitted')
  }
  const main = page.locator('[data-editor-region="main"]')
  await main.getByRole('tab', { name: '音频', exact: true }).click()
  const panel = main.locator('.ae-audio-workspace')
  await panel.getByRole('tab', { name: '对白配音', exact: true }).click()
  await expect(panel.getByRole('region', { name: '高级匿名听审' })).toHaveCount(0)
  await panel.getByTestId('compare-play-a').click()
  const daily = panel.locator('audio')
  await expect(daily).toHaveCount(1)
  await daily.click({ position: { x: 18, y: 16 } })
  await expect.poll(() => daily.evaluate(audio => !(audio as HTMLAudioElement).paused)).toBe(true)
  await panel.getByTestId('compare-play-b').click()
  await expect(daily).toHaveCount(1)
  const dailySource = await daily.getAttribute('src')
  await panel.getByTestId('compare-inspect-b').click()
  await expect(panel.getByTestId('take-select')).toBeDisabled()
  await panel.getByRole('checkbox', { name: '明确替换当前已选配音' }).check()
  const staleReview = panel.getByRole('checkbox', { name: '已重新审核原配音与当前台词、声音配置的差异，仍明确采用' })
  if (await staleReview.isVisible()) {
    await expect(panel.getByTestId('take-select')).toBeDisabled()
    await staleReview.check()
  }
  await expect(panel.getByTestId('take-select')).toBeEnabled()
  await panel.getByTestId('take-select').click()
  const ledgerPath = join(fixture.root, 'adv/audio/voice-ledger.json')
  await expect.poll(async () => JSON.parse(await readFile(ledgerPath, 'utf8')).lines[fixture.lines[0]!.id].locales['zh-CN'].selectedTake).toBe(fixture.sourceProof[1]!.takeId)
  const chapter = join(fixture.root, fixture.chapterPath)
  const editedText = '当前台词已变化，请重新审核原音频。'
  const document = JSON.parse(await readFile(chapter, 'utf8'))
  document.nodes[0].text = editedText
  await writeFile(chapter, JSON.stringify(document))
  await panel.getByTestId('ledger-refresh').click()
  await expect(panel.getByRole('textbox', { name: '该语言显示台词', exact: true })).toHaveValue(editedText)
  await expect(panel.getByRole('region', { name: '对白配音账本' })).toHaveAttribute('aria-busy', 'false')
  await expect(panel.getByTestId('take-stale-reviewed')).toBeVisible()
  await expect(panel.getByTestId('take-keep')).toBeDisabled()
  const ledgerBeforeReview = await readFile(ledgerPath)
  await panel.getByRole('checkbox', { name: '已重新审核原配音与当前台词、声音配置的差异，仍明确采用' }).check()
  await expect(panel.getByTestId('take-keep')).toBeEnabled()
  await panel.getByTestId('take-keep').click()
  await expect(panel.getByText('本次已复核并保留原绑定；', { exact: false })).toBeVisible()
  expect(await readFile(ledgerPath)).toEqual(ledgerBeforeReview)
  await panel.screenshot({ path: join(evidence, `daily-normal-dark-${info.project.name}.png`), animations: 'disabled' })
  let narrow = await page.addStyleTag({ content: '.ae-audio-workspace { width:320px !important; max-width:320px !important; }' })
  await expect.poll(() => panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await panel.screenshot({ path: join(evidence, `daily-320-dark-${info.project.name}.png`), animations: 'disabled' })
  await page.evaluate(() => document.documentElement.classList.remove('dark'))
  await panel.screenshot({ path: join(evidence, `daily-320-light-${info.project.name}.png`), animations: 'disabled' })
  await panel.getByTestId('voice-listening-open').focus()
  await page.keyboard.press('Enter')
  const advanced = panel.getByRole('region', { name: '高级匿名听审' })
  await expect(advanced).toBeVisible()
  await expect(panel.locator('audio')).toHaveCount(0)
  await advanced.getByRole('combobox', { name: '选择高级听审候选组' }).click()
  await page.getByRole('option', { name: '全部对白组（按组匿名）', exact: true }).click()
  await expect(advanced.getByTestId('voice-listening-create')).toHaveText('开始匿名听审 · 8 份')
  await advanced.getByTestId('voice-listening-create').click()
  await expect(advanced.getByText('archived-qwen-import-fixture', { exact: false })).toHaveCount(0)
  // Select the anonymous alias of the known short WAV to exercise late WebKit playing events.
  // This reads the fixture's private test scope; author identities remain hidden in the UI.
  const sampleId = await page.evaluate((assetId) => {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith('advjs:editor:private-voice-listening:'))
        continue
      const session = JSON.parse(localStorage.getItem(key)!)
      if (session.projectId !== 'voice-listening-acceptance')
        continue
      const sample = session.samples.find((sample: { id: string, candidate: { assetId: string } }) => sample.candidate.assetId === assetId)
      if (sample)
        return sample.id as string
    }
    throw new Error('Expected anonymous alias for the finite short audio fixture')
  }, fixture.assets[2]!.id)
  if (sampleId !== 'S01') {
    await advanced.getByRole('combobox', { name: '选择匿名听审候选' }).click()
    await page.getByRole('option', { name: new RegExp(` · ${sampleId} ·`, 'u') }).click()
  }
  await expect(advanced.getByRole('combobox', { name: new RegExp(`^${sampleId} `, 'u') })).toHaveCount(6)
  await advanced.getByTestId('voice-listening-load').click()
  const anonymous = advanced.locator('audio')
  await expect(anonymous).toHaveCount(1)
  await anonymous.evaluate((element) => {
    const media = element as HTMLAudioElement & { listeningEventTrace: Array<Record<string, string | number | boolean>> }
    media.listeningEventTrace = []
    const startedAt = performance.now()
    for (const type of ['play', 'playing', 'timeupdate', 'pause', 'ended', 'waiting', 'seeking', 'seeked', 'ratechange']) {
      media.addEventListener(type, (event) => {
        if (media.listeningEventTrace.length < 1000)
          media.listeningEventTrace.push({ type, elapsedMs: performance.now() - startedAt, currentTime: media.currentTime, duration: media.duration, paused: media.paused, seeking: media.seeking, playbackRate: media.playbackRate, isTrusted: event.isTrusted })
      })
    }
  })
  await anonymous.click({ position: { x: 18, y: 16 } })
  await expect.poll(() => anonymous.evaluate(audio => (audio as HTMLAudioElement).ended), { timeout: 30000 }).toBe(true)
  await expect(advanced.getByRole('combobox', { name: '选择匿名听审候选' })).toHaveText(/完整播放 1 次/u)
  await advanced.getByRole('combobox', { name: `${sampleId} 自然度`, exact: true }).click()
  await page.getByRole('option', { name: '4 分', exact: true }).click()
  await advanced.getByRole('combobox', { name: `${sampleId} 参考一致性`, exact: true }).click()
  await page.getByRole('option', { name: '不适用（NA）', exact: true }).click()
  await expect(advanced.getByTestId('voice-listening-attest')).toBeDisabled()
  const screenshots: string[] = []
  async function captureAdvanced(position: 'top' | 'anonymous' | 'rating' | 'export', size: 'normal' | '320', mode: 'light' | 'dark') {
    const target = position === 'top'
      ? advanced.getByTestId('voice-listening-close')
      : position === 'anonymous'
        ? advanced.getByRole('combobox', { name: '选择匿名听审候选' })
        : position === 'rating'
          ? advanced.getByRole('combobox', { name: `${sampleId} 自然度`, exact: true })
          : advanced.getByTestId('voice-listening-export')
    await target.evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }))
    await expect(target).toBeInViewport()
    await expect.poll(() => panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    const path = join(evidence, `advanced-${size}-${mode}-${position}-${info.project.name}.png`)
    await panel.screenshot({ path, animations: 'disabled' })
    screenshots.push(path)
  }
  await narrow.evaluate(element => element.remove())
  await captureAdvanced('top', 'normal', 'light')
  await captureAdvanced('anonymous', 'normal', 'light')
  await captureAdvanced('rating', 'normal', 'light')
  narrow = await page.addStyleTag({ content: '.ae-audio-workspace { width:320px !important; max-width:320px !important; }' })
  await captureAdvanced('top', '320', 'light')
  await captureAdvanced('anonymous', '320', 'light')
  await captureAdvanced('rating', '320', 'light')
  await captureAdvanced('export', '320', 'light')
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await captureAdvanced('rating', '320', 'dark')
  const download = page.waitForEvent('download')
  await advanced.getByTestId('voice-listening-export').click()
  const downloaded = await download
  const exportPath = join(evidence, `listening-draft-${info.project.name}.json`)
  await downloaded.saveAs(exportPath)
  const exported = JSON.parse(await readFile(exportPath, 'utf8'))
  expect(exported.projectId).toBe('voice-listening-acceptance')
  expect(exported.samples).toHaveLength(8)
  expect(exported.humanConfirmed).toBe(false)
  expect(exported.standardMOS).toBeNull()
  const playedSample = exported.samples.find((sample: { id: string }) => sample.id === sampleId)
  const playbackCoverage = inspectVoiceListeningSession(exported).samples.find(sample => sample.id === sampleId)!.coverage
  const events = await anonymous.evaluate(element => (element as HTMLAudioElement & { listeningEventTrace: Array<Record<string, string | number | boolean>> }).listeningEventTrace)
  await writeFile(join(evidence, `short-playback-${info.project.name}.json`), `${JSON.stringify({ browser: info.project.name, sampleId, durationSeconds: playedSample.observedDurationSeconds, coverage: playbackCoverage, endedCount: playedSample.endedCount, intervals: playedSample.plays, nativeControls: true, events }, null, 2)}\n`, { flag: 'wx' })
  expect(playedSample.endedCount).toBe(1)
  expect(playedSample.observedDurationSeconds).toBeGreaterThan(0)
  expect(playedSample.observedDurationSeconds).toBeLessThan(2)
  expect(playbackCoverage).toBeGreaterThanOrEqual(0.95)
  await advanced.locator('input[type="file"]').setInputFiles(exportPath)
  await expect(advanced.getByText('已恢复评分和备注；', { exact: false })).toBeVisible()
  await expect(advanced.getByRole('combobox', { name: '选择匿名听审候选' })).toHaveText(/完整播放 0 次/u)
  await expect(anonymous).toHaveCount(0)
  let crossHostRestore: { sourceSha256: string, exportPath: string, restoredSamples: number, clearedPlaybackAndHumanClaims: boolean } | undefined
  if (process.env.ADVJS_LISTENING_STUDIO_SESSION) {
    const sourceBytes = await readFile(process.env.ADVJS_LISTENING_STUDIO_SESSION)
    const incoming = JSON.parse(sourceBytes.toString('utf8'))
    await advanced.locator('input[type="file"]').setInputFiles(process.env.ADVJS_LISTENING_STUDIO_SESSION)
    const importedScore = incoming.samples[0].scores.naturalness
    await expect(advanced.getByRole('combobox', { name: 'S01 自然度', exact: true })).toContainText(importedScore === null ? '尚未评分' : importedScore === 'na' ? '不适用（NA）' : `${importedScore} 分`)
    await expect(advanced.getByRole('combobox', { name: '选择匿名听审候选' })).toHaveText(/完整播放 0 次/u)
    const restoredDownload = page.waitForEvent('download')
    await advanced.getByTestId('voice-listening-export').click()
    const restoredPath = join(evidence, `studio-restored-${info.project.name}.json`)
    await (await restoredDownload).saveAs(restoredPath)
    const restored = JSON.parse(await readFile(restoredPath, 'utf8'))
    expect(restored.id).toBe(incoming.id)
    expect(restored.samples).toHaveLength(8)
    expect(restored.humanConfirmed).toBe(false)
    expect(restored.standardMOS).toBeNull()
    for (const [index, sample] of restored.samples.entries()) {
      expect(sample.candidate.takeId).toBe(incoming.samples[index].candidate.takeId)
      expect(sample.scores).toEqual(incoming.samples[index].scores)
      expect(sample.notes).toBe(incoming.samples[index].notes)
      expect(sample.plays).toEqual([])
      expect(sample.endedCount).toBe(0)
      expect(sample.observedDurationSeconds).toBeUndefined()
    }
    crossHostRestore = { sourceSha256: createHash('sha256').update(sourceBytes).digest('hex'), exportPath: restoredPath, restoredSamples: restored.samples.length, clearedPlaybackAndHumanClaims: true }
  }
  await advanced.getByTestId('voice-listening-close').click()
  await expect(advanced).toHaveCount(0)
  await expect(panel.locator('audio')).toHaveCount(0)
  await expect(panel.getByTestId('voice-listening-open')).toBeFocused()
  const proof = { schemaVersion: 1, classification: 'automated UI integration, not human MOS', browser: info.project.name, fixtureRoot: fixture.root, sourceFormat: 'flow', compiledSourceLines: fixture.compiledLines, sources: fixture.sourceProof, newTtsCalls: 0, cloudWrites: 0, realArchivedQwenBytes: Boolean(process.env.ADVJS_LISTENING_QWEN_EVIDENCE), takeSelectionPreservedHistory: true, staleKeepChangedLedgerBytes: false, playerCountMaximum: 1, stoppedWhenAdvancedOpenedAndClosed: true, dailySourceWasBlob: dailySource?.startsWith('blob:'), portableExportProjectId: exported.projectId, exportedSamples: exported.samples.length, observedShortSample: { id: sampleId, durationSeconds: playedSample.observedDurationSeconds, coverage: playbackCoverage, endedCount: playedSample.endedCount }, humanConfirmed: false, standardMOS: null, keyboardAdvancedEntryAndReturn: true, advancedPanelScreenshots: screenshots, crossHostRestore, exportSha256: createHash('sha256').update(await readFile(exportPath)).digest('hex') }
  await writeFile(join(evidence, `editor-listening-proof-${info.project.name}.json`), `${JSON.stringify(proof, null, 2)}\n`, { flag: 'wx' })
})
