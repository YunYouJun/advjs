import type { Locator, Page } from '@playwright/test'
import type { EditorBridge } from 'advjs/node'
import type { AdvContext } from '../../packages/client/types/context'
import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { expect, test } from '@playwright/test'
import { advBuild, createEditorBridge, runCheck } from 'advjs/node'
import { createEditorMusicFixture } from '../fixtures/audio/editor-music'

const repository = resolve(import.meta.dirname, '../..')
let fixture: Awaited<ReturnType<typeof createEditorMusicFixture>>
let bridge: EditorBridge
let playerServer: ReturnType<typeof createServer> | undefined
async function choose(page: Page, locator: Locator, label: string) {
  await locator.click()
  await page.getByRole('option', { name: label, exact: true }).click()
}
test.afterEach(async () => {
  await bridge?.stop()
  if (playerServer) {
    playerServer.closeAllConnections()
    await new Promise<void>(resolve => playerServer!.close(() => resolve()))
    playerServer = undefined
  }
  await rm(fixture.directory, { recursive: true, force: true })
})
test('production Editor hands off a brief, imports and explicitly reviews music, binds canonical Flow and plays the ordinary build', async ({ page, context }, info) => {
  fixture = await createEditorMusicFixture()
  const evidence = process.env.ADVJS_MUSIC_EDITOR_SCREENSHOTS || info.outputPath('evidence')
  await mkdir(evidence, { recursive: true })
  bridge = await createEditorBridge({ host: '127.0.0.1', port: 0, projectRoot: fixture.root, publicRoot: join(repository, 'editor/core/dist') })
  await page.addInitScript(() => {
    localStorage.setItem('advjs:editor:locale', 'zh-CN')
    localStorage.setItem('advjs:editor:onboarded', 'true')
    localStorage.setItem('nuxt-color-mode', 'dark')
  })
  await page.setViewportSize({ width: 1440, height: 1000 })
  try {
    await page.goto((await bridge.start()).url)
  }
  catch { throw new Error('Finite Editor fixture navigation failed; scoped credentials omitted') }
  const main = page.locator('[data-editor-region="main"]')
  await main.getByRole('tab', { name: '音频', exact: true }).click()
  const resources = main.getByRole('region', { name: '项目音频资源', exact: true })
  const brief = resources.locator('.ae-music-brief')
  await brief.locator('summary').first().click()
  await brief.getByLabel('工具 / 来源方', { exact: true }).fill('Original tone fixture')
  await brief.getByLabel('来源页面', { exact: true }).fill('https://example.com/original-local-test')
  await brief.getByLabel('使用许可', { exact: true }).fill('original-fixture-license')
  await brief.getByLabel('署名', { exact: true }).fill('ADV.JS test author')
  await brief.getByText('创作意图与交接内容', { exact: true }).click()
  await brief.getByLabel('创作方案', { exact: true }).fill('PRIVATE_EDITOR_MUSIC_BRIEF: original instrumental acceptance tone')
  expect(await brief.getByRole('link', { name: '打开 Suno 创作 ↗' }).getAttribute('href')).toBe('https://suno.com/create')
  const downloading = page.waitForEvent('download')
  await brief.getByTestId('music-brief-export').click()
  const download = await downloading
  await download.saveAs(join(evidence, `music-brief-${info.project.name}.json`))
  const handedOff = JSON.parse(await readFile(join(evidence, `music-brief-${info.project.name}.json`), 'utf8'))
  expect(handedOff).toMatchObject({ schemaVersion: 1, usage: 'background', source: { type: 'manual' }, review: { status: 'pending' } })
  await resources.locator('input[type="file"]').setInputFiles(fixture.importPath)
  const row = resources.locator('[data-asset-id]').first()
  await expect(row).toContainText('original-music.wav')
  await expect(row.getByTestId('music-approve')).toBeDisabled()
  await expect(row.getByTestId('music-open-flow')).toBeDisabled()
  await row.getByTestId('asset-preview').click()
  const audition = row.locator('audio')
  await expect(audition).toBeVisible()
  await row.getByTestId('asset-play-verified').click()
  await expect(row.getByTestId('music-reviewed').locator('input')).toBeEnabled()
  await row.getByTestId('music-reviewed').locator('input').check()
  await row.getByTestId('music-approve').click()
  await expect(row.getByTestId('music-review-status')).toHaveText('此母版已明确批准')
  const catalog = JSON.parse(await readFile(join(fixture.root, 'adv/assets.json'), 'utf8'))
  const asset = catalog.assets[0]
  const sha256 = createHash('sha256').update(fixture.bytes).digest('hex')
  expect(asset).toMatchObject({ kind: 'bgm', sha256, loop: true, music: { usage: 'background', review: { status: 'approved', sha256 } } })
  await resources.locator('input[type="file"]').setInputFiles(fixture.candidatePath)
  await expect(resources.locator('[data-asset-id]')).toHaveCount(2)
  const candidateCatalog = JSON.parse(await readFile(join(fixture.root, 'adv/assets.json'), 'utf8'))
  const unusedCandidate = candidateCatalog.assets.find((value: { id: string }) => value.id !== asset.id)
  expect(unusedCandidate.music.review.status).toBe('pending')
  await brief.locator('summary').first().click()
  await resources.screenshot({ path: join(evidence, `music-resources-normal-${info.project.name}.png`), animations: 'disabled' })
  const narrow = await page.addStyleTag({ content: '.ae-audio-workspace { width:320px !important; max-width:320px !important; }' })
  await expect.poll(() => resources.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await resources.screenshot({ path: join(evidence, `music-resources-320-${info.project.name}.png`), animations: 'disabled' })
  await narrow.evaluate(element => element.remove())
  await row.getByTestId('music-open-flow').click()
  const flow = main.getByTestId('native-flow-editor')
  await choose(page, flow.getByRole('combobox', { name: '添加节点类型', exact: true }), '音频')
  await flow.getByTestId('native-node-add').click()
  await flow.getByTestId('audio-operation-add').click()
  await choose(page, flow.getByRole('combobox', { name: '素材', exact: true }), 'original-music.wav')
  await flow.getByRole('button', { name: '设为入口', exact: true }).click()
  await flow.getByLabel('跳转目标', { exact: true }).fill('narration')
  await flow.getByRole('button', { name: '连接目标', exact: true }).click()
  await expect(flow.getByTestId('native-flow-save')).toBeEnabled()
  await flow.getByTestId('native-flow-save').click()
  await expect(flow.getByText('JSON 章节已保存', { exact: true })).toBeVisible()
  const chapterPath = 'adv/chapters/intro.chapter.json'
  const chapter = JSON.parse(await readFile(join(fixture.root, chapterPath), 'utf8'))
  const musicNode = chapter.nodes.find((node: { type: string }) => node.type === 'audio')
  expect(chapter.startNodeId).toBe(musicNode.id)
  expect(musicNode.operations).toEqual([{ type: 'bgm', action: 'set', asset: asset.id, gain: 0.7, loop: true, fade: { in: 500, out: 1000 } }])
  await flow.screenshot({ path: join(evidence, `music-flow-normal-${info.project.name}.png`), animations: 'disabled' })
  const native = join(evidence, `native-${info.project.name}`)
  for (const path of [...fixture.sourcePaths, ...candidateCatalog.assets.map((item: { path: string }) => `public/media/${item.path}`)]) {
    await mkdir(join(native, path, '..'), { recursive: true })
    await writeFile(join(native, path), await readFile(join(fixture.root, path)))
  }
  await symlink(join(repository, 'node_modules'), join(fixture.root, 'node_modules'), 'dir')
  const check = await runCheck({ cwd: fixture.root })
  expect(check.passed).toBe(true)
  const build = await advBuild({ userRoot: fixture.root, vite: { logLevel: 'silent' } })
  const media = build.assets.filter(file => file.path.endsWith('.wav'))
  expect(media).toHaveLength(1)
  expect(createHash('sha256').update(await readFile(join(build.outDir, media[0]!.path))).digest('hex')).toBe(sha256)
  const js = (await Promise.all(build.assets.filter(file => /\.(?:js|json)$/u.test(file.path)).map(file => readFile(join(build.outDir, file.path), 'utf8')))).join('\n')
  for (const privateValue of ['PRIVATE_EDITOR_MUSIC_BRIEF', 'https://example.com/original-local-test', 'ADV.JS test author', 'original-fixture-license', unusedCandidate.id])
    expect(js).not.toContain(privateValue)
  playerServer = createServer(async (request, response) => {
    try {
      const target = resolve(build.outDir, `.${decodeURIComponent(new URL(request.url!, 'http://127.0.0.1').pathname)}`)
      if (relative(build.outDir, target).startsWith('..'))
        throw new Error('Invalid path')
      const path = extname(target) ? target : join(build.outDir, 'index.html')
      const bytes = await readFile(path)
      const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wav': 'audio/wav', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }
      response.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream', 'content-length': bytes.length }).end(bytes)
    }
    catch { response.writeHead(404).end() }
  })
  await new Promise<void>(resolve => playerServer!.listen(0, '127.0.0.1', resolve))
  const address = playerServer.address()!
  if (typeof address === 'string')
    throw new Error('Fixture address invalid')
  const player = await context.newPage()
  await player.addInitScript(() => {
    const NativeContext = window.AudioContext
    let analyser: AnalyserNode
    class ObservedContext extends NativeContext {
      constructor(options?: AudioContextOptions) {
        super(options)
        analyser = this.createAnalyser()
        const gain = this.createGain.bind(this)
        let master = true
        this.createGain = () => {
          const node = gain()
          if (master) {
            node.connect(analyser)
            master = false
          }
          return node
        }
      }
    }
    window.AudioContext = ObservedContext
    Object.assign(window, { musicRms: () => {
      const data = new Float32Array(analyser?.fftSize ?? 2048)
      analyser?.getFloatTimeDomainData(data)
      return Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length)
    } })
  })
  await player.goto(`http://127.0.0.1:${address.port}`)
  await player.locator('button[data-action="start_game"]').click()
  let playing: unknown
  await expect.poll(async () => {
    playing = await player.evaluate((id) => {
      const root = document.getElementById('app') as HTMLElement & { __vue_app__: { _context: { provides: Record<string, AdvContext> } } }
      const adv = root.__vue_app__._context.provides['$advjs-context']!
      const rms = (window as unknown as { musicRms: () => number }).musicRms()
      return { rms, audio: adv.$audio.inspect(), current: adv.store.current, diagnostics: adv.compileDiagnostics.value, assetIds: Object.keys(adv.gameConfig.value.audio!.assets), playing: adv.$audio.inspect().tracks.some(track => track.assetId === id && track.bus === 'music' && track.status === 'playing') }
    }, asset.id)
    return (playing as { playing: boolean, rms: number }).playing && (playing as { rms: number }).rms > 0.0001
  }).toBe(true)
  const state = playing as { audio: { errors: unknown[] }, diagnostics: unknown[], assetIds: string[] }
  expect(state.audio.errors).toEqual([])
  expect(state.diagnostics).toEqual([])
  expect(state.assetIds).toEqual([asset.id])
  await expect(player.locator('.adv-black:visible')).toContainText('音乐已从作者文件进入当前章节。')
  await expect(player.locator('.adv-black:visible .print-words .invisible')).toHaveCount(0)
  await player.screenshot({ path: join(evidence, `music-player-${info.project.name}.png`), animations: 'disabled' })
  await writeFile(join(evidence, `music-proof-${info.project.name}.json`), `${JSON.stringify({ schemaVersion: 1, classification: 'original audible PCM file import integration; no song generation or human quality score', browser: info.project.name, assetId: asset.id, sha256, handedOff, operation: musicNode.operations[0], nativeCheckPassed: check.passed, buildMedia: media, playback: playing, normalStart: true, additionalUnlockGesture: false, newAiOrTtsCalls: 0, cloudWrites: 0 }, null, 2)}\n`, { flag: 'wx' })
  await player.close()
})
