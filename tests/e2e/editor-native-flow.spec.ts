import type { Locator, Page, TestInfo } from '@playwright/test'
import type { EditorBridge } from 'advjs/node'
import type { AdvContext } from '../../packages/client/types/context'
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, join, relative, resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { advBuild, createEditorBridge } from 'advjs/node'

const repositoryRoot = resolve(import.meta.dirname, '../..')
const chapterPath = 'adv/chapters/intro.chapter.json'
const lineId = 'line_019d137e-7abc-7000-8000-000000000001'
const privateMarker = 'PRIVATE-NATIVE-FLOW-AUTHOR-METADATA'
let directory: string
let root: string
let editorUrl: string
let bridge: EditorBridge
let playerServer: ReturnType<typeof createServer> | undefined
let originalChapter: any

async function capturePreview(target: Locator | Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`)
  await target.screenshot({ path, animations: 'disabled' })
  await info.attach(name, { path, contentType: 'image/png' })
}

async function assertReadableGraph(panel: Locator) {
  const canvas = panel.getByTestId('native-flow-canvas')
  await expect.poll(() => canvas.locator('.native-flow-node').evaluateAll((elements) => {
    const rectangles = elements.map(element => element.getBoundingClientRect())
    return rectangles.length > 0 && rectangles.every((a, index) => rectangles.slice(index + 1).every(b => a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1))
  })).toBe(true)
  await expect.poll(() => canvas.locator('.vue-flow__node.selected .native-flow-node').evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(190)
  await expect.poll(() => canvas.locator('[data-native-edge]').count()).toBeGreaterThan(0)
  await expect.poll(() => canvas.locator('[data-route-clear="false"]').count()).toBe(0)
  await expect.poll(() => canvas.evaluate((element) => {
    const nodes = [...element.querySelectorAll('.native-flow-node')].map(node => node.getBoundingClientRect())
    return [...element.querySelectorAll('.native-edge-badge')].every((badge) => {
      const a = badge.getBoundingClientRect()
      return nodes.every(b => a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top)
    })
  })).toBe(true)
  await expect.poll(() => canvas.evaluate((element) => {
    const viewport = element.querySelector('.native-canvas-viewport')!.getBoundingClientRect()
    const controls = element.querySelector('.native-canvas-controls')!.getBoundingClientRect()
    return controls.bottom <= viewport.top + 1
  })).toBe(true)
  await expect(canvas.locator('.native-canvas-legend')).toContainText('叙事')
  await expect(canvas.locator('.native-canvas-legend')).toContainText('分支')
}

async function choose(page: Page, locator: Locator, value: string) {
  await locator.click()
  await page.getByRole('option', { name: value, exact: true }).click()
}
async function selectNode(page: Page, panel: Locator, id: string) {
  await panel.getByRole('combobox', { name: '选中节点', exact: true }).click()
  await page.getByRole('option').filter({ hasText: new RegExp(` · ${id}$`, 'u') }).click()
}
interface NativeProposalFixture {
  schemaVersion: 1
  path: string
  expectedRevision: string
  projectRevision: string
  commands: Record<string, unknown>[]
}
async function openProposal(page: Page) {
  await page.goto(editorUrl)
  const main = page.locator('[data-editor-region="main"]')
  await main.getByRole('tab', { name: '流程图', exact: true }).click()
  const panel = main.getByTestId('native-flow-editor')
  await expect(panel.getByRole('combobox', { name: 'JSON 章节' })).toHaveText('intro.chapter.json')
  await selectNode(page, panel, 'node_01')
  const proposal = panel.getByTestId('native-flow-proposal')
  await proposal.locator(':scope > summary').click()
  await expect(proposal).toHaveAttribute('open', '')
  return { main, panel, proposal }
}
async function proposalFixture(proposal: Locator, text: string): Promise<NativeProposalFixture> {
  await proposal.getByTestId('native-proposal-template').click()
  const input = proposal.getByTestId('native-proposal-input')
  await expect(input).toHaveValue(/"projectRevision"/u)
  const template: NativeProposalFixture = JSON.parse(await input.inputValue())
  expect(template).toEqual({ schemaVersion: 1, path: chapterPath, expectedRevision: expect.stringMatching(/^[a-f0-9]{64}$/u), projectRevision: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u), commands: [] })
  // A deterministic, local JSON fixture exercises the AI proposal contract without
  // invoking an external model or claiming a live-model acceptance result.
  return { ...template, commands: [{ type: 'update-dialogue', nodeId: 'node_01', lineId, patch: { text } }, { type: 'set-title', title: 'Reviewed proposal introduction' }] }
}
async function reviewProposal(proposal: Locator, request: NativeProposalFixture) {
  if (await proposal.getByTestId('native-proposal-edit').isVisible())
    await proposal.getByTestId('native-proposal-edit').click()
  await proposal.getByTestId('native-proposal-input').fill(JSON.stringify(request, null, 2))
  await proposal.getByTestId('native-proposal-review').click()
  return proposal.getByTestId('native-proposal-review-result')
}
async function editorPlayerState(page: Page) {
  return page.evaluate(() => {
    const root = document.getElementById('__nuxt') as HTMLElement & {
      __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, unknown> } } } }
    }
    const runtime = root.__vue_app__.config.globalProperties.$pinia._s.get('@advjs/client/adv') as AdvContext['store']
    return { current: runtime.current, status: runtime.state.status, cursor: runtime.state.cursor }
  })
}
async function playerState(page: Page) {
  return page.evaluate(() => {
    const app = (document.querySelector('#app') as unknown as { __vue_app__: { _context: { provides: Record<string, AdvContext> } } }).__vue_app__
    const adv = app._context.provides['$advjs-context']
    return { current: adv.store.current, status: adv.store.state.status, audio: adv.$audio.inspect(), diagnostics: adv.compileDiagnostics.value, game: JSON.parse(JSON.stringify(adv.gameConfig.value)) }
  })
}
async function servePlayer() {
  const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.wav': 'audio/wav', '.png': 'image/png', '.woff2': 'font/woff2' }
  const dist = join(root, 'dist')
  playerServer = createServer(async (request, response) => {
    try {
      const path = new URL(request.url!, 'http://127.0.0.1').pathname
      const target = resolve(dist, `.${path === '/' ? '/index.html' : decodeURIComponent(path)}`)
      if (relative(dist, target).startsWith('..'))
        throw new Error('Invalid path')
      const file = extname(target) ? target : join(dist, 'index.html')
      const bytes = await readFile(file)
      const headers = { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'accept-ranges': 'bytes' }
      const range = /^bytes=(\d*)-(\d*)$/u.exec(request.headers.range ?? '')
      let start = 0
      let end = bytes.length - 1
      if (range) {
        start = range[1] ? Number(range[1]) : Math.max(0, bytes.length - Number(range[2]))
        end = range[1] && range[2] ? Math.min(end, Number(range[2])) : end
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= bytes.length) {
          response.writeHead(416, { ...headers, 'content-range': `bytes */${bytes.length}` })
          response.end()
          return
        }
      }
      const body = bytes.subarray(start, end + 1)
      response.writeHead(range ? 206 : 200, { ...headers, 'content-length': body.length, ...(range ? { 'content-range': `bytes ${start}-${end}/${bytes.length}` } : {}) })
      response.end(request.method === 'HEAD' ? undefined : body)
    }
    catch {
      response.writeHead(404)
      response.end()
    }
  })
  await new Promise<void>(resolve => playerServer!.listen(0, '127.0.0.1', resolve))
  const address = playerServer.address()!
  if (typeof address === 'string')
    throw new Error('Invalid server')
  return `http://127.0.0.1:${address.port}`
}

