import type { VoiceDesignSample, VoiceTake } from '@advjs/types'
import type { Locator, Page } from '@playwright/test'
import type { EditorBridge } from 'advjs/node'
import type { AdvContext } from '../../packages/client/types/context'
import { createHash } from 'node:crypto'
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { audioProjectMediaPath } from '@advjs/audio'
import { expect, test, webkit } from '@playwright/test'
import { advBuild, createEditorBridge, loadProject } from 'advjs/node'
import { createEditorRealQwenFixture, realQwenChapterPath, realQwenConsentPath, realQwenDialogue, realQwenLineId, realQwenModel, realQwenModelRevision, realQwenPreviewText, realQwenPrivateMarker, serveRealQwenPlayer } from '../fixtures/audio/editor-real-qwen'

// Normal CI discovers but never prepares or invokes a model. The separate opt-in
// configuration has one worker, no retries and a coordinated persistent root.
test.skip(process.env.ADVJS_REAL_QWEN !== '1', 'Real Qwen acceptance is explicitly opt-in')
let fixture: Awaited<ReturnType<typeof createEditorRealQwenFixture>>
let bridge: EditorBridge
let playerServer: Awaited<ReturnType<typeof serveRealQwenPlayer>> | undefined
const repositoryRoot = resolve(import.meta.dirname, '../..')
const synthesisTimeout = 12 * 60_000

async function choose(page: Page, target: Locator, value: string) {
  await target.click()
  await page.getByRole('option', { name: value, exact: true }).click()
}
async function selectNode(page: Page, panel: Locator, id: string) {
  await panel.getByRole('combobox', { name: '选中节点', exact: true }).click()
  await page.getByRole('option').filter({ hasText: new RegExp(` · ${id}$`, 'u') }).click()
}
async function snapshot(panel: Locator, page: Page, name: string) {
  await panel.screenshot({ path: join(fixture.artifactRoot, `${name}-normal.png`), animations: 'disabled' })
  const style = await page.addStyleTag({ content: '.ae-audio-workspace, .native-flow-editor { width: 320px !important; max-width: 320px !important; }' })
  await expect.poll(() => panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await panel.screenshot({ path: join(fixture.artifactRoot, `${name}-320.png`), animations: 'disabled' })
  await style.evaluate(element => (element as HTMLElement).remove())
}
async function measureAudio(audio: Locator) {
  await expect.poll(() => audio.evaluate(element => (element as HTMLAudioElement).readyState)).toBeGreaterThanOrEqual(2)
  return audio.evaluate(async (element) => {
    const player = element as HTMLAudioElement
    const bytes = await (await fetch(player.src)).arrayBuffer()
    const hash = await crypto.subtle.digest('SHA-256', bytes)
    const context = new AudioContext()
    const decoded = await context.decodeAudioData(bytes.slice(0))
    const samples = decoded.getChannelData(0)
    let squared = 0
    let peak = 0
    let voiced = 0
    for (const sample of samples) {
      squared += sample * sample
      peak = Math.max(peak, Math.abs(sample))
      if (Math.abs(sample) > 0.001)
        voiced++
    }
    const result = { sha256: Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join(''), bytes: bytes.byteLength, duration: decoded.duration, sampleRate: decoded.sampleRate, rms: Math.sqrt(squared / samples.length), peak, voicedFraction: voiced / samples.length, playing: !player.paused }
    await context.close()
    return result
  })
}
async function installPlayerProbe(page: Page) {
  await page.addInitScript(() => {
    const NativeContext = window.AudioContext
    let analyser: AnalyserNode | undefined
    const media: HTMLMediaElement[] = []
    const probe = { buffers: 0, media: () => media.map(element => element.currentSrc || element.src), energy() {
      const samples = new Float32Array(analyser?.fftSize ?? 256)
      analyser?.getFloatTimeDomainData(samples)
      return Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length)
    } }
    class ObservedContext extends NativeContext {
      constructor(options?: AudioContextOptions) {
        super(options)
        analyser = this.createAnalyser()
        analyser.fftSize = 256
        const createGain = this.createGain.bind(this)
        let master = true
        this.createGain = () => {
          const node = createGain()
          if (master) {
            node.connect(analyser!)
            master = false
          }
          return node
        }
        const createMedia = this.createMediaElementSource.bind(this)
        this.createMediaElementSource = (element) => {
          media.push(element)
          return createMedia(element)
        }
        const createBuffer = this.createBufferSource.bind(this)
        this.createBufferSource = () => {
          probe.buffers++
          return createBuffer()
        }
      }
    }
    window.AudioContext = ObservedContext
    Object.assign(window, { realQwenAudioProbe: probe })
  })
}
async function playerState(page: Page) {
  return page.evaluate(() => {
    const app = (document.querySelector('#app') as unknown as { __vue_app__: { _context: { provides: Record<string, AdvContext> } } }).__vue_app__
    const adv = app._context.provides['$advjs-context']
    const probe = (window as unknown as { realQwenAudioProbe: { energy: () => number, media: () => string[], buffers: number } }).realQwenAudioProbe
    return { current: adv.store.current, audio: adv.$audio.inspect(), diagnostics: adv.compileDiagnostics.value, runtime: JSON.parse(JSON.stringify({ game: adv.gameConfig.value, program: adv.runtime.program.value })), rms: probe.energy(), media: probe.media(), buffers: probe.buffers }
  })
}

