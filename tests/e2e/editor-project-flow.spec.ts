import type { Locator, Page, TestInfo } from '@playwright/test'
import type { EditorBridge } from '../../packages/advjs/node/editor'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { expect, test } from '@playwright/test'
import { createEditorBridge } from '../../packages/advjs/node/editor'

const repositoryRoot = resolve(import.meta.dirname, '../..')
const startPath = 'adv/chapters/start.adv.md'
const resultPath = 'adv/chapters/result.adv.md'
const startContent = [
  '## 岔路 {#start}',
  '',
  '@小雨',
  '原稿：信中的地址通向两条路。',
  '',
  '- [去图书馆](result#arrival)',
  '- [留在房间](#stay)',
  '',
  '## 留下 {#stay}',
  '',
  '@小雨',
  '我在房间等待回信。',
  '',
  '```yaml',
  'type: end',
  '```',
  '',
].join('\n')
const resultContent = [
  '## 抵达图书馆 {#arrival}',
  '',
  '@小雨',
  '图书馆里有一封新的信。',
  '',
  '```yaml',
  'type: end',
  '```',
  '',
].join('\n')

let bridge: EditorBridge | undefined
let editorUrl = ''
let temporaryRoot = ''
let projectRoot = ''

test.beforeEach(async ({ page }) => {
  temporaryRoot = await mkdtemp(join(tmpdir(), 'advjs-project-flow-'))
  projectRoot = join(temporaryRoot, 'project')
  await cp(join(repositoryRoot, 'tests/launch/fixtures/golden-project'), projectRoot, { recursive: true })
  await rm(join(projectRoot, 'adv/chapters/chapter_01.adv.md'))
  await mkdir(join(projectRoot, 'adv/assets'), { recursive: true })
  await writeFile(join(projectRoot, 'adv/assets/room.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#496b87"/></svg>')
  await writeFile(join(projectRoot, 'adv/assets.json'), JSON.stringify({ schemaVersion: 2, id: 'project-flow', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'adv/assets' } }, assets: [{ id: 'room', kind: 'background', type: 'image', path: 'room.svg' }] }))
  await writeFile(join(projectRoot, 'game.config.json'), JSON.stringify({ id: 'project-flow', title: '分支图验收项目', entryChapterId: 'start', chapters: [{ id: 'start', title: '开端', sources: ['chapters/start.adv.md'] }, { id: 'result', title: '回信', sources: ['chapters/result.adv.md'] }] }))
  await writeFile(join(projectRoot, startPath), startContent)
  await writeFile(join(projectRoot, resultPath), resultContent)
  bridge = await createEditorBridge({ host: '127.0.0.1', port: 0, projectRoot, publicRoot: join(repositoryRoot, 'editor/core/dist') })
  editorUrl = (await bridge.start()).url
  await page.addInitScript(() => {
    localStorage.setItem('advjs:editor:locale', 'zh-CN')
    localStorage.setItem('advjs:editor:onboarded', 'true')
    if (!localStorage.getItem('nuxt-color-mode'))
      localStorage.setItem('nuxt-color-mode', 'dark')
  })
  await page.setViewportSize({ width: 1440, height: 900 })
})

test.afterEach(async () => {
  await bridge?.stop()
  bridge = undefined
  if (temporaryRoot)
    await rm(temporaryRoot, { recursive: true, force: true })
})

async function editorState(page: Page) {
  return page.evaluate(() => {
    const root = document.getElementById('__nuxt') as HTMLElement & {
      __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, unknown> } } } }
    }
    const stores = root.__vue_app__.config.globalProperties.$pinia._s
    const file = stores.get('file') as { openedFilePath: string, isDirty: boolean }
    const monaco = stores.get('@advjs/editor:monaco') as { fileContent: string, positions: Record<string, { lineNumber: number, column: number }> }
    const project = stores.get('@advjs/editor:project') as { chapters: { id: string }[], diagnostics: { code: string, severity: string }[] }
    const flow = stores.get('flow') as { graph?: { nodes: { id: string, chapterId?: string }[], edges: { id: string, source: string, target: string, label?: string }[] } }
    return {
      path: file.openedFilePath,
      dirty: file.isDirty,
      draft: monaco.fileContent,
      position: monaco.positions[file.openedFilePath],
      chapters: project.chapters.map(chapter => chapter.id),
      diagnostics: project.diagnostics.map(item => ({ code: item.code, severity: item.severity })),
      nodes: flow?.graph?.nodes.map(node => ({ id: node.id, chapterId: node.chapterId })) ?? [],
      edges: flow?.graph?.edges.map(edge => ({ id: edge.id, source: edge.source, target: edge.target, label: edge.label })) ?? [],
    }
  })
}