test.beforeEach(async ({ page }) => {
  directory = await mkdtemp(join(tmpdir(), 'advjs-editor-native-flow-'))
  root = join(directory, 'project')
  const demo = join(repositoryRoot, 'demo/flow')
  await mkdir(root)
  for (const path of ['adv', 'public', 'adv.config.json', 'package.json'])
    await cp(join(demo, path), join(root, path), { recursive: true })
  await symlink(join(demo, 'node_modules'), join(root, 'node_modules'), 'dir')
  await symlink(join(repositoryRoot, 'node_modules'), join(directory, 'node_modules'), 'dir')
  const gamePath = join(root, 'adv/settings/game.json')
  const game = JSON.parse(await readFile(gamePath, 'utf8'))
  game.variables = { ...game.variables, ready: true }
  await writeFile(gamePath, JSON.stringify(game))
  originalChapter = JSON.parse(await readFile(join(root, chapterPath), 'utf8'))
  originalChapter.authoring.privateMarker = privateMarker
  await writeFile(join(root, chapterPath), `${JSON.stringify(originalChapter, null, 2)}\n`)
  bridge = await createEditorBridge({ host: '127.0.0.1', port: 0, projectRoot: root, publicRoot: join(repositoryRoot, 'editor/core/dist') })
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
  if (playerServer) {
    playerServer.closeAllConnections()
    await new Promise<void>(resolve => playerServer!.close(() => resolve()))
    playerServer = undefined
  }
  if (directory)
    await rm(directory, { recursive: true, force: true })
})

