import type { Locator, Page, TestInfo } from '@playwright/test'
import type { EditorBridge } from '../../packages/advjs/node/editor'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { expect, test } from '@playwright/test'
import { createEditorBridge } from '../../packages/advjs/node/editor'

const repositoryRoot = resolve(import.meta.dirname, '../..')
let bridge: EditorBridge | undefined
let temporaryRoot = ''
let projectRoot = ''

test.beforeEach(async ({ page }) => {
  temporaryRoot = await mkdtemp(join(tmpdir(), 'advjs-flow-hierarchy-'))
  projectRoot = join(temporaryRoot, 'project')
  await cp(join(repositoryRoot, 'tests/launch/fixtures/golden-project'), projectRoot, { recursive: true })
  await rm(join(projectRoot, 'adv/chapters/chapter_01.adv.md'))
  await mkdir(join(projectRoot, 'adv/assets'), { recursive: true })
  await writeFile(join(projectRoot, 'adv/assets/room.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#496b87"/></svg>')
  await writeFile(join(projectRoot, 'adv/assets.json'), JSON.stringify({ schemaVersion: 2, id: 'flow-hierarchy', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'adv/assets' } }, assets: [{ id: 'room', kind: 'background', type: 'image', path: 'room.svg' }] }))
  await page.addInitScript(() => {
    localStorage.setItem('advjs:editor:locale', 'zh-CN')
    localStorage.setItem('advjs:editor:onboarded', 'true')
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

async function flowState(page: Page) {
  return page.evaluate(() => {
    const root = document.getElementById('__nuxt') as HTMLElement & { __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, unknown> } } } } }
    const stores = root.__vue_app__.config.globalProperties.$pinia._s
    const flow = stores.get('flow') as {
      graph: { nodes: { id: string, label: string }[], edges: unknown[], diagnostics: unknown[] }
      currentView: { selection: { level: string, chapterId?: string, sectionId?: string }, page: number, pageCount: number, totalNodes: number, nodes: { id: string, portal?: boolean, overflow?: boolean, label: string, expandTo?: { level: string, page: number } }[], edges: { id: string, routes: { source: { label: string }, target: { label: string } }[] }[] }
      direction: string
      viewport: { x: number, y: number, zoom: number }
      cacheStats: { runs: number, hits: number, sourceHits: number, sourceMisses: number }
    }
    const file = stores.get('file') as { openedFilePath: string }
    const monaco = stores.get('@advjs/editor:monaco') as { positions: Record<string, { lineNumber: number }> }
    return {
      canonicalNodes: flow.graph.nodes.length,
      canonicalEdges: flow.graph.edges.length,
      diagnostics: flow.graph.diagnostics,
      view: flow.currentView,
      direction: flow.direction,
      viewport: flow.viewport,
      cache: flow.cacheStats,
      path: file.openedFilePath,
      line: monaco.positions[file.openedFilePath]?.lineNumber,
    }
  })
}

function recordErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error')
      errors.push(message.text())
  })
  return errors
}

async function openFlow(page: Page, chapters: { id: string, title: string, content: string }[]) {
  await writeFile(join(projectRoot, 'game.config.json'), JSON.stringify({ id: 'flow-hierarchy', title: '章节聚合验收项目', entryChapterId: chapters[0].id, chapters: chapters.map(chapter => ({ id: chapter.id, title: chapter.title, sources: [`chapters/${chapter.id}.adv.md`] })) }))
  for (const chapter of chapters)
    await writeFile(join(projectRoot, `adv/chapters/${chapter.id}.adv.md`), chapter.content)
  bridge = await createEditorBridge({ host: '127.0.0.1', port: 0, projectRoot, publicRoot: join(repositoryRoot, 'editor/core/dist') })
  await page.goto((await bridge.start()).url)
  await expect(page).toHaveTitle(/ADV.JS/)
  await expect(page.locator('.advjs-editor-layout')).toBeVisible()
  const main = page.locator('[data-editor-region="main"]')
  await main.getByRole('tab', { name: '流程图', exact: true }).click()
  const flow = main.locator('.advjs-flow-editor')
  await expect(flow.locator('[data-flow-kind="chapter"]')).toHaveCount(chapters.length)
  await expect.poll(async () => (await flowState(page)).view.selection.level).toBe('chapters')
  await expectFitted(flow)
  return { main, flow }
}

async function expectFitted(flow: Locator) {
  await expect.poll(() => flow.evaluate((element) => {
    const canvas = element.querySelector('.flow-canvas')!.getBoundingClientRect()
    return Array.from(element.querySelectorAll('[data-flow-node-id]')).every((node) => {
      const bounds = node.getBoundingClientRect()
      return bounds.left >= canvas.left - 1 && bounds.right <= canvas.right + 1 && bounds.top >= canvas.top - 1 && bounds.bottom <= canvas.bottom + 1
    })
  })).toBe(true)
}

