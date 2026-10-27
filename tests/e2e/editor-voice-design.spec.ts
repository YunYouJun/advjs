import type { Page } from '@playwright/test'
import type { EditorBridge } from 'advjs/node'
import type { AdvContext } from '../../packages/client/types/context'
import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { expect, test } from '@playwright/test'
import { createEditorBridge } from 'advjs/node'
import { createEditorVoiceDesignFixture } from '../fixtures/audio/editor-voice-design'
import { editorJobLineIds } from '../fixtures/audio/editor-voice-jobs'

const repositoryRoot = resolve(import.meta.dirname, '../..')
let fixture: Awaited<ReturnType<typeof createEditorVoiceDesignFixture>>
let bridge: EditorBridge
let editorUrl: string

async function openEditor(page: Page) {
  try {
    await page.goto(editorUrl)
  }
  catch {
    throw new Error('Editor fixture navigation failed; scoped launch credentials omitted')
  }
}

async function choose(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

test.beforeEach(async ({ page }) => {
  fixture = await createEditorVoiceDesignFixture()
  bridge = await createEditorBridge({ host: '127.0.0.1', port: 0, projectRoot: fixture.root, publicRoot: join(repositoryRoot, 'editor/core/dist'), audioJobs: { config: fixture.config, storeDirectory: fixture.storeDirectory } })
  editorUrl = (await bridge.start()).url
  await page.addInitScript(() => {
    localStorage.setItem('advjs:editor:locale', 'zh-CN')
    localStorage.setItem('advjs:editor:onboarded', 'true')
    localStorage.setItem('nuxt-color-mode', 'dark')
  })
  await page.setViewportSize({ width: 1440, height: 1000 })
})
test.afterEach(async () => {
  await bridge?.stop()
  await rm(fixture.directory, { recursive: true, force: true })
})

test('production Editor designs immutable voices, auditions native candidates and explicitly applies a reviewed sample', async ({ page }, info) => {
  await openEditor(page)
  const main = page.locator('[data-editor-region="main"]')
  await main.getByRole('tab', { name: '音频', exact: true }).click()
  const panel = main.locator('.ae-audio-workspace')
  await panel.getByRole('tab', { name: '音色设计', exact: true }).click()
  const design = panel.getByRole('region', { name: '音色设计', exact: true })
  await expect(design.getByTestId('design-new')).toBeEnabled()
  expect(fixture.calls).toHaveLength(0)
  await design.getByTestId('design-new').click()
  await choose(page, '设计角色／旁白', 'Hero')
  await design.getByLabel('音色名称', { exact: true }).fill('Hero 温暖音色')
  await design.getByLabel('说话风格', { exact: true }).fill('清晰温暖')
  await choose(page, 'zh-CN fixture-tts 音色来源', '描述设计')
  await design.getByLabel('音色描述', { exact: true }).fill('清晰、温暖、自然的原创声音')
  await design.getByTestId('design-save').click()
  await expect(design.getByTestId('design-new-version')).toBeEnabled()
  expect(fixture.calls).toHaveLength(0)
  const saved = JSON.parse(await readFile(join(fixture.root, 'authoring/voices/library.json'), 'utf8'))
  const voiceId = saved.voices[0].id
  expect(saved.voices[0].design.locales['zh-CN'].providers['fixture-tts'].source).toBe('designed')
  await design.getByRole('checkbox', { name: '当前费用无法估算；我允许在字符预算内生成试听', exact: true }).check()
  await design.getByTestId('design-plan').click()
  await expect(design.getByTestId('design-review')).toBeVisible()
  await expect(design.getByTestId('design-execute')).toBeDisabled()
  expect(fixture.calls).toHaveLength(0)
  await design.getByRole('checkbox', { name: '我已核对音色、语言、试听文本与预算', exact: true }).check()
  await design.getByTestId('design-execute').click()
  await expect(design.getByTestId('design-preview-ready')).toBeVisible()
  expect(fixture.calls).toHaveLength(1)
  await expect(design.getByTestId('design-apply')).toBeDisabled()
  await design.getByTestId('design-audition').click()
  const audio = design.locator('audio[aria-label="音色候选试听"]')
  const player = design.getByRole('group', { name: '音色候选试听播放控制', exact: true })
  await expect(player).toBeVisible()
  await expect.poll(() => player.locator('.agui-tag__label').evaluate(element => getComputedStyle(element).fontFamily)).toMatch(/^system-ui/)
  await expect(audio).toBeAttached()
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.readyState >= 2 && Number.isFinite(element.duration))).toBe(true)
  const signal = await audio.evaluate(async (element: HTMLAudioElement) => {
    const context = new AudioContext()
    const buffer = await context.decodeAudioData(await (await fetch(element.src)).arrayBuffer())
    const samples = buffer.getChannelData(0)
    const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length)
    await context.close()
    return { duration: buffer.duration, rms }
  })
  expect(signal.duration).toBeCloseTo(1, 2)
  expect(signal.rms).toBeGreaterThan(0.1)
  const directory = process.env.ADVJS_AUDIO_SCREENSHOTS || join(tmpdir(), 'advjs-editor-audio-artifacts')
  await mkdir(directory, { recursive: true })
  await panel.screenshot({ path: join(directory, `voice-design-normal-${info.project.name}.png`), animations: 'disabled' })
  const narrow = await page.addStyleTag({ content: '.ae-audio-workspace { width: 320px !important; max-width: 320px !important; }' })
  await expect.poll(() => panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  const volumeTrack = player.locator('.ae-player-volume .agui-slider-track')
  await expect(volumeTrack).toBeVisible()
  expect((await volumeTrack.boundingBox())!.width).toBeGreaterThanOrEqual(96)
  await panel.screenshot({ path: join(directory, `voice-design-narrow-${info.project.name}.png`), animations: 'disabled' })
  await narrow.evaluate(element => element.remove())
  await design.getByTestId('design-stop-audition').click()
  await expect(audio).toHaveCount(0)
  await design.getByTestId('design-register').click()
  await expect(design.getByTestId('design-preview-registered')).toBeVisible()
  await expect(design.getByTestId('design-apply')).toBeDisabled()
  const sample = design.getByTestId('design-sample')
  await expect(sample).toContainText(fixture.calls[0]!.text!)
  await expect(sample).toContainText(fixture.sha256)
  await sample.getByTestId('design-audition-sample').click()
  await expect(design.getByRole('group', { name: '音色候选试听播放控制', exact: true })).toBeVisible()
  await expect(audio).toBeAttached()
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.readyState >= 2 && Number.isFinite(element.duration))).toBe(true)
  expect(fixture.calls).toHaveLength(1)
  await sample.screenshot({ path: join(directory, `voice-registered-sample-normal-${info.project.name}.png`), animations: 'disabled' })
  const sampleNarrow = await page.addStyleTag({ content: '.ae-audio-workspace { width: 320px !important; max-width: 320px !important; }' })
  await expect.poll(() => panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await sample.screenshot({ path: join(directory, `voice-registered-sample-narrow-${info.project.name}.png`), animations: 'disabled' })
  await sampleNarrow.evaluate(element => element.remove())
  await design.getByTestId('design-stop-audition').click()
  await design.getByTestId('design-select-sample').click()
  await expect(design.getByTestId('design-select-sample')).toBeDisabled()
  await expect(design.getByTestId('design-apply')).toBeDisabled()
  await design.getByRole('checkbox', { name: '我确认替换此语言／供应商的已有角色音色绑定', exact: true }).check()
  await design.getByTestId('design-apply').click()
  await expect.poll(async () => JSON.parse(await readFile(join(fixture.root, 'adv/settings/game.json'), 'utf8')).characters[0].voiceProfile.locales['zh-CN'].providers['fixture-tts'].projectVoiceId).toBe(voiceId)
  const game = JSON.parse(await readFile(join(fixture.root, 'adv/settings/game.json'), 'utf8'))
  expect(game.characters[0].voiceProfile.intent.speakingStyle).toBe('清晰温暖')
  expect(game.voiceProfile).toBeUndefined()
  await design.getByTestId('design-reload').click()
  await design.getByTestId('design-plan').click()
  await expect(design.getByTestId('design-review')).toBeVisible()
  await design.getByRole('checkbox', { name: '我已核对音色、语言、试听文本与预算', exact: true }).check()
  await design.getByTestId('design-execute').click()
  await expect(design.getByTestId('design-preview-registered')).toHaveCount(1)
  expect(fixture.calls).toHaveLength(1)
  await design.getByTestId('design-new-version').click()
  await design.getByLabel('音色描述', { exact: true }).fill('第二版轻快自然的声音')
  await design.getByTestId('design-save').click()
  await expect.poll(async () => JSON.parse(await readFile(join(fixture.root, 'authoring/voices/library.json'), 'utf8')).voices.length).toBe(2)
  const updated = JSON.parse(await readFile(join(fixture.root, 'authoring/voices/library.json'), 'utf8'))
  expect(updated.voices).toHaveLength(2)
  expect(updated.voices[1].id).not.toBe(voiceId)
  expect(updated.voices[1].design.supersedes).toEqual({ id: voiceId, version: '1' })
  expect(updated.voices[0].design.selectedSamples['zh-CN']['fixture-tts'].assetId).toBeTruthy()
  expect(fixture.calls).toHaveLength(1)
})