test('native JSON Flow creates and edits a conditional crosschapter branch, retains conflict drafts and builds the real player', async ({ page, context }, info) => {
  test.setTimeout(60_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(editorUrl)
  const main = page.locator('[data-editor-region="main"]')
  await main.getByRole('tab', { name: '流程图', exact: true }).click()
  const panel = main.getByTestId('native-flow-editor')
  await expect(panel.getByRole('combobox', { name: 'JSON 章节' })).toHaveText('intro.chapter.json')
  await expect(panel.getByTestId('native-flow-save')).toBeDisabled()
  await selectNode(page, panel, 'node_01')
  await panel.getByLabel('对白 1 文本', { exact: true }).fill('Edited native dialogue.')
  await panel.getByLabel('布局 X', { exact: true }).fill('470')
  await panel.getByLabel('布局 X', { exact: true }).press('Tab')
  await panel.getByTestId('native-flow-undo').click()
  await panel.getByTestId('native-flow-redo').click()
  await expect(panel.getByTestId('native-node-delete')).toBeDisabled()
  await panel.getByTestId('native-flow-save').click()
  await expect.poll(async () => JSON.parse(await readFile(join(root, chapterPath), 'utf8')).nodes.find((node: any) => node.id === 'node_01').dialogues[0].text).toBe('Edited native dialogue.')
  await panel.getByRole('button', { name: '新建章节', exact: true }).click()
  await panel.getByLabel('新章节 ID', { exact: true }).fill('edited-ending')
  await panel.getByLabel('新章节标题', { exact: true }).fill('Edited ending')
  await panel.getByRole('button', { name: '创建章节草稿', exact: true }).click()
  await expect(panel.getByRole('combobox', { name: 'JSON 章节' })).toHaveText('edited-ending.chapter.json')
  const temporaryStartId = (await panel.getByTestId('native-flow-inspector').locator('.native-id').first().textContent())!.trim()
  const temporaryEndId = await panel.getByLabel('跳转目标', { exact: true }).inputValue()
  await panel.getByTestId('native-node-add').click()
  const narrationId = (await panel.getByTestId('native-flow-inspector').locator('.native-id').first().textContent())!.trim()
  await panel.getByLabel('旁白文本', { exact: true }).fill('Edited native conclusion.')
  await panel.getByRole('button', { name: '设为入口', exact: true }).click()
  await panel.getByLabel('跳转目标', { exact: true }).fill(temporaryEndId)
  await panel.getByRole('button', { name: '连接目标', exact: true }).click()
  await panel.getByRole('button', { name: '断开后继', exact: true }).click()
  await expect(panel.getByRole('combobox', { name: '后继模式', exact: true })).toHaveText('停止后继')
  await selectNode(page, panel, temporaryStartId)
  await panel.getByTestId('native-node-delete').click()
  await selectNode(page, panel, temporaryEndId)
  await panel.getByTestId('native-node-delete').click()
  await panel.getByTestId('native-flow-save').click()
  await expect.poll(async () => JSON.parse(await readFile(join(root, 'adv/chapters/edited-ending.chapter.json'), 'utf8').catch(() => '{}')).startNodeId).toBe(narrationId)
  const createdGame = JSON.parse(await readFile(join(root, 'adv/settings/game.json'), 'utf8'))
  expect(createdGame.entryChapterId).toBe('intro')
  expect(createdGame.chapters).toEqual([{ id: 'intro', sources: ['chapters/intro.chapter.json'] }, { id: 'edited-ending', title: 'Edited ending', sources: ['chapters/edited-ending.chapter.json'] }])
  await choose(page, panel.getByRole('combobox', { name: 'JSON 章节' }), 'intro.chapter.json')
  await selectNode(page, panel, 'node_02')
  await panel.getByLabel('选项 choice-1 文本', { exact: true }).fill('Edited cross-chapter route')
  await panel.getByLabel('选项 choice-1 条件', { exact: true }).fill('ready == true')
  await panel.getByLabel('选项 choice-1 目标', { exact: true }).fill(`edited-ending#${narrationId}`)
  await panel.getByLabel('选项 choice-1 目标', { exact: true }).press('Tab')
  await panel.getByTestId('native-flow-save').click()
  await expect.poll(async () => JSON.parse(await readFile(join(root, chapterPath), 'utf8')).nodes.find((node: any) => node.id === 'node_02').choices[0].target).toBe(`edited-ending#${narrationId}`)
  await assertReadableGraph(panel)
  await capturePreview(panel, info, 'native-flow-editor-normal')
  await panel.getByTestId('native-flow-overview').click()
  await capturePreview(panel, info, 'native-flow-editor-overview')
  await panel.getByTestId('native-flow-focus').click()
  const narrow = await page.addStyleTag({ content: '.native-flow-editor { width: 320px !important; max-width: 320px !important; }' })
  await expect.poll(() => panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await assertReadableGraph(panel)
  await capturePreview(panel, info, 'native-flow-editor-narrow')
  await panel.getByLabel('选项 choice-1 条件', { exact: true }).scrollIntoViewIfNeeded()
  await expect(panel.getByLabel('选项 choice-1 条件', { exact: true })).toBeInViewport()
  await capturePreview(panel, info, 'native-flow-editor-narrow-properties')
  await narrow.evaluate(element => (element as HTMLElement).remove())
  await selectNode(page, panel, 'node_01')
  await panel.getByLabel('对白 1 文本', { exact: true }).fill('Retained conflict draft')
  const saved = JSON.parse(await readFile(join(root, chapterPath), 'utf8'))
  saved.authoring.external = 'external source edit'
  await writeFile(join(root, chapterPath), `${JSON.stringify(saved, null, 2)}\n`)
  await expect(panel.getByText('项目源文件已经改变。', { exact: false })).toBeVisible()
  await expect(panel.getByLabel('对白 1 文本', { exact: true })).toHaveValue('Retained conflict draft')
  await expect(panel.getByTestId('native-flow-save')).toBeDisabled()
  await panel.getByRole('button', { name: '载入项目版本', exact: true }).click()
  const reloadDialog = page.getByRole('dialog', { name: '放弃未保存的 Flow 草稿？' })
  await capturePreview(reloadDialog, info, 'native-flow-discard-confirmation')
  await reloadDialog.getByRole('button', { name: '取消', exact: true }).click()
  await expect(panel.getByLabel('对白 1 文本', { exact: true })).toHaveValue('Retained conflict draft')
  await panel.getByRole('button', { name: '载入项目版本', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(reloadDialog).not.toBeVisible()
  await expect(panel.getByLabel('对白 1 文本', { exact: true })).toHaveValue('Retained conflict draft')
  await panel.getByRole('button', { name: '载入项目版本', exact: true }).click()
  await reloadDialog.getByRole('button', { name: '放弃草稿并载入', exact: true }).click()
  await selectNode(page, panel, 'node_01')
  await expect(panel.getByLabel('对白 1 文本', { exact: true })).toHaveValue('Edited native dialogue.')
  await page.reload()
  await main.getByRole('tab', { name: '流程图', exact: true }).click()
  await choose(page, panel.getByRole('combobox', { name: 'JSON 章节' }), 'intro.chapter.json')
  await selectNode(page, panel, 'node_02')
  await expect(panel.getByLabel('选项 choice-1 条件', { exact: true })).toHaveValue('ready == true')
  const final = JSON.parse(await readFile(join(root, chapterPath), 'utf8'))
  const originalIds = originalChapter.nodes.flatMap((node: any) => node.dialogues?.map((row: any) => row.lineId) ?? [])
  expect(final.nodes.flatMap((node: any) => node.dialogues?.map((row: any) => row.lineId) ?? [])).toEqual(originalIds)
  expect(final.nodes.map((node: any) => node.id)).toEqual(originalChapter.nodes.map((node: any) => node.id))
  expect(final.nodes.find((node: any) => node.id === 'node_01')).toMatchObject({ imagePrompt: originalChapter.nodes.find((node: any) => node.id === 'node_01').imagePrompt, position: { x: 470 } })
  expect(final.authoring.privateMarker).toBe(privateMarker)
  await advBuild({ userRoot: root })
  const player = await context.newPage()
  player.on('pageerror', error => errors.push(error.message))
  await player.goto(await servePlayer())
  await expect(player).toHaveTitle('Your Name')
  // The player follows the browser locale; Editor's locale is independent.
  const startGame = player.locator('button[data-action="start_game"]')
  await expect(startGame).toBeVisible()
  await startGame.click()
  await expect(player).toHaveURL(/\/game$/)
  await expect.poll(async () => (await playerState(player)).current?.data?.text).toBe('Edited native dialogue.')
  await player.locator('.adv-dialog-box:visible').click()
  await expect(player.locator('.dialog-content:visible')).toContainText('Edited native dialogue.')
  await expect.poll(async () => (await playerState(player)).audio.tracks.filter(track => track.status === 'playing').length).toBe(2)
  expect((await playerState(player)).current?.data?.lineId).toBe(lineId)
  await capturePreview(player, info, 'native-flow-player-edited-dialogue')
  for (let index = 0; index < 6; index++) {
    const previous = (await playerState(player)).current?.id
    for (let attempt = 0; attempt < 2 && (await playerState(player)).current?.id === previous; attempt++)
      await player.locator('.adv-dialog-box:visible').click()
  }
  await player.getByRole('button', { name: 'Edited cross-chapter route', exact: true }).click()
  await expect.poll(async () => (await playerState(player)).current?.data?.text).toBe('Edited native conclusion.')
  await expect(player.locator('.adv-black:visible')).toContainText('Edited native conclusion.')
  await expect(player.locator('.adv-black:visible .print-words .invisible')).toHaveCount(0)
  const state = await playerState(player)
  expect(state.current?.id).toBe(narrationId)
  expect(state.diagnostics.filter((issue: any) => issue.severity === 'error')).toEqual([])
  expect(state.audio.errors).toEqual([])
  expect(JSON.stringify(state.game)).not.toContain(privateMarker)
  expect(JSON.stringify(state.game)).not.toContain(originalChapter.nodes.find((node: any) => node.id === 'node_01').imagePrompt)
  await capturePreview(player, info, 'native-flow-player-cross-chapter-ending')
  const proofPath = info.outputPath('native-flow-proof.json')
  await writeFile(proofPath, JSON.stringify({ lineId, narrationId, chapterIds: state.game.chapters.map((chapter: any) => chapter.id), diagnostics: state.diagnostics, audio: state.audio, sourceIdsPreserved: true, authorMetadataPrivate: true, editorErrors: errors }, null, 2))
  await info.attach('native-flow-roundtrip-proof', { path: proofPath, contentType: 'application/json' })
  expect(errors).toEqual([])
  await player.close()
})

test('native Flow arranges dense cyclic branches without changing story semantics and keeps selected nodes readable', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const dense = {
    schemaVersion: 1,
    id: 'intro',
    title: 'Dense branch layout preview',
    startNodeId: 'hub',
    nodes: [
      { id: 'hub', type: 'choices', position: { x: 0, y: 0 }, choices: Array.from({ length: 8 }, (_, index) => ({ id: `route-${index}`, text: `Route ${index + 1}: a deliberately long, readable branch description`, target: `scene-${index}`, ...(index === 0 ? { when: 'ready == true' } : {}) })) },
      ...Array.from({ length: 7 }, (_, index) => ({ id: `scene-${index}`, type: 'narration', lineId: `line_019d137e-7abc-7000-8000-${String(index + 20).padStart(12, '0')}`, text: `Branch ${index + 1} returns to the decision after a short scene.`, position: { x: 0, y: 0 }, next: 'hub' })),
      { id: 'scene-7', type: 'choices', position: { x: 0, y: 0 }, choices: [{ id: 'loop', text: 'Stay here for another turn', target: 'scene-7' }, { id: 'finish', text: 'Finish this story', target: 'ending' }] },
      { id: 'ending', type: 'end', position: { x: 0, y: 0 } },
    ],
  }
  await writeFile(join(root, chapterPath), `${JSON.stringify(dense, null, 2)}\n`)
  await page.goto(editorUrl)
  const main = page.locator('[data-editor-region="main"]')
  await main.getByRole('tab', { name: '流程图', exact: true }).click()
  const panel = main.getByTestId('native-flow-editor')
  await selectNode(page, panel, 'hub')
  await assertReadableGraph(panel)
  await expect(panel.getByTestId('native-flow-save')).toBeDisabled()
  expect(JSON.parse(await readFile(join(root, chapterPath), 'utf8'))).toEqual(dense)
  await capturePreview(panel, info, 'native-flow-dense-selected')
  await panel.getByTitle('放大', { exact: true }).click()
  await expect(panel.getByTestId('native-flow-canvas')).toHaveAttribute('data-view-mode', 'manual')
  const manualZoom = await panel.locator('.native-zoom').textContent()
  await page.setViewportSize({ width: 1360, height: 1000 })
  await expect(panel.locator('.native-zoom')).toHaveText(manualZoom!)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await panel.getByTestId('native-flow-overview').click()
  await capturePreview(panel, info, 'native-flow-dense-overview')
  await panel.getByTestId('native-flow-arrange').click()
  await assertReadableGraph(panel)
  await expect(panel.getByTestId('native-flow-save')).toBeEnabled()
  await panel.getByTestId('native-flow-save').click()
  await expect(panel.getByText('JSON 章节已保存', { exact: true })).toBeVisible()
  await expect.poll(async () => {
    const document = JSON.parse(await readFile(join(root, chapterPath), 'utf8'))
    return new Set(document.nodes.map((node: any) => `${node.position.x}:${node.position.y}`)).size
  }).toBe(dense.nodes.length)
  await expect(panel.getByTestId('native-flow-save')).toBeDisabled()
  const saved = JSON.parse(await readFile(join(root, chapterPath), 'utf8'))
  const withoutPositions = (document: typeof dense) => document.nodes.map(({ position: _position, ...node }) => node)
  expect(withoutPositions(saved)).toEqual(withoutPositions(dense))
  expect(new Set(saved.nodes.map((node: any) => `${node.position.x}:${node.position.y}`)).size).toBe(saved.nodes.length)
  await page.reload()
  await main.getByRole('tab', { name: '流程图', exact: true }).click()
  await selectNode(page, panel, 'hub')
  await assertReadableGraph(panel)
  const narrow = await page.addStyleTag({ content: '.native-flow-editor { width: 320px !important; max-width: 320px !important; }' })
  await assertReadableGraph(panel)
  await expect.poll(() => panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await capturePreview(panel, info, 'native-flow-dense-narrow')
  await narrow.evaluate(element => (element as HTMLElement).remove())
  await page.evaluate(() => document.documentElement.classList.remove('dark'))
  await panel.getByTestId('native-flow-focus').click()
  await assertReadableGraph(panel)
  await capturePreview(panel, info, 'native-flow-dense-light')
  expect(errors).toEqual([])
})

test('native Flow reviews a deterministic proposal, previews an unsaved human tweak and roundtrips through the real player', async ({ page, context }, info) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const baseline = await readFile(join(root, chapterPath), 'utf8')
  const baselineSettings = await readFile(join(root, 'adv/settings/game.json'), 'utf8')
  const originalText = originalChapter.nodes.find((node: any) => node.id === 'node_01').dialogues[0].text
  const proposedText = 'Deterministic proposal dialogue, awaiting the author’s review.'
  const finalText = 'Human-polished native proposal dialogue.'
  const { main, panel, proposal } = await openProposal(page)
  const request = await proposalFixture(proposal, proposedText)
  await info.attach('native-flow-deterministic-proposal-fixture', { body: JSON.stringify({ kind: 'deterministic JSON fixture; no external model invocation', request }, null, 2), contentType: 'application/json' })

  const review = await reviewProposal(proposal, request)
  await expect(review).toContainText('校验通过，尚未写入文件')
  await expect(review).toContainText('node_01')
  await expect(review).toContainText('title')
  await expect(proposal.getByTestId('native-proposal-load')).toBeEnabled()
  await review.getByText('查看源文件差异', { exact: true }).click()
  const diff = review.locator('.proposal-diff')
  await expect(diff.locator('pre')).toHaveCount(2)
  await expect(diff.locator('pre').first()).toHaveText(baseline)
  const proposedDocument = JSON.parse((await diff.locator('pre').last().textContent())!)
  expect(proposedDocument.nodes.find((node: any) => node.id === 'node_01').dialogues[0]).toMatchObject({ lineId, text: proposedText })
  await expect(diff.locator('input, textarea, [contenteditable="true"]')).toHaveCount(0)
  await expect(panel.getByLabel('对白 1 文本', { exact: true })).toHaveValue(originalText)
  await expect(panel.getByTestId('native-flow-save')).toBeDisabled()
  expect(await readFile(join(root, chapterPath), 'utf8')).toBe(baseline)
  expect(await readFile(join(root, 'adv/settings/game.json'), 'utf8')).toBe(baselineSettings)
  await expect(review.getByTestId('native-proposal-line-diff')).toContainText(proposedText)
  await review.getByText('查看源文件差异', { exact: true }).click()
  await proposal.evaluate((element) => {
    element.scrollTop = 0
  })
  await capturePreview(panel, info, 'native-flow-proposal-review-normal')
  const narrow = await page.addStyleTag({ content: '.native-flow-editor { width: 320px !important; max-width: 320px !important; }' })
  await expect.poll(async () => Math.round((await panel.boundingBox())!.width)).toBe(320)
  await expect.poll(() => panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await expect.poll(() => proposal.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await capturePreview(panel, info, 'native-flow-proposal-review-narrow')
  await narrow.evaluate(element => (element as HTMLElement).remove())

  await review.getByRole('button', { name: '取消比较', exact: true }).click()
  await expect(review).not.toBeVisible()
  await expect(panel.getByTestId('native-flow-undo')).toBeDisabled()
  await expect(panel.getByLabel('对白 1 文本', { exact: true })).toHaveValue(originalText)
  expect(await readFile(join(root, chapterPath), 'utf8')).toBe(baseline)
  await proposal.getByTestId('native-proposal-review').click()
  await expect(review).toContainText('校验通过，尚未写入文件')
  await proposal.getByTestId('native-proposal-load').click()
  await expect(panel.getByLabel('对白 1 文本', { exact: true })).toHaveValue(proposedText)
  await expect(panel.getByLabel('章节标题', { exact: true })).toHaveValue('Reviewed proposal introduction')
  await expect(panel.getByTestId('native-flow-save')).toBeEnabled()
  expect(await readFile(join(root, chapterPath), 'utf8')).toBe(baseline)

  // Both proposal commands are adopted as one reversible authoring operation.
  await panel.getByTestId('native-flow-undo').click()
  await expect(panel.getByLabel('对白 1 文本', { exact: true })).toHaveValue(originalText)
  await expect(panel.getByLabel('章节标题', { exact: true })).toHaveValue(originalChapter.title)
  await expect(panel.getByTestId('native-flow-undo')).toBeDisabled()
  await expect(panel.getByTestId('native-flow-save')).toBeDisabled()
  await panel.getByTestId('native-flow-redo').click()
  await expect(panel.getByLabel('对白 1 文本', { exact: true })).toHaveValue(proposedText)
  await expect(panel.getByLabel('章节标题', { exact: true })).toHaveValue('Reviewed proposal introduction')
  await expect(proposal.getByTestId('native-proposal-review')).toBeDisabled()
  await expect(proposal.getByTestId('native-proposal-template')).toBeDisabled()
  await expect(proposal).toContainText('当前有未保存草稿')
  await panel.getByLabel('对白 1 文本', { exact: true }).fill(finalText)
  await expect(panel.getByTestId('native-flow-preview')).toBeEnabled()
  await capturePreview(panel, info, 'native-flow-proposal-human-draft')

  await panel.getByTestId('native-flow-preview').click()
  const scene = main.getByRole('tabpanel', { name: '游戏', exact: true })
  await expect(scene).toBeVisible()
  await expect(scene.getByTestId('flow-draft-preview-banner')).toContainText('Flow 草稿试玩 · 未写入源文件')
  await expect.poll(async () => (await editorPlayerState(page)).current?.data?.text).toBe(finalText)
  const draftPlayback = await editorPlayerState(page)
  expect(draftPlayback.current?.data?.lineId).toBe(lineId)
  await expect(scene.locator('.adv-dialog-box:visible')).toContainText(finalText)
  await expect.poll(() => scene.locator('.adv-dialog-box:visible .print-words > span').evaluateAll(elements => elements.length > 0 && elements.every(element => getComputedStyle(element).visibility === 'visible' && getComputedStyle(element).opacity === '1'))).toBe(true)
  await capturePreview(scene, info, 'native-flow-proposal-unsaved-player')
  expect(await readFile(join(root, chapterPath), 'utf8')).toBe(baseline)
  expect(await readFile(join(root, 'adv/settings/game.json'), 'utf8')).toBe(baselineSettings)

  await scene.getByRole('button', { name: '返回 Flow 编辑', exact: true }).click()
  await expect(panel.getByLabel('对白 1 文本', { exact: true })).toHaveValue(finalText)
  await panel.getByTestId('native-flow-save').click()
  await expect(panel.getByText('JSON 章节已保存', { exact: true })).toBeVisible()
  await expect(panel.getByTestId('native-flow-save')).toBeDisabled()
  const saved = JSON.parse(await readFile(join(root, chapterPath), 'utf8'))
  const expected = structuredClone(originalChapter)
  expected.title = 'Reviewed proposal introduction'
  expected.nodes.find((node: any) => node.id === 'node_01').dialogues[0].text = finalText
  expect(saved).toEqual(expected)
  expect(await readFile(join(root, 'adv/settings/game.json'), 'utf8')).toBe(baselineSettings)
  await page.reload()
  await main.getByRole('tab', { name: '流程图', exact: true }).click()
  await selectNode(page, panel, 'node_01')
  await expect(panel.getByLabel('对白 1 文本', { exact: true })).toHaveValue(finalText)
  await expect(panel.getByLabel('章节标题', { exact: true })).toHaveValue('Reviewed proposal introduction')
  await expect(panel.getByTestId('native-flow-save')).toBeDisabled()
  await capturePreview(panel, info, 'native-flow-proposal-reopened')

  await advBuild({ userRoot: root })
  const player = await context.newPage()
  player.on('pageerror', error => errors.push(error.message))
  await player.goto(await servePlayer())
  await player.locator('button[data-action="start_game"]').click()
  await expect(player).toHaveURL(/\/game$/)
  await expect.poll(async () => (await playerState(player)).current?.data?.text).toBe(finalText)
  const playback = await playerState(player)
  expect(playback.current?.data?.lineId).toBe(lineId)
  expect(playback.diagnostics.filter((issue: any) => issue.severity === 'error')).toEqual([])
  expect(JSON.stringify(playback.game)).not.toContain(privateMarker)
  expect(JSON.stringify(playback.game)).not.toContain(originalChapter.nodes.find((node: any) => node.id === 'node_01').imagePrompt)
  await expect(player.locator('.adv-dialog-box:visible')).toContainText(finalText)
  await expect.poll(() => player.locator('.adv-dialog-box:visible .print-words > span').evaluateAll(elements => elements.length > 0 && elements.every(element => getComputedStyle(element).visibility === 'visible' && getComputedStyle(element).opacity === '1'))).toBe(true)
  await capturePreview(player, info, 'native-flow-proposal-saved-player')
  await info.attach('native-flow-proposal-roundtrip-proof', {
    body: JSON.stringify({ fixture: 'deterministic JSON; no external model invocation', request, lineId, proposedText, finalText, draftPlayback, savedPlayback: { current: playback.current, status: playback.status, diagnostics: playback.diagnostics }, reviewAndPreviewKeptDiskUnchanged: true, adoptionUndoneInOneStep: true, onlyApprovedFieldsChanged: true, editorErrors: errors }, null, 2),
    contentType: 'application/json',
  })
  expect(errors).toEqual([])
  await player.close()
})

test('native Flow highlights exact readonly proposal JSON, copies each source and keeps narrow previews contained', async ({ page, context, browserName }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const baseline = await readFile(join(root, chapterPath), 'utf8')
  const baselineSettings = await readFile(join(root, 'adv/settings/game.json'), 'utf8')
  const originalText = originalChapter.nodes.find((node: any) => node.id === 'node_01').dialogues[0].text
  // Inert HTML-like story text must stay escaped text, including JSON quotes,
  // backslashes and newlines. The long line also exercises code-only scrolling.
  const proposedText = `<span data-json-preview-injection="true">literal < & > text</span> & "quoted" \\ path\n${'preview-scroll-'.repeat(24)}`
  const expected = structuredClone(originalChapter)
  expected.title = 'Reviewed proposal introduction'
  expected.nodes.find((node: any) => node.id === 'node_01').dialogues[0].text = proposedText
  const afterJson = `${JSON.stringify(expected, null, 2)}\n`
  const copied: string[] = []
  if (browserName === 'chromium') {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(editorUrl).origin })
  }
  else {
    // WebKit has no Playwright clipboard permission grant. Only its clipboard
    // boundary is stubbed; rendering, Shiki, review and file checks remain real.
    await page.exposeFunction('recordJsonPreviewClipboard', (text: string) => copied.push(text))
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: (text: string) => (window as unknown as { recordJsonPreviewClipboard: (text: string) => Promise<void> }).recordJsonPreviewClipboard(text) },
      })
    })
  }
  const { panel, proposal } = await openProposal(page)
  const request = await proposalFixture(proposal, proposedText)
  const review = await reviewProposal(proposal, request)
  await expect(review).toContainText('校验通过，尚未写入文件')
  const source = review.getByTestId('native-proposal-source-diff')
  const before = source.getByTestId('native-proposal-before-json')
  const after = source.getByTestId('native-proposal-after-json')
  await expect(source).not.toHaveAttribute('open', '')
  await expect(before).toHaveCount(0)
  await expect(after).toHaveCount(0)
  await source.getByText('查看源文件差异', { exact: true }).click()
  await expect(source).toHaveAttribute('open', '')
  for (const [preview, raw, title] of [[before, baseline, '当前版本'], [after, afterJson, '提案版本']] as const) {
    await expect(preview.getByText('JSON · 只读', { exact: true })).toBeVisible()
    // textContent, unlike toHaveText, preserves every whitespace byte.
    await expect.poll(() => preview.locator('pre').textContent()).toBe(raw)
    await expect(preview.getByRole('region', { name: `${title} JSON 只读源码`, exact: true })).toHaveAttribute('tabindex', '0')
    await expect.poll(() => preview.locator('pre code span[style]').evaluateAll(elements => new Set(elements.filter(element => element.textContent?.trim()).map(element => getComputedStyle(element).color).filter(color => color && color !== 'rgba(0, 0, 0, 0)')).size)).toBeGreaterThan(1)
    await expect(preview.locator('input, textarea, [contenteditable="true"], .monaco-editor, .cm-editor')).toHaveCount(0)
    await expect(preview.locator('[data-json-preview-injection], img, script, iframe')).toHaveCount(0)
    await preview.getByRole('button', { name: `复制${title} JSON`, exact: true }).click()
    await expect(preview.getByRole('status')).toHaveText(`已复制${title} JSON`)
    if (browserName === 'chromium')
      await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(raw)
    else
      expect(copied.at(-1)).toBe(raw)
  }
  if (browserName !== 'chromium')
    expect(copied).toEqual([baseline, afterJson])
  await expect(review.locator('[data-json-preview-injection]')).toHaveCount(0)
  await expect(panel.getByLabel('对白 1 文本', { exact: true })).toHaveValue(originalText)
  await expect(panel.getByTestId('native-flow-save')).toBeDisabled()
  await expect(panel.getByTestId('native-flow-undo')).toBeDisabled()
  expect(await readFile(join(root, chapterPath), 'utf8')).toBe(baseline)
  expect(await readFile(join(root, 'adv/settings/game.json'), 'utf8')).toBe(baselineSettings)

  // The proposal panel scrolls independently and is limited to 45% height.
  // Position real rendered code inside it before taking each screenshot.
  await before.evaluate(element => element.scrollIntoView({ block: 'start', inline: 'nearest' }))
  await expect(before.locator('pre')).toBeInViewport({ ratio: 0.5 })
  await capturePreview(panel, info, 'native-flow-json-preview-dark')
  const darkKeyColor = await before.locator('pre code span[style]').filter({ hasText: 'schemaVersion' }).first().evaluate(element => getComputedStyle(element).color)
  await page.evaluate(() => document.documentElement.classList.remove('dark'))
  await expect.poll(() => before.locator('pre code span[style]').filter({ hasText: 'schemaVersion' }).first().evaluate(element => getComputedStyle(element).color)).not.toBe(darkKeyColor)
  await capturePreview(panel, info, 'native-flow-json-preview-light')
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  const narrow = await page.addStyleTag({ content: '.native-flow-editor { width: 320px !important; max-width: 320px !important; }' })
  await expect.poll(async () => Math.round((await panel.boundingBox())!.width)).toBe(320)
  for (const container of [panel, proposal, source, before, after])
    await expect.poll(() => container.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  for (const [preview, name] of [[before, 'current'], [after, 'proposed']] as const) {
    const code = preview.locator('pre')
    await expect.poll(() => code.evaluate(element => element.scrollWidth > element.clientWidth && element.scrollHeight > element.clientHeight && ['auto', 'scroll'].includes(getComputedStyle(element).overflowX))).toBe(true)
    await code.evaluate((element) => {
      element.scrollLeft = 64
    })
    await expect.poll(() => code.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
    await code.evaluate((element) => {
      element.scrollLeft = 0
    })
    await preview.evaluate(element => element.scrollIntoView({ block: 'start', inline: 'nearest' }))
    await expect(code).toBeInViewport({ ratio: 0.5 })
    await capturePreview(panel, info, `native-flow-json-preview-narrow-${name}`)
  }
  await narrow.evaluate(element => (element as HTMLElement).remove())
  await source.getByText('查看源文件差异', { exact: true }).click()
  await expect(before).toHaveCount(0)
  await expect(after).toHaveCount(0)
  await source.getByText('查看源文件差异', { exact: true }).click()
  await expect.poll(() => after.locator('pre').textContent()).toBe(afterJson)
  await expect.poll(() => after.locator('pre code span[style]').count()).toBeGreaterThan(0)
  await review.getByRole('button', { name: '取消比较', exact: true }).click()
  await expect(review).not.toBeVisible()
  await expect(panel.getByLabel('对白 1 文本', { exact: true })).toHaveValue(originalText)
  await proposal.getByTestId('native-proposal-review').click()
  await expect(review).toContainText('校验通过，尚未写入文件')
  await expect(source).not.toHaveAttribute('open', '')
  await expect(before).toHaveCount(0)
  await source.getByText('查看源文件差异', { exact: true }).click()
  await expect.poll(() => before.locator('pre').textContent()).toBe(baseline)
  await expect.poll(() => after.locator('pre').textContent()).toBe(afterJson)
  await expect(panel.getByTestId('native-flow-save')).toBeDisabled()
  await expect(panel.getByTestId('native-flow-undo')).toBeDisabled()
  expect(await readFile(join(root, chapterPath), 'utf8')).toBe(baseline)
  expect(await readFile(join(root, 'adv/settings/game.json'), 'utf8')).toBe(baselineSettings)
  await info.attach('native-flow-json-preview-proof', {
    body: JSON.stringify({ fixture: 'deterministic JSON; inert HTML-like text; no external model invocation', clipboardBoundary: browserName === 'chromium' ? 'real browser clipboard read/write with origin-scoped permissions' : 'writeText stub only; WebKit has no clipboard permission grant', request, exactSourcePreserved: true, syntaxTokensRendered: true, readonly: true, narrowOverflowContained: true, diskAndDraftUnchanged: true, closeReopenAndCancelReReview: true, editorErrors: errors }, null, 2),
    contentType: 'application/json',
  })
  expect(errors).toEqual([])
})