async function screenshot(page: Page, info: TestInfo, name: string, flowOnly = false) {
  const directory = process.env.ADVJS_LAYOUT_SCREENSHOTS ?? join(tmpdir(), 'advjs-flow-hierarchy-artifacts')
  await mkdir(directory, { recursive: true })
  await (flowOnly ? page.locator('.advjs-flow-editor') : page).screenshot({ path: join(directory, `${name}-${info.project.name}.png`), animations: 'disabled' })
}

async function expectSource(page: Page, path: string, line: number) {
  const main = page.locator('[data-editor-region="main"]')
  await expect(main.getByRole('tab', { name: '文件', exact: true })).toHaveAttribute('data-state', 'active')
  await expect.poll(async () => (await flowState(page)).path).toBe(path)
  await expect.poll(async () => (await flowState(page)).line).toBe(line)
  await expect(main.locator('.file-source').getByRole('textbox', { name: 'Editor content', exact: true })).toBeFocused()
}

test('expands chapters and sections, restores each view, and retains both precise merged jump routes', async ({ page }, info) => {
  const errors = recordErrors(page)
  const content = '## 岔路 {#fork}\n\n两条路通向不同的回信。\n\n- [去图书馆](result#library)\n- [去档案馆](result#archive)\n\n## 等待 {#wait}\n\n留在这里。\n\n```yaml\ntype: end\n```'
  const result = '## 图书馆 {#library}\n\n读到了第一封信。\n\n```yaml\ntype: end\n```\n\n## 档案馆 {#archive}\n\n读到了第二封信。\n\n```yaml\ntype: end\n```'
  const { main, flow } = await openFlow(page, [
    { id: 'start', title: '开端', content },
    { id: 'result', title: '回信', content: result },
    { id: 'unused', title: '预留章', content: '## 后记 {#epilogue}\n\n尚未连入的章节。' },
  ])
  await expect(flow.locator('[data-flow-kind="story"], [data-flow-kind="choice"]')).toHaveCount(0)
  const initial = await flowState(page)
  expect(initial.canonicalNodes).toBeGreaterThan(3)
  expect(initial.diagnostics).toEqual([])
  expect(initial.view.edges).toHaveLength(1)
  expect(initial.view.edges[0].routes.map(route => [route.source.label, route.target.label])).toEqual([['去图书馆', '图书馆'], ['去档案馆', '档案馆']])
  await screenshot(page, info, 'flow-hierarchy-overview-dark')
  await flow.getByRole('button', { name: '刷新', exact: true }).click()
  await expect.poll(async () => (await flowState(page)).cache.sourceHits).toBeGreaterThanOrEqual(initial.cache.sourceHits + 3)
  expect((await flowState(page)).cache.sourceMisses).toBe(initial.cache.sourceMisses)

  await flow.getByRole('button', { name: '垂直布局', exact: true }).click()
  await expectFitted(flow)
  await flow.getByRole('button', { name: '放大', exact: true }).click()
  const overviewTransform = await flow.locator('.vue-flow__transformationpane').evaluate(element => (element as HTMLElement).style.transform)
  await flow.getByRole('button', { name: '展开：开端', exact: true }).click()
  await expect.poll(async () => (await flowState(page)).view.selection.level).toBe('sections')
  await expect(flow.locator('[data-flow-kind="section"]').filter({ hasText: '岔路' })).toHaveCount(1)
  await expect(flow.locator('[data-flow-kind="section"]').filter({ hasText: '等待' })).toHaveCount(1)
  await expectFitted(flow)
  await screenshot(page, info, 'flow-hierarchy-sections-dark')
  await flow.getByRole('button', { name: '本章剧情详情', exact: true }).click()
  await expect(flow.getByRole('button', { name: '定位源码：岔路', exact: true })).toBeVisible()
  await expect(flow.getByRole('button', { name: '定位源码：等待', exact: true })).toBeVisible()
  await flow.getByRole('button', { name: '返回上一层', exact: true }).click()
  await flow.getByRole('button', { name: '水平布局', exact: true }).click()
  await flow.getByRole('button', { name: '放大', exact: true }).click()
  const sectionsTransform = await flow.locator('.vue-flow__transformationpane').evaluate(element => (element as HTMLElement).style.transform)
  await flow.getByRole('button', { name: '展开：岔路', exact: true }).click()
  await expect.poll(async () => (await flowState(page)).view.selection.level).toBe('details')
  await expect(flow.locator('[data-flow-kind="choice"]')).toHaveCount(2)
  await expect(flow.getByRole('button', { name: '定位源码：岔路', exact: true })).toBeVisible()
  await screenshot(page, info, 'flow-hierarchy-detail-dark')
  await flow.getByRole('button', { name: '返回上一层', exact: true }).click()
  await expect.poll(async () => (await flowState(page)).direction).toBe('LR')
  await expect.poll(() => flow.locator('.vue-flow__transformationpane').evaluate(element => (element as HTMLElement).style.transform)).toBe(sectionsTransform)
  await flow.getByRole('button', { name: '返回上一层', exact: true }).click()
  await expect.poll(async () => (await flowState(page)).direction).toBe('TB')
  await expect.poll(() => flow.locator('.vue-flow__transformationpane').evaluate(element => (element as HTMLElement).style.transform)).toBe(overviewTransform)
  await flow.getByRole('button', { name: '显示全部节点', exact: true }).click()

  await flow.locator('.vue-flow__edge').first().click()
  await expect(flow.locator('[data-flow-route]')).toHaveCount(2)
  await expect(flow.locator('.flow-routes')).toContainText('跳转明细 · 2')
  await expect(flow.locator('[data-flow-route]').first()).toContainText('adv/chapters/start.adv.md:5 → adv/chapters/result.adv.md:1')
  await expect(flow.locator('[data-flow-route]').last()).toContainText('adv/chapters/start.adv.md:6 → adv/chapters/result.adv.md:9')
  await screenshot(page, info, 'flow-hierarchy-merged-routes-dark')
  await flow.getByRole('button', { name: '定位跳转源码：去档案馆', exact: true }).click()
  await expectSource(page, 'adv/chapters/start.adv.md', 6)
  await main.getByRole('tab', { name: '流程图', exact: true }).click()
  await flow.getByRole('button', { name: '展开跳转目标：档案馆', exact: true }).click()
  await expect.poll(async () => (await flowState(page)).view.selection.chapterId).toBe('result')
  await expect(flow.getByRole('button', { name: '定位源码：档案馆', exact: true })).toBeVisible()
  await expect(flow.getByRole('button', { name: '定位源码：图书馆', exact: true })).toHaveCount(0)
  await flow.getByRole('button', { name: '定位源码：档案馆', exact: true }).click()
  await expectSource(page, 'adv/chapters/result.adv.md', 9)
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('keeps a real 2799-node project paginated and navigates its boundary portals at 320px', async ({ page }, info) => {
  const errors = recordErrors(page)
  const chapters = Array.from({ length: 10 }, (_, chapter) => ({
    id: `chapter-${chapter}`,
    title: `第 ${chapter + 1} 章`,
    content: Array.from({ length: chapter === 9 ? 277 : 278 }, (_, line) => `第 ${chapter + 1} 章第 ${line + 1} 句。`).join('\n\n'),
  }))
  const { main, flow } = await openFlow(page, chapters)
  expect((await flowState(page)).canonicalNodes).toBe(2799)
  expect((await flowState(page)).canonicalEdges).toBe(2789)
  await expect(flow.locator('[data-flow-node-id]')).toHaveCount(10)
  await flow.getByRole('button', { name: '展开：第 1 章', exact: true }).click()
  await expect(flow.locator('[data-flow-kind="section"]')).toHaveCount(1)
  await expectFitted(flow)
  await screenshot(page, info, 'flow-hierarchy-large-section-dark')
  await flow.getByRole('button', { name: '展开：chapter-0', exact: true }).click()
  await expect.poll(async () => (await flowState(page)).view.pageCount).toBe(2)
  await expect(flow.locator('[data-flow-page]')).toHaveText('1 / 2')
  await expect.poll(() => flow.locator('[data-flow-node-id]:not([data-flow-portal])').count()).toBe(200)
  expect(await flow.locator('[data-flow-node-id]').count()).toBeLessThanOrEqual(240)
  await expectFitted(flow)
  const zoom = await flow.locator('.vue-flow__transformationpane').evaluate(element => new DOMMatrix(getComputedStyle(element).transform).a)
  expect((await flowState(page)).viewport.zoom).toBeCloseTo(zoom, 4)
  await screenshot(page, info, 'flow-hierarchy-large-detail-dark')
  await flow.locator('[data-flow-portal]').getByRole('button', { name: /^展开：/ }).click()
  await expect(flow.locator('[data-flow-page]')).toHaveText('2 / 2')
  await expect(flow.getByRole('button', { name: '下一页', exact: true })).toBeDisabled()
  await expect(flow.getByRole('button', { name: '上一页', exact: true })).toBeEnabled()
  await flow.getByRole('button', { name: '上一页', exact: true }).click()
  await expect(flow.locator('[data-flow-page]')).toHaveText('1 / 2')
  await flow.getByRole('button', { name: '返回上一层', exact: true }).click()
  await flow.getByRole('button', { name: '返回上一层', exact: true }).click()
  await flow.getByRole('button', { name: '全部剧情详情', exact: true }).click()
  await expect(flow.locator('[data-flow-page]')).toHaveText('1 / 14')
  await expect.poll(() => flow.locator('[data-flow-node-id]:not([data-flow-portal])').count()).toBe(200)
  expect(await flow.locator('[data-flow-node-id]').count()).toBeLessThanOrEqual(240)
  await flow.getByRole('button', { name: '下一页', exact: true }).click()
  await expect(flow.locator('[data-flow-page]')).toHaveText('2 / 14')
  await expectFitted(flow)
  const pane = main.locator('xpath=ancestor::div[contains(@class, "splitpanes__pane")][1]')
  await pane.evaluate(element => Object.assign((element as HTMLElement).style, { width: '320px', flex: '0 0 320px' }))
  await expect.poll(async () => Math.round((await flow.boundingBox())!.width)).toBe(320)
  await flow.getByRole('button', { name: '垂直布局', exact: true }).click()
  await expectFitted(flow)
  expect((await flowState(page)).viewport.zoom).toBeLessThan(0.2)
  expect(await flow.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await expect(flow.locator('.vue-flow__minimap')).toBeHidden()
  await screenshot(page, info, 'flow-hierarchy-large-320-dark', true)
  await flow.getByRole('button', { name: '上一页', exact: true }).click()
  await expect(flow.locator('[data-flow-page]')).toHaveText('1 / 14')
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('folds dense section connections and pages every exact transition in the overflow inspector', async ({ page }, info) => {
  const errors = recordErrors(page)
  const content = Array.from({ length: 50 }, (_, section) => [
    `## 区块 ${section} {#block-${section}}`,
    '',
    ...Array.from({ length: 50 }, (_, target) => `- [路线 ${section} 至 ${target}](#block-${target})`),
  ].join('\n')).join('\n\n')
  const { flow } = await openFlow(page, [{ id: 'dense', title: '密集章节', content }])
  await flow.getByRole('button', { name: '展开：密集章节', exact: true }).click()
  await expect.poll(async () => (await flowState(page)).view.totalNodes).toBe(50)
  await expect.poll(async () => (await flowState(page)).view.edges.length).toBeLessThanOrEqual(600)
  expect(await flow.locator('[data-flow-node-id]').count()).toBeLessThanOrEqual(240)
  await expectFitted(flow)
  const state = await flowState(page)
  const overflow = state.view.nodes.find(node => node.overflow && node.label.startsWith('其他连接'))!
  expect(overflow).toBeDefined()
  const folded = state.view.edges.filter(edge => edge.routes.length > 1)
  expect(state.view.edges.reduce((count, edge) => count + edge.routes.length, 0)).toBe(2500)
  expect(folded.length).toBeGreaterThan(0)
  await flow.getByRole('button', { name: `查看跳转：${overflow.label}`, exact: true }).click()
  await expect(flow.locator('[data-flow-route]')).toHaveCount(50)
  const firstTarget = await flow.locator('[data-flow-route]').first().getByRole('button', { name: /^展开跳转目标：/ }).getAttribute('aria-label')
  const next = flow.getByRole('button', { name: '下一组跳转', exact: true })
  await expect(next).toBeEnabled()
  const firstIds = await flow.locator('[data-flow-route]').evaluateAll(elements => elements.map(element => element.getAttribute('data-flow-route')))
  await next.click()
  await expect.poll(() => flow.locator('[data-flow-route]').evaluateAll(elements => elements.map(element => element.getAttribute('data-flow-route')))).not.toEqual(firstIds)
  await expect(flow.locator('[data-flow-route]')).toHaveCount(50)
  await flow.getByRole('button', { name: '上一组跳转', exact: true }).click()
  await expect.poll(() => flow.locator('[data-flow-route]').evaluateAll(elements => elements.map(element => element.getAttribute('data-flow-route')))).toEqual(firstIds)
  await screenshot(page, info, 'flow-hierarchy-dense-routes-dark')
  await flow.getByRole('button', { name: firstTarget!, exact: true }).first().click()
  await expect.poll(async () => (await flowState(page)).view.selection.level).toBe('details')
  await expect(flow.getByRole('button', { name: firstTarget!.replace('展开跳转目标：', '定位源码：'), exact: true })).toBeVisible()
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  expect(errors).toEqual([])
})
