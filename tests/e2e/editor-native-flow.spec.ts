import type { Locator, Page } from '@playwright/test'
import type { EditorBridge } from 'advjs/node'
import type { AdvContext } from '../../packages/client/types/context'
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, join, relative, resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { advBuild, createEditorBridge } from 'advjs/node'

const repositoryRoot = resolve(import.meta.dirname, '../..')
const artifactRoot = join(tmpdir(), 'advjs-editor-native-flow-artifacts')
const chapterPath = 'adv/chapters/intro.chapter.json'
const lineId = 'line_019d137e-7abc-7000-8000-000000000001'
const privateMarker = 'PRIVATE-NATIVE-FLOW-AUTHOR-METADATA'
let directory: string
let root: string
let editorUrl: string
let bridge: EditorBridge
let playerServer: ReturnType<typeof createServer> | undefined
let originalChapter: any

async function choose(page: Page, locator: Locator, value: string) {
  await locator.click()
  await page.getByRole('option', { name: value, exact: true }).click()
}
async function selectNode(page: Page, panel: Locator, id: string) {
  await panel.getByRole('combobox', { name: '选中节点', exact: true }).click()
  await page.getByRole('option').filter({ hasText: new RegExp(` · ${id}$`, 'u') }).click()
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
  await mkdir(artifactRoot, { recursive: true })
})
test.afterEach(async () => {
  await bridge?.stop()
  if (playerServer) {
    playerServer.closeAllConnections()
    await new Promise<void>(resolve => playerServer!.close(() => resolve()))
    playerServer = undefined
  }
  await rm(directory, { recursive: true, force: true })
})

test('native JSON Flow creates and edits a conditional crosschapter branch, retains conflict drafts and builds the real player', async ({ page, context }, info) => {
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
  await panel.screenshot({ path: join(artifactRoot, `native-flow-normal-${info.project.name}.png`), animations: 'disabled' })
  const narrow = await page.addStyleTag({ content: '.native-flow-editor { width: 320px !important; max-width: 320px !important; }' })
  await expect.poll(() => panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await panel.screenshot({ path: join(artifactRoot, `native-flow-narrow-${info.project.name}.png`), animations: 'disabled' })
  await panel.getByLabel('选项 choice-1 条件', { exact: true }).scrollIntoViewIfNeeded()
  await expect(panel.getByLabel('选项 choice-1 条件', { exact: true })).toBeInViewport()
  await panel.screenshot({ path: join(artifactRoot, `native-flow-narrow-properties-${info.project.name}.png`), animations: 'disabled' })
  await narrow.evaluate(element => element.remove())
  await selectNode(page, panel, 'node_01')
  await panel.getByLabel('对白 1 文本', { exact: true }).fill('Retained conflict draft')
  const saved = JSON.parse(await readFile(join(root, chapterPath), 'utf8'))
  saved.authoring.external = 'external source edit'
  await writeFile(join(root, chapterPath), `${JSON.stringify(saved, null, 2)}\n`)
  await expect(panel.getByText('项目源文件已经改变。', { exact: false })).toBeVisible()
  await expect(panel.getByLabel('对白 1 文本', { exact: true })).toHaveValue('Retained conflict draft')
  await expect(panel.getByTestId('native-flow-save')).toBeDisabled()
  await panel.getByRole('button', { name: '载入项目版本', exact: true }).click()
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
  await player.locator('[data-action="start_game"]').click()
  await expect.poll(async () => (await playerState(player)).current?.data?.text).toBe('Edited native dialogue.')
  await player.locator('.adv-dialog-box:visible').click()
  await expect(player.locator('.dialog-content:visible')).toContainText('Edited native dialogue.')
  await expect.poll(async () => (await playerState(player)).audio.tracks.filter(track => track.status === 'playing').length).toBe(2)
  expect((await playerState(player)).current?.data?.lineId).toBe(lineId)
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
  await player.screenshot({ path: join(artifactRoot, `native-flow-player-${info.project.name}.png`), animations: 'disabled' })
  await writeFile(join(artifactRoot, `native-flow-proof-${info.project.name}.json`), JSON.stringify({ lineId, narrationId, chapterIds: state.game.chapters.map((chapter: any) => chapter.id), diagnostics: state.diagnostics, audio: state.audio, sourceIdsPreserved: true, authorMetadataPrivate: true, editorErrors: errors }, null, 2))
  expect(errors).toEqual([])
  await player.close()
})