test('native Flow rejects malformed, invalid and stale proposals without replacing an existing draft', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const baseline = await readFile(join(root, chapterPath), 'utf8')
  const originalText = originalChapter.nodes.find((node: any) => node.id === 'node_01').dialogues[0].text
  const { panel, proposal } = await openProposal(page)
  const request = await proposalFixture(proposal, 'A valid proposal that must not overwrite a dirty draft.')
  const invalid = { ...request, commands: [{ type: 'connect', nodeId: 'node_02', choiceId: 'choice-1', target: 'missing-proposal-target' }] }
  const review = await reviewProposal(proposal, invalid)
  await expect(review).toContainText('存在错误，不能载入草稿')
  await expect(review).toContainText('ADV_RUNTIME_UNKNOWN_TARGET')
  await expect(proposal.getByTestId('native-proposal-load')).toBeDisabled()
  await expect(panel.getByLabel('对白 1 文本', { exact: true })).toHaveValue(originalText)
  await expect(panel.getByTestId('native-flow-save')).toBeDisabled()
  await capturePreview(panel, info, 'native-flow-proposal-invalid-diagnostics')
  expect(await readFile(join(root, chapterPath), 'utf8')).toBe(baseline)

  // Existing dialogue edits must use stable lineId, never positional indexes.
  await reviewProposal(proposal, { ...request, commands: [{ type: 'update-dialogue', nodeId: 'node_01', index: 0, patch: { text: 'Rejected positional proposal' } }] })
  await expect(panel.getByRole('alert')).toContainText('ADV_FLOW_PROPOSAL_INVALID')
  await expect(review).not.toBeVisible()
  await expect(panel.getByTestId('native-flow-save')).toBeDisabled()
  for (const revision of ['expectedRevision', 'projectRevision'] as const) {
    await reviewProposal(proposal, { ...request, [revision]: `${revision === 'projectRevision' ? 'sha256:' : ''}${'0'.repeat(64)}` })
    await expect(panel.getByRole('alert')).toContainText('ADV_FLOW_SOURCE_CONFLICT')
    await expect(review).not.toBeVisible()
    await expect(panel.getByLabel('对白 1 文本', { exact: true })).toHaveValue(originalText)
  }
  await reviewProposal(proposal, request)
  await expect(review).toContainText('校验通过，尚未写入文件')
  await panel.getByLabel('对白 1 文本', { exact: true }).fill('Existing human draft must survive proposal actions.')
  await expect(proposal.getByTestId('native-proposal-review')).toBeDisabled()
  await expect(proposal.getByTestId('native-proposal-load')).toBeDisabled()
  await expect(proposal.getByTestId('native-proposal-template')).toBeDisabled()
  await expect(proposal).toContainText('当前有未保存草稿')
  await review.getByRole('button', { name: '取消比较', exact: true }).click()
  await expect(panel.getByLabel('对白 1 文本', { exact: true })).toHaveValue('Existing human draft must survive proposal actions.')
  await expect(panel.getByTestId('native-flow-save')).toBeEnabled()
  expect(await readFile(join(root, chapterPath), 'utf8')).toBe(baseline)
  await capturePreview(panel, info, 'native-flow-proposal-dirty-draft-preserved')
  expect(errors).toEqual([])
})