test('production Editor saves exact-language built-ins and authorized reference conditions without synthesizing', async ({ page }) => {
  await openEditor(page)
  const main = page.locator('[data-editor-region="main"]')
  await main.getByRole('tab', { name: '音频', exact: true }).click()
  const panel = main.locator('.ae-audio-workspace')
  await panel.getByRole('tab', { name: '音色设计', exact: true }).click()
  const design = panel.getByRole('region', { name: '音色设计', exact: true })
  await design.getByTestId('design-new').click()
  await choose(page, '设计角色／旁白', 'Hero')
  await choose(page, 'zh-CN fixture-tts 音色来源', '授权参考音色')
  await choose(page, 'zh-CN fixture-tts 已登记参考', '本地原创参考')
  await expect(design.getByTestId('design-save')).toBeDisabled()
  await design.getByLabel('参考文本', { exact: true }).fill('本地原创验收音频')
  await design.getByLabel('使用许可', { exact: true }).fill('original-test-license')
  await design.getByLabel('声音主体', { exact: true }).fill('original fixture')
  await design.getByLabel('项目同意文件', { exact: true }).fill('authoring/rights/original.json')
  await design.getByLabel('新增语言', { exact: true }).fill('en-US')
  await design.getByTestId('design-add-binding').click()
  await expect(design.getByRole('combobox', { name: 'en-US fixture-tts 内置音色', exact: true })).toContainText('本地验收内置音色')
  await design.getByTestId('design-save').click()
  await expect(design.getByTestId('design-new-version')).toBeEnabled()
  const voice = JSON.parse(await readFile(join(fixture.root, 'authoring/voices/library.json'), 'utf8')).voices[0]
  expect(voice.design.locales['zh-CN'].providers['fixture-tts']).toEqual({ preset: 'fixture', source: 'cloned', reference: { assetId: 'reference/original', sha256: fixture.sha256, mode: 'icl', text: '本地原创验收音频' }, rights: { license: 'original-test-license', subject: 'original fixture', consentRecord: 'authoring/rights/original.json' } })
  expect(voice.design.locales['en-US'].providers['fixture-tts']).toEqual({ preset: 'fixture', source: 'system', providerVoiceId: 'system:fixture' })
  expect(voice.implementations['fixture-tts'].localePresets['en-US'].presetPath).not.toBe(voice.implementations['fixture-tts'].localePresets['zh-CN'].presetPath)
  expect(voice.design.samples).toEqual([])
  expect(fixture.calls).toHaveLength(0)
})

