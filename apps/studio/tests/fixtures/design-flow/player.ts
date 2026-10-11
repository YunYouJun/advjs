import type { Page, TestInfo } from '@playwright/test'
import type { AdvContext } from '../../../../../packages/client/types/context'
import { expect } from '@playwright/test'

/** Play the real static artifact exported by Studio, rather than its embedded preview. */
export async function verifyStudioHandoffPlayer(page: Page, info: TestInfo, input: { playerUrl: string, lineId: string, text: string, takeId: string, assetId: string, minimumRms?: number, locale?: string, choiceLabel?: string, branchText?: string }) {
  const failures: string[] = []
  page.on('pageerror', error => failures.push(error.message))
  page.on('response', (response) => {
    if (response.status() >= 400)
      failures.push(`${response.status()} ${response.url()}`)
  })
  await page.addInitScript(() => {
    const NativeContext = window.AudioContext
    let analyser: AnalyserNode | undefined
    const contexts: AudioContext[] = []
    class ObservedContext extends NativeContext {
      constructor(options?: AudioContextOptions) {
        super(options)
        contexts.push(this)
        analyser = this.createAnalyser()
        analyser.fftSize = 256
        const createGain = this.createGain.bind(this)
        let first = true
        this.createGain = () => {
          const gain = createGain()
          if (first) {
            first = false
            gain.connect(analyser!)
          }
          return gain
        }
      }
    }
    window.AudioContext = ObservedContext
    Object.assign(window, { studioHandoffAudioProbe: {
      state: () => contexts.at(-1)?.state ?? 'not-created',
      rms: () => {
        const samples = new Float32Array(256)
        analyser?.getFloatTimeDomainData(samples)
        return Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length)
      },
    } })
  })
  async function inspect() {
    return await page.evaluate(() => {
      const app = (document.querySelector('#app') as unknown as { __vue_app__: { _context: { provides: Record<string, AdvContext> } } }).__vue_app__
      const adv = app._context.provides['$advjs-context']!
      const probe = (window as unknown as { studioHandoffAudioProbe: { state: () => string, rms: () => number } }).studioHandoffAudioProbe
      return { current: adv.store.current, game: JSON.parse(JSON.stringify(adv.gameConfig.value)), audio: adv.$audio.inspect(), diagnostics: adv.compileDiagnostics.value, rms: probe.rms(), context: probe.state() }
    })
  }
  async function readingFont(surface: 'dialogue' | 'narration') {
    // The narration overlays the retained dialogue surface. Measure the actual
    // current component rather than whichever visible element happens to win.
    return page.locator(surface === 'narration' ? '.adv-black:visible' : '.adv-dialog-box:visible').evaluate((element: HTMLElement) => {
      const content = element.querySelector('.dialog-content, .words-wrapper') ?? element
      const fontSize = Number.parseFloat(getComputedStyle(content).fontSize)
      const screenScale = element.getBoundingClientRect().width / element.offsetWidth
      const glyph = element.querySelector('.print-words span')
      const glyphBounds = glyph?.getBoundingClientRect()
      const name = element.querySelector('.dialog-name')
      const nameFontSize = name ? Number.parseFloat(getComputedStyle(name).fontSize) : null
      return {
        surface: element.classList.contains('adv-black') ? 'narration' : 'dialogue',
        viewport: { width: innerWidth, height: innerHeight },
        logicalFontSize: fontSize,
        screenScale,
        actualScreenSize: fontSize * screenScale,
        glyphBounds: glyphBounds ? { x: glyphBounds.x, y: glyphBounds.y, width: glyphBounds.width, height: glyphBounds.height } : null,
        text: element.querySelector('.print-words')?.textContent?.trim() ?? '',
        name: name ? { text: name.textContent?.trim() ?? '', logicalFontSize: nameFontSize, actualScreenSize: nameFontSize! * screenScale, glyphHeight: name.getBoundingClientRect().height } : null,
      }
    })
  }
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(input.playerUrl)
  await expect(page.locator('[data-action="start_game"]')).toBeVisible()
  await page.evaluate(() => {
    const app = (document.querySelector('#app') as unknown as { __vue_app__: { _context: { provides: Record<string, AdvContext> } } }).__vue_app__
    app._context.provides['$advjs-context']!.$audio.setUserSettings({ buses: { music: { muted: true }, ambience: { muted: true } } })
  })
  await page.locator('[data-action="start_game"]').click()
  await expect.poll(async () => (await inspect()).current?.data?.lineId).toBe(input.lineId)
  // The normal Start gesture must unlock audio before navigating to the game.
  // No additional reading-area gesture may be needed to hear the first line.
  await expect.poll(async () => (await inspect()).context).toBe('running')
  let played = await inspect()
  await expect.poll(async () => {
    played = await inspect()
    return played.rms
  }).toBeGreaterThan(input.minimumRms ?? 0.00001)
  await expect.poll(async () => (await inspect()).current?.data?.lineId).toBe(input.lineId)
  expect(played.current?.data?.text).toBe(input.text)
  expect(played.diagnostics).toEqual([])
  const locale = input.locale ?? 'zh-CN'
  expect(played.game.audio.voiceLedger.lines[input.lineId].locales[locale].selectedTake).toBe(input.takeId)
  expect(played.game.audio.voiceLedger.lines[input.lineId].locales[locale].takes).toHaveLength(1)
  expect(played.game.audio.voiceLedger.lines[input.lineId].locales[locale].takes[0].assetId).toBe(input.assetId)
  expect(Object.values(played.game.audio.assets).every((asset: unknown) => !JSON.stringify(asset).includes('voice/samples/'))).toBe(true)
  const runtime = JSON.stringify(played.game)
  for (const field of ['voiceProfile', 'rights', 'parameters'])
    expect(runtime).not.toContain(`"${field}"`)
  expect(runtime).not.toContain('authoring/voices')
  await expect(page.locator('.print-words .invisible')).toHaveCount(0)
  await expect(page.locator('.adv-dialog-box .dialog-name')).toBeVisible()
  const normalReadingFont = await readingFont('dialogue')
  await page.screenshot({ path: info.outputPath('exported-native-player-normal.png'), fullPage: true, animations: 'disabled' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  const narrowDialogueReadingFont = await readingFont('dialogue')
  expect(narrowDialogueReadingFont.actualScreenSize).toBeGreaterThanOrEqual(17.9)
  expect(narrowDialogueReadingFont.name?.actualScreenSize).toBeGreaterThanOrEqual(16.2)
  await page.screenshot({ path: info.outputPath('exported-native-player-dialogue-narrow.png'), fullPage: true, animations: 'disabled' })
  // Two real clicks finish typewriting and advance into the conditional choice.
  for (let index = 0; index < 2 && (await inspect()).current?.data?.lineId === input.lineId; index++)
    await page.locator('.adv-dialog-box:visible').click({ position: { x: 20, y: 20 } })
  const choiceLabel = input.choiceLabel ?? '走左侧'
  const branchText = input.branchText ?? '进入左侧分支。'
  await expect(page.getByRole('button', { name: choiceLabel, exact: true })).toBeVisible()
  await page.getByRole('button', { name: choiceLabel, exact: true }).click()
  await expect.poll(async () => (await inspect()).current?.data?.text).toBe(branchText)
  await expect(page.locator('.adv-black:visible .print-words')).toContainText(branchText)
  await expect(page.locator('.print-words .invisible')).toHaveCount(0)
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  const narrowReadingFont = await readingFont('narration')
  expect(normalReadingFont.actualScreenSize).toBeGreaterThanOrEqual(17.9)
  expect(narrowReadingFont.actualScreenSize).toBeGreaterThanOrEqual(17.9)
  await page.screenshot({ path: info.outputPath('exported-native-player-narrow.png'), fullPage: true, animations: 'disabled' })
  expect(failures).toEqual([])
  expect(played.audio.errors).toEqual([])
  const binding = played.game.audio.voiceLedger.lines[input.lineId].locales[locale]
  return {
    voiceRms: played.rms,
    context: played.context,
    start: { gesture: 'start_game', additionalUnlockGesture: false, firstLineId: played.current?.data?.lineId },
    lineId: played.current?.data?.lineId,
    text: played.current?.data?.text,
    takeId: binding.selectedTake,
    assetId: binding.takes[0].assetId,
    assetSha256: played.game.audio.assets[binding.takes[0].assetId]?.sha256,
    runtime: { voiceLineIds: Object.keys(played.game.audio.voiceLedger.lines), assetIds: Object.keys(played.game.audio.assets) },
    audio: { voice: played.audio.voice, buses: played.audio.buses, errors: played.audio.errors },
    errors: failures,
    readingFonts: { normal: normalReadingFont, narrowDialogue: narrowDialogueReadingFont, narrow: narrowReadingFont },
  }
}