async function openFlow(page: Page) {
  await page.goto(editorUrl)
  await expect(page).toHaveTitle(/ADV.JS/)
  await expect(page.locator('.advjs-editor-layout')).toBeVisible()
  await expect.poll(async () => (await editorState(page)).chapters).toEqual(['start', 'result'])
  const main = page.locator('[data-editor-region="main"]')
  await main.getByRole('tab', { name: '流程图', exact: true }).click()
  const flow = main.locator('.advjs-flow-editor')
  await expect(flow.locator('[data-flow-node-id]').first()).toBeVisible()
  await flow.getByRole('button', { name: '全部剧情详情', exact: true }).click()
  return { main, flow }
}

async function expectSource(page: Page, path: string, line: number) {
  const main = page.locator('[data-editor-region="main"]')
  await expect(main.getByRole('tab', { name: '文件', exact: true })).toHaveAttribute('data-state', 'active')
  await expect(main.locator('.file-source .monaco-editor')).toBeVisible()
  await expect(main.getByRole('button', { name: '源码', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(async () => (await editorState(page)).path).toBe(path)
  await expect.poll(async () => (await editorState(page)).position?.lineNumber).toBe(line)
  await expect(main.locator('.file-source').getByRole('textbox', { name: 'Editor content', exact: true })).toBeFocused()
}

async function screenshot(page: Page, info: TestInfo, name: string, flowOnly = false) {
  const directory = process.env.ADVJS_LAYOUT_SCREENSHOTS || join(tmpdir(), 'advjs-project-flow-artifacts')
  await mkdir(directory, { recursive: true })
  const target = flowOnly ? page.locator('.advjs-flow-editor') : page
  await target.screenshot({ path: join(directory, `${name}-${info.project.name}.png`), animations: 'disabled' })
}

async function expectSeparatedNodes(flow: Locator) {
  await expect.poll(() => flow.locator('[data-flow-node-id]').evaluateAll((elements) => {
    const nodes = elements.map(element => ({ id: element.getAttribute('data-flow-node-id'), bounds: element.getBoundingClientRect() }))
    const overlaps: string[] = []
    for (let index = 0; index < nodes.length; index++) {
      const node = nodes[index]!
      for (const other of nodes.slice(index + 1)) {
        const horizontal = Math.min(node.bounds.right, other.bounds.right) - Math.max(node.bounds.left, other.bounds.left)
        const vertical = Math.min(node.bounds.bottom, other.bounds.bottom) - Math.max(node.bounds.top, other.bounds.top)
        if (horizontal > 1 && vertical > 1)
          overlaps.push(`${node.id} / ${other.id}`)
      }
    }
    return overlaps
  })).toEqual([])
}

async function expectFittedNodes(flow: Locator) {
  await expect.poll(() => flow.evaluate((element) => {
    const canvas = element.querySelector('.flow-canvas')!.getBoundingClientRect()
    return Array.from(element.querySelectorAll('[data-flow-node-id]')).every((node) => {
      const bounds = node.getBoundingClientRect()
      return bounds.left >= canvas.left - 1 && bounds.right <= canvas.right + 1
        && bounds.top >= canvas.top - 1 && bounds.bottom <= canvas.bottom + 1
    })
  })).toBe(true)
}

async function expectRenderedNodeIcons(flow: Locator) {
  const nodes = flow.locator('[data-flow-node-id]')
  await expect(flow.locator('[data-flow-icon]')).toHaveCount(await nodes.count())
  expect(await flow.locator('[data-flow-icon]').evaluateAll(elements => elements.map((element) => {
    const style = getComputedStyle(element)
    return style.maskImage !== 'none' && Number.parseFloat(style.width) > 0 && Number.parseFloat(style.height) > 0
  }))).not.toContain(false)
}

test('projects the actual chapters, choices, cross-chapter targets and source lines with keyboard navigation', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error')
      errors.push(message.text())
  })
  const { main, flow } = await openFlow(page)
  await expect(flow.locator('[data-flow-kind="chapter"]')).toHaveCount(2)
  await expect(flow.locator('[data-flow-kind="choice"]')).toHaveCount(2)
  await expect(flow.locator('[data-flow-summary]')).toContainText('静态可达')
  await expect(flow.locator('[data-flow-summary]')).not.toContainText('覆盖率')
  await expect(flow.locator('[data-flow-source="adv/chapters/start.adv.md"]').first()).toBeVisible()
  const state = await editorState(page)
  const nodeIds = state.nodes.map(node => node.id)
  expect(state.edges.length).toBeGreaterThan(0)
  expect(state.edges.every(edge => nodeIds.includes(edge.source) && nodeIds.includes(edge.target))).toBe(true)
  expect(state.edges.some(edge => state.nodes.find(node => node.id === edge.source)?.chapterId === 'start' && state.nodes.find(node => node.id === edge.target)?.chapterId === 'result')).toBe(true)
  expect(state.diagnostics.filter(item => item.severity === 'error')).toEqual([])
  const automatic = flow.getByRole('button', { name: '自动排版', exact: true })
  const horizontal = flow.getByRole('button', { name: '水平布局', exact: true })
  const vertical = flow.getByRole('button', { name: '垂直布局', exact: true })
  await automatic.click()
  await expect(horizontal).toHaveAttribute('aria-pressed', 'true')
  await expect(vertical).toHaveAttribute('aria-pressed', 'false')
  await expectSeparatedNodes(flow)
  await expectFittedNodes(flow)
  await expectRenderedNodeIcons(flow)
  const typeIcons = await flow.locator('[data-flow-node-id]').evaluateAll(elements => Object.fromEntries(elements.map(element => [
    element.getAttribute('data-flow-kind') === 'story' ? element.getAttribute('data-flow-runtime-kind') : element.getAttribute('data-flow-kind'),
    element.querySelector('[data-flow-icon]')?.getAttribute('data-flow-icon'),
  ])))
  expect(new Set(['chapter', 'anchor', 'dialog', 'choices', 'choice', 'end'].map(kind => typeIcons[kind])).size).toBe(6)
  await vertical.click()
  await expect(vertical).toHaveAttribute('aria-pressed', 'true')
  await expect(horizontal).toHaveAttribute('aria-pressed', 'false')
  await expectSeparatedNodes(flow)
  await expectFittedNodes(flow)
  await automatic.click()
  await expect(vertical).toHaveAttribute('aria-pressed', 'true')
  await expectFittedNodes(flow)
  await screenshot(page, info, 'project-flow-desktop-vertical-dark')
  await horizontal.click()
  await expect(horizontal).toHaveAttribute('aria-pressed', 'true')
  await expect(vertical).toHaveAttribute('aria-pressed', 'false')
  await expectSeparatedNodes(flow)
  await expectFittedNodes(flow)
  await screenshot(page, info, 'project-flow-desktop-dark')

  const choice = flow.locator('[data-flow-kind="choice"]').filter({ hasText: '去图书馆' }).getByRole('button', { name: /^定位源码：/ })
  await choice.focus()
  await choice.press('Enter')
  await expectSource(page, startPath, 6)
  await main.getByRole('tab', { name: '流程图', exact: true }).click()
  const arrival = flow.locator('[data-flow-kind="story"]').filter({ hasText: '抵达图书馆' }).getByRole('button', { name: /^定位源码：/ })
  await arrival.click()
  await expectSource(page, resultPath, 1)
  await screenshot(page, info, 'project-flow-source-location')
  await main.getByRole('tab', { name: '流程图', exact: true }).click()
  await flow.getByRole('combobox', { name: '流程图章节', exact: true }).click()
  await page.getByRole('option', { name: '回信', exact: true }).click()
  await expect(flow.locator('[data-flow-kind="section"]').filter({ hasText: '抵达图书馆' })).toHaveCount(1)
  await expect(flow.getByRole('button', { name: '展开：抵达图书馆', exact: true })).toBeVisible()
  await expect(flow.locator(`[data-flow-source="${resultPath}"]`).first()).toBeVisible()
  await flow.getByRole('button', { name: '显示全部节点', exact: true }).click()
  await expectFittedNodes(flow)
  await expectSeparatedNodes(flow)
  await screenshot(page, info, 'project-flow-chapter-auto-layout-dark')
  await flow.locator('.vue-flow__controls-zoomin').click()
  await screenshot(page, info, 'project-flow-chapter-dark')
  await flow.getByRole('combobox', { name: '流程图章节', exact: true }).click()
  await page.getByRole('option', { name: '项目概览', exact: true }).click()
  await expect(flow.locator('[data-flow-kind="chapter"]')).toHaveCount(2)
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('keeps unsaved drafts, refuses another source, and reprojects after an explicit save', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const { main, flow } = await openFlow(page)
  await flow.locator('[data-flow-kind="story"]').filter({ hasText: '岔路' }).getByRole('button', { name: /^定位源码：/ }).click()
  await expectSource(page, startPath, 1)
  const updated = startContent.replace('岔路', '已保存的岔路').replace('原稿：', '保存稿：')
  const input = main.locator('.file-source').getByRole('textbox', { name: 'Editor content', exact: true })
  await input.focus()
  // Monaco chooses shortcuts from the browser UA. Desktop Chrome's emulated
  // Windows UA can differ from the macOS host used by ControlOrMeta.
  const selectAll = await page.evaluate(() => navigator.userAgent.includes('Macintosh') ? 'Meta+a' : 'Control+a')
  await input.press(selectAll)
  await page.keyboard.insertText(updated)
  await expect.poll(async () => (await editorState(page)).draft).toBe(updated)
  await expect.poll(async () => (await editorState(page)).dirty).toBe(true)
  await main.getByRole('tab', { name: '流程图', exact: true }).click()
  await expect(flow.locator('[data-flow-kind="story"]').filter({ hasText: '保存稿：' })).toHaveCount(0)
  await flow.locator('[data-flow-kind="story"]').filter({ hasText: '抵达图书馆' }).getByRole('button', { name: /^定位源码：/ }).click()
  await expect(flow.getByRole('alert')).toContainText('保存')
  expect((await editorState(page)).path).toBe(startPath)
  expect((await editorState(page)).draft).toBe(updated)
  expect(await readFile(join(projectRoot, startPath), 'utf8')).toBe(startContent)

  await main.getByRole('tab', { name: '文件', exact: true }).click()
  await main.locator('.file-source').getByRole('button', { name: '保存', exact: true }).click()
  await expect.poll(() => readFile(join(projectRoot, startPath), 'utf8')).toBe(updated)
  await expect.poll(async () => (await editorState(page)).dirty).toBe(false)
  await main.getByRole('tab', { name: '流程图', exact: true }).click()
  await expect(flow.locator('[data-flow-kind="story"]').filter({ hasText: '已保存的岔路' })).toHaveCount(1)
  await expect(flow.locator('[data-flow-kind="story"]').filter({ hasText: '原稿：' })).toHaveCount(0)
  await flow.locator('[data-flow-kind="story"]').filter({ hasText: '抵达图书馆' }).getByRole('button', { name: /^定位源码：/ }).click()
  await expectSource(page, resultPath, 1)
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('reports a missing target at its source line and recovers the graph after repair', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const { main, flow } = await openFlow(page)
  await writeFile(join(projectRoot, startPath), startContent.replace('result#arrival', 'missing#arrival'))
  await flow.getByRole('button', { name: '刷新', exact: true }).click()
  await flow.locator('summary').filter({ hasText: '项目诊断' }).click()
  const diagnostic = flow.locator('[data-flow-diagnostic="ADV_RUNTIME_UNKNOWN_TARGET"]').first()
  await expect(diagnostic).toBeVisible()
  await expect(diagnostic).toContainText(`${startPath}:6`)
  await expect(flow.locator('[data-flow-kind="chapter"]')).toHaveCount(2)
  await expect(flow.locator('.vue-flow__node').first()).toBeInViewport({ ratio: 1 })
  await expect(flow.locator('.vue-flow__node').last()).toBeInViewport({ ratio: 1 })
  await screenshot(page, info, 'project-flow-missing-target')
  await diagnostic.click()
  await expectSource(page, startPath, 6)
  expect((await editorState(page)).draft).toContain('missing#arrival')
  await writeFile(join(projectRoot, startPath), startContent)
  await main.getByRole('tab', { name: '流程图', exact: true }).click()
  await flow.getByRole('button', { name: '刷新', exact: true }).click()
  await expect(flow.locator('[data-flow-diagnostic="ADV_RUNTIME_UNKNOWN_TARGET"]')).toHaveCount(0)
  await flow.getByRole('button', { name: '全部剧情详情', exact: true }).click()
  await expect(flow.locator('[data-flow-kind="choice"]')).toHaveCount(2)
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('retains viewport across tabs, fits 320px in both themes and clears old nodes when switching projects', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error')
      errors.push(message.text())
  })
  const { main, flow } = await openFlow(page)
  await flow.evaluate(element => element.setAttribute('data-retention-marker', 'real-project-flow'))
  const viewport = flow.locator('.vue-flow__transformationpane')
  await flow.locator('.vue-flow__controls-zoomin').click()
  const transform = await viewport.evaluate(element => (element as HTMLElement).style.transform)
  await main.getByRole('tab', { name: '文件', exact: true }).click()
  await expect(flow).toBeHidden()
  await main.getByRole('tab', { name: '流程图', exact: true }).click()
  await expect(flow).toHaveAttribute('data-retention-marker', 'real-project-flow')
  expect(await viewport.evaluate(element => (element as HTMLElement).style.transform)).toBe(transform)

  const pane = main.locator('xpath=ancestor::div[contains(@class, "splitpanes__pane")][1]')
  await pane.evaluate(element => Object.assign((element as HTMLElement).style, { width: '320px', flex: '0 0 320px' }))
  await expect.poll(async () => Math.round((await flow.boundingBox())!.width)).toBe(320)
  await expect.poll(() => flow.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await expect(flow.locator('.vue-flow__minimap')).toBeHidden()
  const vertical = flow.getByRole('button', { name: '垂直布局', exact: true })
  await vertical.focus()
  await vertical.press('Enter')
  await expect(vertical).toHaveAttribute('aria-pressed', 'true')
  await expectSeparatedNodes(flow)
  await expectFittedNodes(flow)
  await expectRenderedNodeIcons(flow)
  await expect(flow.locator('.vue-flow__node').first()).toBeInViewport()
  await screenshot(page, info, 'project-flow-320-dark', true)
  await page.evaluate(() => localStorage.setItem('nuxt-color-mode', 'light'))
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/editor-light/)
  await main.getByRole('tab', { name: '流程图', exact: true }).click()
  await pane.evaluate(element => Object.assign((element as HTMLElement).style, { width: '320px', flex: '0 0 320px' }))
  await expect.poll(() => flow.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await expect(flow.locator('.vue-flow__minimap')).toBeHidden()
  await flow.getByRole('button', { name: '水平布局', exact: true }).click()
  await flow.getByRole('button', { name: '垂直布局', exact: true }).click()
  await expect(flow.getByRole('button', { name: '垂直布局', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expectSeparatedNodes(flow)
  await expectFittedNodes(flow)
  await expectRenderedNodeIcons(flow)
  await screenshot(page, info, 'project-flow-320-light', true)

  await flow.getByRole('button', { name: '全部剧情详情', exact: true }).click()
  await flow.locator('[data-flow-kind="story"]').filter({ hasText: '岔路' }).getByRole('button', { name: /^定位源码：/ }).click()
  await expectSource(page, startPath, 1)
  await main.getByRole('tab', { name: '流程图', exact: true }).click()

  await page.evaluate(async () => {
    const directory = await (await navigator.storage.getDirectory()).getDirectoryHandle('second-flow-project', { create: true })
    const configuration = await (await directory.getFileHandle('adv.config.json', { create: true })).createWritable()
    await configuration.write('{"format":"adv-md","root":"adv"}')
    await configuration.close()
    const chapters = await (await directory.getDirectoryHandle('adv', { create: true })).getDirectoryHandle('chapters', { create: true })
    const source = await (await chapters.getFileHandle('new.adv.md', { create: true })).createWritable()
    await source.write('## 新项目 {#new}\n\n这里只属于第二个项目。\n')
    await source.close()
    const root = document.getElementById('__nuxt') as HTMLElement & { __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, unknown> } } } } }
    const project = root.__vue_app__.config.globalProperties.$pinia._s.get('@advjs/editor:project') as { openBrowserProject: (directory: FileSystemDirectoryHandle) => Promise<unknown> }
    await project.openBrowserProject(directory)
  })
  await expect.poll(async () => (await editorState(page)).chapters).toEqual(['new'])
  await expect(flow.locator(`[data-flow-source="${startPath}"], [data-flow-source="${resultPath}"]`)).toHaveCount(0)
  await expect(flow.locator('[data-flow-kind="chapter"]').filter({ hasText: 'new' })).toHaveCount(1)
  await flow.getByRole('button', { name: '全部剧情详情', exact: true }).click()
  await expect(flow.locator('[data-flow-kind="story"]').filter({ hasText: '新项目' })).toHaveCount(1)
  expect((await editorState(page)).path).toBe('')
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('reloads the same browser source after an external edit and navigates to the new line', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const { main, flow } = await openFlow(page)
  const path = 'adv/chapters/only.adv.md'
  const original = '## 浏览器原稿 {#entry}\n\n只有浏览器文件句柄。\n'
  const updated = '<!-- refreshed outside the Editor -->\n\n## 浏览器更新稿 {#entry}\n\n只有浏览器文件句柄。\n'
  await page.evaluate(async (content) => {
    const directory = await (await navigator.storage.getDirectory()).getDirectoryHandle('browser-source-flow', { create: true })
    const configuration = await (await directory.getFileHandle('adv.config.json', { create: true })).createWritable()
    await configuration.write('{"format":"adv-md","root":"adv"}')
    await configuration.close()
    const chapters = await (await directory.getDirectoryHandle('adv', { create: true })).getDirectoryHandle('chapters', { create: true })
    const source = await (await chapters.getFileHandle('only.adv.md', { create: true })).createWritable()
    await source.write(content)
    await source.close()
    const root = document.getElementById('__nuxt') as HTMLElement & { __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, unknown> } } } } }
    const project = root.__vue_app__.config.globalProperties.$pinia._s.get('@advjs/editor:project') as { openBrowserProject: (directory: FileSystemDirectoryHandle) => Promise<unknown> }
    await project.openBrowserProject(directory)
  }, original)
  await expect.poll(async () => (await editorState(page)).chapters).toEqual(['only'])
  await flow.getByRole('button', { name: '全部剧情详情', exact: true }).click()
  await flow.locator('[data-flow-kind="story"]').filter({ hasText: '浏览器原稿' }).getByRole('button', { name: /^定位源码：/ }).click()
  await expectSource(page, path, 1)
  await page.evaluate(async (content) => {
    const directory = await (await navigator.storage.getDirectory()).getDirectoryHandle('browser-source-flow')
    const chapters = await (await directory.getDirectoryHandle('adv')).getDirectoryHandle('chapters')
    const source = await (await chapters.getFileHandle('only.adv.md')).createWritable()
    await source.write(content)
    await source.close()
    const root = document.getElementById('__nuxt') as HTMLElement & { __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, unknown> } } } } }
    const project = root.__vue_app__.config.globalProperties.$pinia._s.get('@advjs/editor:project') as { refreshProject: () => Promise<unknown> }
    await project.refreshProject()
  }, updated)
  // OPFS has no project watcher: the open Monaco draft still holds the saved
  // prior text until source navigation explicitly reloads this same file.
  expect((await editorState(page)).draft).toBe(original)
  await main.getByRole('tab', { name: '流程图', exact: true }).click()
  await flow.locator('[data-flow-kind="story"]').filter({ hasText: '浏览器更新稿' }).getByRole('button', { name: /^定位源码：/ }).click()
  await expectSource(page, path, 3)
  expect((await editorState(page)).draft).toBe(updated)
  expect((await editorState(page)).dirty).toBe(false)
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  expect(errors).toEqual([])
})