test.afterAll(async () => {
  await bridge?.stop()
  await playerServer?.close()
  if (fixture)
    await writeFile(join(fixture.artifactRoot, 'provider-calls.json'), `${JSON.stringify(fixture.calls, null, 2)}\n`)
  // Keep the coordinated environment/cache, immutable real media and all evidence.
})

test('real Qwen designs and reference conditions a voice through Editor, native Flow and the built player', async ({ page, context }) => {
  fixture = await createEditorRealQwenFixture()
  await mkdir(fixture.artifactRoot, { recursive: true })
  bridge = await createEditorBridge({ host: '127.0.0.1', port: 0, projectRoot: fixture.root, publicRoot: join(repositoryRoot, 'editor/core/dist'), audioJobs: { config: fixture.config, storeDirectory: fixture.storeDirectory } })
  const editorUrl = (await bridge.start()).url
  await page.addInitScript(() => {
    localStorage.setItem('advjs:editor:locale', 'zh-CN')
    localStorage.setItem('advjs:editor:onboarded', 'true')
    localStorage.setItem('nuxt-color-mode', 'dark')
  })
  await page.setViewportSize({ width: 1440, height: 1000 })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(editorUrl)
  const main = page.locator('[data-editor-region="main"]')
  await main.getByRole('tab', { name: '音频', exact: true }).click()
  const audioPanel = main.locator('.ae-audio-workspace')
  await audioPanel.getByRole('tab', { name: '音色设计', exact: true }).click()
  const design = audioPanel.getByRole('region', { name: '音色设计', exact: true })
  const runId = Date.now()
  const previewProofs: Array<{ source: 'designed' | 'cloned', id: string, model: string, measured: Awaited<ReturnType<typeof measureAudio>>, sample: VoiceDesignSample }> = []
  const takes: VoiceTake[] = []
  let reference: { assetId: string, sha256: string, text: string, title: string }
  async function checkpoint(stage: string) {
    await writeFile(join(fixture.artifactRoot, 'editor-real-qwen-checkpoint.json'), `${JSON.stringify({ stage, root: fixture.root, offline: true, calls: fixture.calls, previewProofs, takes, reference }, null, 2)}\n`)
  }
  async function recoveredAudio(index: number) {
    const candidate = fixture.calls[index]!.candidates[0]!
    const bytes = await readFile(join(fixture.root, candidate.path))
    await page.evaluate((base64) => {
      const audio = document.createElement('audio')
      audio.dataset.recoveredQwen = ''
      audio.preload = 'auto'
      audio.src = `data:audio/wav;base64,${base64}`
      document.body.append(audio)
    }, bytes.toString('base64'))
    const audio = page.locator('audio[data-recovered-qwen]')
    const measured = await measureAudio(audio)
    expect(measured.sha256).toBe(candidate.sha256)
    expect(measured.rms).toBeGreaterThan(0.0001)
    await audio.evaluate(element => element.remove())
    return measured
  }
  if (fixture.resume) {
    const library = JSON.parse(await readFile(join(fixture.root, 'authoring/voices/library.json'), 'utf8'))
    const binding = JSON.parse(await readFile(join(fixture.root, 'adv/audio/voice-ledger.json'), 'utf8')).lines[realQwenLineId].locales['zh-CN']
    expect(binding.takes).toHaveLength(2)
    expect([binding.takes[0].id, binding.takes[1].id]).toContain(binding.selectedTake)
    takes.push(binding.takes[0])
    for (const [index, source] of [[0, 'designed'], [2, 'cloned']] as const) {
      const voice = library.voices.find((voice: any) => voice.design?.samples.some((sample: any) => sample.sha256 === fixture.calls[index]!.candidates[0]!.sha256))
      expect(voice).toBeTruthy()
      previewProofs.push({ source, id: voice.id, model: fixture.calls[index]!.candidates[0]!.model!, measured: await recoveredAudio(index), sample: voice.design.samples[0] })
      if (source === 'cloned') {
        const definition = voice.design.locales['zh-CN'].providers['qwen-tts']
        reference = { ...definition.reference, text: realQwenPreviewText, title: 'Recovered original designed reference' }
      }
    }
  }

  async function createAndApply(source: 'designed' | 'cloned') {
    const model = source === 'designed' ? realQwenModel : fixture.baseModel
    const id = `editor-real-${source}-${runId}`
    await expect(design.getByTestId('design-new')).toBeEnabled()
    await design.getByTestId('design-new').click()
    await choose(page, design.getByRole('combobox', { name: '设计角色／旁白', exact: true }), 'Hero')
    await design.getByLabel('音色 ID', { exact: true }).fill(id)
    await design.getByLabel('音色名称', { exact: true }).fill(`Editor 真实 ${source}`)
    await design.getByLabel('说话风格', { exact: true }).fill('平静、清晰，原创角色')
    await choose(page, design.getByRole('combobox', { name: 'zh-CN qwen-tts 可信预设', exact: true }), `${source === 'designed' ? 'design' : 'base'} · ${model}`)
    await choose(page, design.getByRole('combobox', { name: 'zh-CN qwen-tts 音色来源', exact: true }), source === 'designed' ? '描述设计' : '授权参考音色')
    if (source === 'designed') {
      await design.getByLabel('音色描述', { exact: true }).fill('A young adult male voice with a warm mid pitch, clear Mandarin pronunciation, calm and friendly delivery. An original fictional character, not an imitation of a real person.')
    }
    else {
      await design.getByRole('combobox', { name: 'zh-CN qwen-tts 已登记参考', exact: true }).click()
      await page.getByRole('option', { name: reference.title, exact: true }).click()
      await design.getByLabel('参考文本', { exact: true }).fill(reference.text)
      await choose(page, design.getByRole('combobox', { name: 'zh-CN qwen-tts 参考模式', exact: true }), '参考音频与文本')
      await design.getByLabel('使用许可', { exact: true }).fill('Original synthetic reference for local ADV.JS acceptance')
      await design.getByLabel('声音主体', { exact: true }).fill('Original fictional synthetic voice; no real person')
      await design.getByLabel('项目同意文件', { exact: true }).fill(realQwenConsentPath)
    }
    await design.getByTestId('design-save').click()
    await expect(design.getByTestId('design-new-version')).toBeEnabled()
    await design.getByLabel('试听文本', { exact: true }).fill(realQwenPreviewText)
    await design.getByRole('checkbox', { name: '当前费用无法估算；我允许在字符预算内生成试听', exact: true }).check()
    await design.getByTestId('design-plan').click()
    await expect(design.getByTestId('design-review')).toContainText(model)
    await expect(design.getByTestId('design-execute')).toBeDisabled()
    await design.getByRole('checkbox', { name: '我已核对音色、语言、试听文本与预算', exact: true }).check()
    await design.getByTestId('design-execute').click()
    await expect(design.getByTestId('design-preview-ready')).toBeVisible({ timeout: synthesisTimeout })
    await design.getByTestId('design-audition').click()
    const measured = await measureAudio(design.locator('audio[aria-label="音色候选试听"]'))
    expect(measured.duration).toBeGreaterThan(0)
    expect(measured.rms).toBeGreaterThan(0.0001)
    expect(measured.voicedFraction).toBeGreaterThan(0)
    const candidate = fixture.calls.at(-1)!.candidates[0]!
    expect(measured.sha256).toBe(candidate.sha256)
    expect(measured.bytes).toBe(candidate.bytes)
    expect(candidate.model).toBe(model)
    expect(candidate.revision).toBe(source === 'designed' ? realQwenModelRevision : fixture.baseModelRevision)
    await snapshot(audioPanel, page, `editor-${source}-audition`)
    await design.getByTestId('design-stop-audition').click()
    await design.getByTestId('design-register').click()
    await expect(design.getByTestId('design-preview-registered')).toBeVisible()
    await design.getByTestId('design-select-sample').click()
    await expect(design.getByTestId('design-select-sample')).toBeDisabled()
    const replacement = design.getByRole('checkbox', { name: '我确认替换此语言／供应商的已有角色音色绑定', exact: true })
    if (await replacement.count())
      await replacement.check()
    await design.getByTestId('design-apply').click()
    await expect.poll(async () => JSON.parse(await readFile(join(fixture.root, 'adv/settings/game.json'), 'utf8')).characters[0].voiceProfile?.locales?.['zh-CN']?.providers?.['qwen-tts']?.projectVoiceId).toBe(id)
    const library = JSON.parse(await readFile(join(fixture.root, 'authoring/voices/library.json'), 'utf8'))
    const voice = library.voices.find((voice: any) => voice.id === id)
    expect(voice.design.samples).toHaveLength(1)
    expect(voice.design.selectedSamples['zh-CN']['qwen-tts'].sha256).toBe(candidate.sha256)
    previewProofs.push({ source, id, model, measured, sample: voice.design.samples[0] })
    await checkpoint(`${source}-profile-applied`)
    return id
  }

  if (!fixture.resume) {
    await test.step('VoiceDesign: reviewed real preview, audition, register, select and apply', async () => {
      await createAndApply('designed')
      expect(fixture.calls).toHaveLength(1)
    })
    let endingId: string
    await test.step('native JSON Flow edits and creates a conditional crosschapter ending, then reloads', async () => {
      await main.getByRole('tab', { name: '流程图', exact: true }).click()
      const flow = main.getByTestId('native-flow-editor')
      await choose(page, flow.getByRole('combobox', { name: 'JSON 章节' }), 'editor-real-qwen.chapter.json')
      await selectNode(page, flow, 'real-dialogue')
      await flow.getByLabel('对白 1 文本', { exact: true }).fill(realQwenDialogue)
      await flow.getByLabel('布局 X', { exact: true }).fill('470')
      await flow.getByLabel('布局 X', { exact: true }).press('Tab')
      await flow.getByTestId('native-flow-undo').click()
      await flow.getByTestId('native-flow-redo').click()
      await flow.getByTestId('native-flow-save').click()
      await expect.poll(async () => JSON.parse(await readFile(join(fixture.root, realQwenChapterPath), 'utf8')).nodes[0].dialogues[0].text).toBe(realQwenDialogue)
      await flow.getByRole('button', { name: '新建章节', exact: true }).click()
      await flow.getByLabel('新章节 ID', { exact: true }).fill('editor-real-ending')
      await flow.getByLabel('新章节标题', { exact: true }).fill('真实配音旅程结局')
      await flow.getByRole('button', { name: '创建章节草稿', exact: true }).click()
      await flow.getByTestId('native-node-add').click()
      endingId = (await flow.getByTestId('native-flow-inspector').locator('.native-id').first().textContent())!.trim()
      await flow.getByLabel('旁白文本', { exact: true }).fill('原创声音的旅程已经完成。')
      await flow.getByRole('button', { name: '设为入口', exact: true }).click()
      await flow.getByRole('button', { name: '断开后继', exact: true }).click()
      await expect(flow.getByRole('combobox', { name: '后继模式', exact: true })).toHaveText('停止后继')
      await flow.getByTestId('native-flow-save').click()
      await expect.poll(async () => JSON.parse(await readFile(join(fixture.root, 'adv/settings/game.json'), 'utf8')).chapters.length).toBe(2)
      await choose(page, flow.getByRole('combobox', { name: 'JSON 章节' }), 'editor-real-qwen.chapter.json')
      await selectNode(page, flow, 'real-choice')
      await flow.getByLabel('选项 continue 文本', { exact: true }).fill('进入真实配音结局')
      await flow.getByLabel('选项 continue 条件', { exact: true }).fill('ready == true')
      await flow.getByLabel('选项 continue 目标', { exact: true }).fill(`editor-real-ending#${endingId}`)
      await flow.getByLabel('选项 continue 目标', { exact: true }).press('Tab')
      await flow.getByTestId('native-flow-save').click()
      await expect(flow.getByTestId('native-flow-save')).toBeDisabled()
      await snapshot(flow, page, 'editor-native-flow')
      await page.reload()
      await main.getByRole('tab', { name: '流程图', exact: true }).click()
      await choose(page, flow.getByRole('combobox', { name: 'JSON 章节' }), 'editor-real-qwen.chapter.json')
      await selectNode(page, flow, 'real-choice')
      await expect(flow.getByLabel('选项 continue 目标', { exact: true })).toHaveValue(`editor-real-ending#${endingId}`)
      const chapter = JSON.parse(await readFile(join(fixture.root, realQwenChapterPath), 'utf8'))
      expect(chapter.startNodeId).toBe('real-dialogue')
      expect(chapter.nodes[0].dialogues[0].lineId).toBe(realQwenLineId)
      expect(chapter.nodes[0].position.x).toBe(470)
      expect(chapter.nodes[0].imagePrompt).toBe(realQwenPrivateMarker)
    })
  }

  async function generateAndSelect(source: 'designed' | 'cloned', count: number) {
    await main.getByRole('tab', { name: '音频', exact: true }).click()
    if (!fixture.resume) {
      await audioPanel.getByRole('tab', { name: '配音任务', exact: true }).click()
      const jobs = audioPanel.getByRole('region', { name: '配音生成任务', exact: true })
      await jobs.getByTestId('jobs-refresh').click()
      const details = jobs.locator('details').filter({ has: jobs.getByRole('checkbox', { name: `hero · ${realQwenDialogue}`, exact: true }) })
      if (!await jobs.getByRole('checkbox', { name: `hero · ${realQwenDialogue}`, exact: true }).isVisible())
        await details.locator('summary').click()
      const clear = jobs.getByRole('button', { name: '清空', exact: true })
      if (await clear.isEnabled())
        await clear.click()
      await jobs.getByRole('checkbox', { name: `hero · ${realQwenDialogue}`, exact: true }).check()
      await jobs.getByRole('checkbox', { name: '我同意费用无法估算，按上述字符预算执行', exact: true }).check()
      await jobs.getByTestId('jobs-character-budget').fill('100')
      await jobs.getByTestId('jobs-plan').click()
      await expect(jobs.getByTestId('jobs-plan-review')).toContainText('1 次新生成')
      await expect(jobs.getByTestId('jobs-enqueue')).toBeDisabled()
      await jobs.getByRole('checkbox', { name: '我已审核范围、语言与预算；生成不会替换已选配音', exact: true }).check()
      await jobs.getByTestId('jobs-enqueue').click()
      await jobs.locator('[data-testid="jobs-run"]:enabled').click()
      await expect(jobs.locator('[data-task-status="committed"]')).toHaveCount(count, { timeout: synthesisTimeout })
    }
    const ledgerBefore = JSON.parse(await readFile(join(fixture.root, 'adv/audio/voice-ledger.json'), 'utf8'))
    const bindingBefore = ledgerBefore.lines[realQwenLineId].locales['zh-CN']
    expect(bindingBefore.takes).toHaveLength(count)
    expect(fixture.resume ? [takes[0]!.id, bindingBefore.takes[1].id] : [count === 1 ? null : takes[0]!.id]).toContain(bindingBefore.selectedTake)
    const take = bindingBefore.takes.at(-1) as VoiceTake
    expect(take.source).toBe(source)
    expect(take.model).toBe(source === 'designed' ? realQwenModel : fixture.baseModel)
    expect(take.spokenText).toBe(realQwenDialogue)
    takes.push(take)
    await audioPanel.getByRole('tab', { name: '对白配音', exact: true }).click()
    const ledger = audioPanel.getByRole('region', { name: '对白配音账本', exact: true })
    await choose(page, ledger.getByRole('combobox', { name: '选择配音对白', exact: true }), `hero · ${realQwenDialogue}`)
    await ledger.getByRole('combobox', { name: '审核历史配音 take', exact: true }).click()
    await page.getByRole('option').filter({ hasText: take.model }).click()
    await ledger.getByTestId('take-preview').click()
    const audio = ledger.locator('audio[aria-label="对白配音试听"]')
    await audio.evaluate(element => (element as HTMLAudioElement).play())
    const measured = await measureAudio(audio)
    expect(measured.sha256).toBe(take.sha256)
    expect(measured.rms).toBeGreaterThan(0.0001)
    await checkpoint(`${source}-take-auditioned`)
    if (count > 1 && bindingBefore.selectedTake !== take.id) {
      await expect(ledger.getByTestId('take-select')).toBeDisabled()
      await ledger.getByRole('checkbox', { name: '明确替换当前已选配音', exact: true }).check()
    }
    if (bindingBefore.selectedTake !== take.id)
      await ledger.getByTestId('take-select').click()
    await expect(ledger.locator('[role="alert"]')).toHaveCount(0)
    await expect.poll(async () => JSON.parse(await readFile(join(fixture.root, 'adv/audio/voice-ledger.json'), 'utf8')).lines[realQwenLineId].locales['zh-CN'].selectedTake).toBe(take.id)
    await snapshot(audioPanel, page, `editor-${source}-selected-take`)
    await checkpoint(`${source}-take-selected`)
    return measured
  }

  const designTakeProof = fixture.resume
    ? await recoveredAudio(1)
    : await test.step('one reviewed real dialogue job and explicit take selection', async () => {
        const result = await generateAndSelect('designed', 1)
        expect(fixture.calls).toHaveLength(2)
        return result
      })
  if (!fixture.resume) {
    await test.step('ordinary native VoiceDesign export retains author evidence outside the player', async () => {
      const build = await advBuild({ userRoot: fixture.root })
      await cp(build.outDir, join(fixture.artifactRoot, 'designed-player'), { recursive: true })
      await cp(join(fixture.root, 'adv/audio/voice-ledger.json'), join(fixture.artifactRoot, 'designed-voice-ledger.json'))
    })
    await test.step('Base: real original reference preview and explicit character profile replacement', async () => {
    // Import the bytes generated in this exact VoiceDesign review, using the real
    // native Editor resource port. The Base conditioning hash is never a tone or
    // a different operator sample, and seed/description is not claimed as identity.
      const designed = fixture.calls[0]!.candidates[0]!
      expect(designed.durationSeconds).toBeGreaterThanOrEqual(3)
      expect(designed.durationSeconds).toBeLessThanOrEqual(20)
      const title = `editor-designed-reference-${runId}.wav`
      await audioPanel.getByRole('tab', { name: '音频资源', exact: true }).click()
      const resources = audioPanel.getByRole('region', { name: '项目音频资源', exact: true })
      await choose(page, resources.getByRole('combobox', { name: '导入音频用途', exact: true }), '声音参考 · Reference')
      await resources.locator('input[type="file"]').setInputFiles({ name: title, mimeType: 'audio/wav', buffer: await readFile(join(fixture.root, designed.path)) })
      await expect.poll(async () => (await loadProject({ root: fixture.root, allowEmptyAssetManifest: true })).result.project.assets?.assets.find(asset => asset.title === title)?.sha256).toBe(designed.sha256)
      const imported = (await loadProject({ root: fixture.root, allowEmptyAssetManifest: true })).result.project.assets!.assets.find(asset => asset.title === title)!
      reference = { assetId: imported.id, sha256: designed.sha256, text: realQwenPreviewText, title }
      await mkdir(join(fixture.root, 'authoring/rights'), { recursive: true })
      await writeFile(join(fixture.root, realQwenConsentPath), `${JSON.stringify({ schemaVersion: 1, source: 'original-synthetic', description: 'This test-generated original fictional voice has no real-person recording or likeness. Authorized for this local acceptance and its generated game.', provider: 'qwen-tts', model: designed.model, modelRevision: designed.revision, assetId: imported.id, sha256: designed.sha256, text: realQwenPreviewText }, null, 2)}\n`)
      await audioPanel.getByRole('tab', { name: '音色设计', exact: true }).click()
      await design.getByTestId('design-reload').click()
      await createAndApply('cloned')
      expect(fixture.calls).toHaveLength(3)
      const retained = JSON.parse(await readFile(join(fixture.root, 'adv/audio/voice-ledger.json'), 'utf8')).lines[realQwenLineId].locales['zh-CN']
      expect(retained.selectedTake).toBe(takes[0]!.id)
      expect(retained.takes).toHaveLength(1)
    })
  }
  const baseTakeProof = await test.step('new Base dialogue take preserves history and requires explicit replacement', async () => {
    const result = await generateAndSelect('cloned', 2)
    expect(fixture.calls).toHaveLength(4)
    expect(takes[1]!.voiceId).toBe(`reference:${reference.assetId}:${reference.sha256}`)
    return result
  })
  await bridge.stop()
  const build = await advBuild({ userRoot: fixture.root })
  const scripts = (await Promise.all(build.assets.filter(asset => asset.path.endsWith('.js')).map(asset => readFile(join(build.outDir, asset.path), 'utf8')))).join('\n')
  for (const field of [realQwenPrivateMarker, 'operator-design.json', 'operator-base.json', realQwenConsentPath])
    expect(scripts).not.toContain(field)
  const catalog = (await loadProject({ root: fixture.root, allowEmptyAssetManifest: true })).result.project.assets!
  const master = catalog.assets.find(asset => asset.id === takes[1]!.assetId)!
  const masterBytes = await readFile(join(fixture.root, audioProjectMediaPath(catalog, master)))
  expect(createHash('sha256').update(masterBytes).digest('hex')).toBe(takes[1]!.sha256)
  await cp(build.outDir, join(fixture.artifactRoot, 'base-player'), { recursive: true })
  const nativeProject = join(fixture.artifactRoot, 'native-project')
  const loaded = await loadProject({ root: fixture.root, allowEmptyAssetManifest: true })
  const nativeFiles = { ...loaded.files, 'package.json': await readFile(join(fixture.root, 'package.json'), 'utf8'), 'authoring/voices/library.json': await readFile(join(fixture.root, 'authoring/voices/library.json'), 'utf8') }
  for (const [path, source] of Object.entries(nativeFiles)) {
    await mkdir(join(nativeProject, path, '..'), { recursive: true })
    await writeFile(join(nativeProject, path), source)
  }
  for (const asset of catalog.assets) {
    const path = audioProjectMediaPath(catalog, asset)
    await mkdir(join(nativeProject, path, '..'), { recursive: true })
    await cp(join(fixture.root, path), join(nativeProject, path))
  }
  for (const preview of previewProofs) {
    const path = `authoring/voices/designs/${preview.id}`
    await cp(join(fixture.root, path), join(nativeProject, path), { recursive: true })
  }
  playerServer = await serveRealQwenPlayer(fixture.root)
  const playerProofs = []
  const secondBrowser = await webkit.launch()
  try {
    for (const [name, playerContext] of [['chromium', context], ['webkit', await secondBrowser.newContext()]] as const) {
      const player = await playerContext.newPage()
      const audioRequests: string[] = []
      player.on('request', (request) => {
        if (request.url().endsWith('.wav'))
          audioRequests.push(request.url())
      })
      await installPlayerProbe(player)
      const playerErrors: string[] = []
      player.on('pageerror', error => playerErrors.push(error.message))
      await player.goto(playerServer.url)
      await player.locator('[data-action="start_game"]').click()
      await expect.poll(async () => (await playerState(player)).current?.data?.text).toBe(realQwenDialogue)
      await expect.poll(async () => (await playerState(player)).audio.voice?.assetId).toBe(takes[1]!.assetId)
      // The game page installs the finite gesture unlock after navigation; this
      // actual dialog gesture completes typing and starts its queued voice.
      await player.locator('.adv-dialog-box:visible').click()
      await expect.poll(async () => (await playerState(player)).audio.unlocked).toBe(true)
      await expect.poll(async () => (await playerState(player)).rms).toBeGreaterThan(0.0001)
      const playing = await playerState(player)
      expect(playing.audio.tracks.filter(track => track.status === 'playing').map(track => track.bus)).toEqual(['voice'])
      const binding = playing.runtime.game.audio.voiceLedger.lines[realQwenLineId].locales['zh-CN']
      expect(binding.selectedTake).toBe(takes[1]!.id)
      expect(binding.takes).toHaveLength(1)
      for (const field of ['voiceProfile', 'rights', 'parameters', 'imagePrompt'])
        expect(JSON.stringify(playing.runtime)).not.toContain(`"${field}"`)
      const mediaUrl = new URL(playing.runtime.game.audio.assets[takes[1]!.assetId].src, player.url()).href
      expect(audioRequests).toContain(mediaUrl)
      expect(playing.media.length + playing.buffers).toBeGreaterThan(0)
      const mediaResponse = await player.request.get(mediaUrl)
      expect(mediaResponse.ok()).toBe(true)
      expect(createHash('sha256').update(await mediaResponse.body()).digest('hex')).toBe(takes[1]!.sha256)
      await player.screenshot({ path: join(fixture.artifactRoot, `editor-real-player-${name}-normal.png`), animations: 'disabled' })
      for (let attempt = 0; attempt < 2 && (await playerState(player)).current?.kind !== 'choices'; attempt++)
        await player.locator('.adv-dialog-box:visible').click()
      await expect(player.getByRole('button', { name: '进入真实配音结局', exact: true })).toBeVisible()
      await expect(player.getByRole('button', { name: '不可用的路线', exact: true })).toHaveCount(0)
      await player.getByRole('button', { name: '进入真实配音结局', exact: true }).click()
      await expect.poll(async () => (await playerState(player)).current?.data?.text).toBe('原创声音的旅程已经完成。')
      await expect.poll(async () => (await playerState(player)).audio.voice).toBeUndefined()
      await expect(player.locator('.adv-black .words-wrapper')).toContainText('原创声音的旅程已经完成。')
      await expect(player.locator('.adv-black .print-words .invisible')).toHaveCount(0)
      await expect.poll(() => player.locator('.adv-black .print-words span').last().evaluate(element => Number(getComputedStyle(element).opacity))).toBeGreaterThan(0.98)
      await player.setViewportSize({ width: 390, height: 844 })
      await player.screenshot({ path: join(fixture.artifactRoot, `editor-real-player-${name}-390.png`) })
      expect(playerErrors).toEqual([])
      expect(playing.diagnostics).toEqual([])
      playerProofs.push({ browser: name, voiceRms: playing.rms, media: playing.media, audioRequests, playback: playing.media.length ? 'media-element' : 'decoded-buffer', buffers: playing.buffers, mediaUrl, selectedTake: binding.selectedTake, errors: playerErrors })
      await player.close()
    }
  }
  finally {
    await secondBrowser.close()
  }
  expect(errors).toEqual([])
  expect(fixture.calls.every(call => call.offline)).toBe(true)
  await writeFile(join(fixture.artifactRoot, 'editor-real-qwen-proof.json'), `${JSON.stringify({ provider: 'qwen-tts', realModel: true, offline: true, resumedAfterSelectionFailure: fixture.resume, nativeProject, basePlayer: join(fixture.artifactRoot, 'base-player'), presetSha256: fixture.presetSha256, modelRevision: realQwenModelRevision, baseModelRevision: fixture.baseModelRevision, previewProofs, designTakeProof, baseTakeProof, takes, calls: fixture.calls.length, playerProofs }, null, 2)}\n`)
})