for (const changedSource of ['chapter', 'dependency'] as const) {
  test(`native Flow preserves an adopted proposal draft when its ${changedSource} changes before save`, async ({ page }, info) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    const baseline = await readFile(join(root, chapterPath), 'utf8')
    const settingsPath = join(root, 'adv/settings/game.json')
    const baselineSettings = await readFile(settingsPath, 'utf8')
    const { panel, proposal } = await openProposal(page)
    const retainedText = `Retained proposal after external ${changedSource} change.`
    const request = await proposalFixture(proposal, retainedText)
    const review = await reviewProposal(proposal, request)
    await expect(review).toContainText('校验通过，尚未写入文件')
    await proposal.getByTestId('native-proposal-load').click()
    await expect(panel.getByLabel('对白 1 文本', { exact: true })).toHaveValue(retainedText)
    await expect(panel.getByTestId('native-flow-save')).toBeEnabled()
    const changedPath = changedSource === 'chapter' ? join(root, chapterPath) : settingsPath
    const external = JSON.parse(changedSource === 'chapter' ? baseline : baselineSettings)
    if (changedSource === 'chapter')
      external.authoring.external = 'Independent source edit after proposal adoption'
    else
      external.variables.externalProposalRevision = 'Independent settings edit after proposal adoption'
    const externalContent = `${JSON.stringify(external, null, 2)}\n`
    await writeFile(changedPath, externalContent)
    if (changedSource === 'chapter') {
      await expect(panel.getByText('项目源文件已经改变。', { exact: false })).toBeVisible()
      await expect(panel.getByTestId('native-flow-save')).toBeDisabled()
    }
    else {
      await panel.getByTestId('native-flow-save').click()
      await expect(panel.getByRole('alert')).toContainText('ADV_FLOW_SOURCE_CONFLICT')
    }
    await expect(panel.getByLabel('对白 1 文本', { exact: true })).toHaveValue(retainedText)
    await expect(panel.getByLabel('章节标题', { exact: true })).toHaveValue('Reviewed proposal introduction')
    expect(await readFile(changedPath, 'utf8')).toBe(externalContent)
    expect(await readFile(changedSource === 'chapter' ? settingsPath : join(root, chapterPath), 'utf8')).toBe(changedSource === 'chapter' ? baselineSettings : baseline)
    await capturePreview(panel, info, `native-flow-proposal-${changedSource}-conflict`)
    await panel.getByRole('button', { name: '载入项目版本', exact: true }).click()
    await page.getByRole('dialog', { name: '放弃未保存的 Flow 草稿？' }).getByRole('button', { name: '取消', exact: true }).click()
    await expect(panel.getByLabel('对白 1 文本', { exact: true })).toHaveValue(retainedText)
    await panel.getByLabel('对白 1 文本', { exact: true }).fill(`${retainedText} Still editable.`)
    await expect(panel.getByLabel('对白 1 文本', { exact: true })).toHaveValue(`${retainedText} Still editable.`)
    expect(await readFile(changedPath, 'utf8')).toBe(externalContent)
    await info.attach(`native-flow-proposal-${changedSource}-conflict-proof`, { body: JSON.stringify({ request, changedSource, draftRetained: true, externalSourcePreserved: true, editorErrors: errors }, null, 2), contentType: 'application/json' })
    expect(errors).toEqual([])
  })
}