test('character voice entry applies a reviewed design, generates only that actor and explicitly adopts the audible take for game preview', async ({ page }, info) => {
  test.setTimeout(60000)
  await page.addInitScript(() => {
    const NativeContext = window.AudioContext
    const graphs: Array<{ context: AudioContext, analyser: AnalyserNode, connected: boolean }> = []
    class ObservedContext extends NativeContext {
      constructor(options?: AudioContextOptions) {
        super(options)
        const analyser = this.createAnalyser()
        analyser.fftSize = 256
        const graph = { context: this, analyser, connected: false }
        graphs.push(graph)
        const createGain = this.createGain.bind(this)
        let first = true
        this.createGain = () => {
          const gain = createGain()
          if (first) {
            gain.connect(analyser)
            graph.connected = true
            first = false
          }
          return gain
        }
      }
    }
    window.AudioContext = ObservedContext
    Object.assign(window, { voiceWorkflowProbe: {
      state: () => graphs.find(graph => graph.connected && graph.context.state === 'running')?.context.state,
      energy: () => {
        return Math.max(0, ...graphs.filter(graph => graph.connected && graph.context.state === 'running').map(({ analyser }) => {
          const values = new Float32Array(analyser.fftSize)
          analyser.getFloatTimeDomainData(values)
          return Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length)
        }))
      },
    } })
  })
  await openEditor(page)
  const directory = process.env.ADVJS_AUDIO_SCREENSHOTS || info.outputPath('workflow-evidence')
  await mkdir(directory, { recursive: true })
  const navigation = page.locator('[data-editor-region="navigation"]')
  await navigation.getByRole('tab', { name: '人物', exact: true }).click()
  await navigation.locator('.ae-character-card').filter({ hasText: 'Hero' }).click()
  const inspector = page.locator('[data-editor-region="inspector"]')
  const entry = inspector.getByRole('region', { name: '角色音色与对白' })
  await expect(entry.getByTestId('character-applied-voice')).toContainText('system:fixture')
  await entry.screenshot({ path: join(directory, `workflow-entry-normal-${info.project.name}.png`), animations: 'disabled' })
  await entry.getByTestId('character-voice-design').click()
  const main = page.locator('[data-editor-region="main"]')
  const panel = main.locator('.ae-audio-workspace')
  const design = panel.getByRole('region', { name: '音色设计', exact: true })
  await expect(panel.getByRole('tab', { name: '音色设计', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(design.getByTestId('design-new')).toBeEnabled()
  await design.getByTestId('design-new').click()
  await expect(design.getByRole('combobox', { name: '设计角色／旁白', exact: true })).toContainText('Hero')
  await design.getByLabel('音色名称', { exact: true }).fill('Hero 工作流音色')
  await design.getByTestId('design-save').click()
  await expect(design.getByTestId('design-new-version')).toBeEnabled()
  await design.getByRole('checkbox', { name: '当前费用无法估算；我允许在字符预算内生成试听', exact: true }).check()
  await design.getByTestId('design-plan').click()
  await expect(design.getByTestId('design-review')).toBeVisible()
  await design.getByRole('checkbox', { name: '我已核对音色、语言、试听文本与预算', exact: true }).check()
  await design.getByTestId('design-execute').click()
  await expect(design.getByTestId('design-preview-ready')).toBeVisible()
  await design.getByTestId('design-audition').click()
  await expect(design.getByRole('group', { name: '音色候选试听播放控制', exact: true })).toBeVisible()
  await expect(design.locator('audio')).toBeAttached()
  await design.getByTestId('design-register').click()
  await expect(design.getByTestId('design-preview-registered')).toBeVisible()
  await design.getByTestId('design-select-sample').click()
  await expect(design.getByRole('status')).toHaveText('音色样本已审核选用；角色和对白绑定尚未修改。')
  await expect(design).toHaveAttribute('aria-busy', 'false')
  await expect.poll(async () => {
    const saved = JSON.parse(await readFile(join(fixture.root, 'authoring/voices/library.json'), 'utf8'))
    return saved.voices[0].design.selectedSamples['zh-CN']?.['fixture-tts']?.sha256
  }).toBe(fixture.sha256)
  await expect(design.getByTestId('design-select-sample')).toBeDisabled()
  await expect(design.getByTestId('design-apply')).toBeDisabled()
  const reviewedLibrary = JSON.parse(await readFile(join(fixture.root, 'authoring/voices/library.json'), 'utf8'))
  const reviewedSelections = reviewedLibrary.voices.map((voice: { id: string, selectedSample?: unknown }) => ({ id: voice.id, selectedSample: voice.selectedSample }))
  await design.getByRole('checkbox', { name: '我确认替换此语言／供应商的已有角色音色绑定', exact: true }).check()
  await design.getByTestId('design-apply').click()
  await expect(entry.getByTestId('character-applied-voice')).toContainText(' / 1')
  expect(fixture.calls).toHaveLength(1)
  const game = JSON.parse(await readFile(join(fixture.root, 'adv/settings/game.json'), 'utf8'))
  const applied = game.characters[0].voiceProfile.locales['zh-CN'].providers['fixture-tts']
  expect(applied.projectVoiceId).toBeTruthy()
  const library = JSON.parse(await readFile(join(fixture.root, 'authoring/voices/library.json'), 'utf8'))
  expect(library.voices.map((voice: { id: string, selectedSample?: unknown }) => ({ id: voice.id, selectedSample: voice.selectedSample }))).toEqual(reviewedSelections)
  expect(library.voices[0].design.selectedSamples['zh-CN']['fixture-tts'].assetId).toBeTruthy()
  await entry.getByTestId('character-voice-jobs').click()
  const jobs = panel.getByRole('region', { name: '配音生成任务', exact: true })
  await expect(jobs.locator('[data-line-id]')).toHaveCount(1)
  await expect(jobs.locator(`[data-line-id="${editorJobLineIds[0]}"]`)).toBeVisible()
  await jobs.getByTestId('jobs-select-all').click()
  await jobs.getByRole('checkbox', { name: '我同意费用无法估算，按上述字符预算执行', exact: true }).check()
  await jobs.getByTestId('jobs-plan').click()
  await expect(jobs.getByTestId('jobs-plan-review')).toContainText('1 句')
  await jobs.getByRole('checkbox', { name: '我已审核范围、语言与预算；生成不会替换已选配音', exact: true }).check()
  await jobs.getByTestId('jobs-enqueue').click()
  await expect(jobs.locator('[data-task-status="queued"]')).toHaveCount(1)
  await jobs.getByTestId('jobs-run').click()
  await expect(jobs.locator('[data-task-status="committed"]')).toHaveCount(1)
  expect(fixture.calls).toHaveLength(2)
  const ledgerPath = join(fixture.root, 'adv/audio/voice-ledger.json')
  const unselected = JSON.parse(await readFile(ledgerPath, 'utf8'))
  expect(Object.keys(unselected.lines)).toEqual([editorJobLineIds[0]])
  const generated = unselected.lines[editorJobLineIds[0]!].locales['zh-CN'].takes[0]
  expect(unselected.lines[editorJobLineIds[0]!].locales['zh-CN'].selectedTake).toBeNull()
  expect(generated.projectVoiceId).toBe(applied.projectVoiceId)
  await entry.getByTestId('character-voice-takes').click()
  const ledger = panel.getByRole('region', { name: '对白配音账本', exact: true })
  await expect(ledger.getByTestId('take-preview')).toBeEnabled()
  await ledger.getByTestId('take-preview').click()
  const audio = ledger.locator('audio')
  await expect(ledger.getByRole('group', { name: '对白配音试听播放控制', exact: true })).toBeVisible()
  await expect(audio).toBeAttached()
  await ledger.getByRole('button', { name: '播放对白配音试听', exact: true }).click()
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime > 0)).toBe(true)
  const signal = await audio.evaluate(async (element: HTMLAudioElement) => {
    const bytes = await (await fetch(element.src)).arrayBuffer()
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('')
    const context = new AudioContext()
    const buffer = await context.decodeAudioData(bytes)
    const samples = buffer.getChannelData(0)
    const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length)
    await context.close()
    return { hash, rms, duration: buffer.duration }
  })
  expect(signal.hash).toBe(generated.sha256)
  expect(signal.rms).toBeGreaterThan(0.1)
  await expect(ledger.getByTestId('take-select')).toBeEnabled()
  await ledger.getByTestId('take-select').click()
  await expect.poll(async () => JSON.parse(await readFile(ledgerPath, 'utf8')).lines[editorJobLineIds[0]!].locales['zh-CN'].selectedTake).toBe(generated.id)
  await panel.screenshot({ path: join(directory, `workflow-take-normal-${info.project.name}.png`), animations: 'disabled' })
  const narrow = await page.addStyleTag({ content: '.ae-audio-workspace { width:320px !important; max-width:320px !important; }' })
  await expect.poll(() => panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await panel.screenshot({ path: join(directory, `workflow-take-320-${info.project.name}.png`), animations: 'disabled' })
  await narrow.evaluate(element => element.remove())
  await panel.getByRole('button', { name: '游戏预览', exact: true }).click()
  const start = main.getByRole('button', { name: '启动项目预览', exact: true })
  if (await start.isVisible())
    await start.click()
  await expect(main.locator('.adv-dialog-box:visible')).toContainText('你好，世界。')
  let played: { rms: number, context?: string, playing: boolean } | undefined
  try {
    await expect.poll(async () => {
      played = await page.evaluate((assetId) => {
        const root = document.getElementById('__nuxt') as HTMLElement & { __vue_app__: { _context: { provides: Record<string, AdvContext> } } }
        const adv = root.__vue_app__._context.provides['$advjs-context']!
        const probe = (window as unknown as { voiceWorkflowProbe: { state: () => string, energy: () => number } }).voiceWorkflowProbe
        return { rms: probe.energy(), context: probe.state(), playing: adv.$audio.inspect().tracks.some(track => track.bus === 'voice' && track.assetId === assetId && track.status === 'playing') }
      }, generated.assetId)
      return played.playing && played.context === 'running' && played.rms > 0.0001
    }).toBe(true)
  }
  catch (error) {
    await writeFile(join(directory, `workflow-playback-failure-${info.project.name}.json`), `${JSON.stringify({ played, audio: await page.evaluate(() => {
      const root = document.getElementById('__nuxt') as HTMLElement & { __vue_app__: { _context: { provides: Record<string, AdvContext> } } }
      return root.__vue_app__._context.provides['$advjs-context']!.$audio.inspect()
    }) }, null, 2)}\n`, { flag: 'wx' })
    throw error
  }
  const runtime = await page.evaluate(() => {
    const root = document.getElementById('__nuxt') as HTMLElement & { __vue_app__: { _context: { provides: Record<string, AdvContext> } } }
    const adv = root.__vue_app__._context.provides['$advjs-context']!
    return { current: adv.store.current, audio: adv.$audio.inspect(), ledger: adv.gameConfig.value.audio?.voiceLedger, assetIds: Object.keys(adv.gameConfig.value.audio?.assets ?? {}), diagnostics: adv.compileDiagnostics.value }
  })
  expect(runtime.diagnostics).toEqual([])
  expect(runtime.ledger?.lines[editorJobLineIds[0]!]?.locales['zh-CN']?.selectedTake).toBe(generated.id)
  expect(runtime.assetIds).toEqual([generated.assetId])
  expect(runtime.audio.errors).toEqual([])
  await main.screenshot({ path: join(directory, `workflow-game-${info.project.name}.png`), animations: 'disabled' })
  const catalog = JSON.parse(await readFile(join(fixture.root, 'adv/assets.json'), 'utf8'))
  const selectedAsset = catalog.assets.find((asset: { id: string }) => asset.id === generated.assetId)
  const selectedBytes = await readFile(join(fixture.root, catalog.profiles.local.root, selectedAsset.path))
  expect(createHash('sha256').update(selectedBytes).digest('hex')).toBe(generated.sha256)
  await writeFile(join(directory, `workflow-selected-${info.project.name}.wav`), selectedBytes, { flag: 'wx' })
  await writeFile(join(directory, `workflow-proof-${info.project.name}.json`), `${JSON.stringify({ schemaVersion: 1, classification: 'fake provider UI integration, original audible PCM; no real TTS', browser: info.project.name, projectVoiceId: applied.projectVoiceId, version: applied.projectVoiceVersion, locale: 'zh-CN', speakerId: 'hero', lineId: editorJobLineIds[0], takeId: generated.id, assetId: generated.assetId, sha256: generated.sha256, candidateCalls: fixture.calls.length, newRealModelCalls: 0, cloudWrites: 0, signal, gamePlayback: played, additionalUnlockGesture: false, generatedUnselectedUntilReviewed: true, runtime, ledgerSha256: createHash('sha256').update(await readFile(ledgerPath)).digest('hex') }, null, 2)}\n`, { flag: 'wx' })
})
