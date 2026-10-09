import type { Locator, Page, TestInfo } from '@playwright/test'
import type { EditorBridge } from '../../packages/advjs/node/editor'
import { mkdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { expect, test } from '@playwright/test'
import { createEditorBridge } from '../../packages/advjs/node/editor'

const repositoryRoot = resolve(import.meta.dirname, '../..')
const workspaceName = 'Starter 多节点验收'
const chapterIds = ['hello', 'letter', 'ending']
let bridge: EditorBridge | undefined
let editorUrl = ''

test.beforeAll(async () => {
  bridge = await createEditorBridge({
    host: '127.0.0.1',
    port: 0,
    projectRoot: join(repositoryRoot, 'tests/launch/fixtures/golden-project'),
    publicRoot: join(repositoryRoot, 'editor/core/dist'),
  })
  // The bridge only serves the packaged Editor here. Creation and loading use
  // real browser file handles, template writes, and project compilation.
  editorUrl = new URL((await bridge.start()).url).origin
})

test.afterAll(async () => await bridge?.stop())

test.beforeEach(async ({ browserName, page }) => {
  test.skip(browserName !== 'chromium', 'Starter creation uses Chromium File System Access')
  await page.addInitScript((name) => {
    localStorage.setItem('advjs:editor:onboarded', 'true')
    localStorage.setItem('advjs:editor:locale', 'zh-CN')
    localStorage.setItem('nuxt-color-mode', localStorage.getItem('nuxt-color-mode') ?? 'dark')
    // Replace the operating-system picker only; OPFS handles and writes are real.
    window.showDirectoryPicker = async () => await (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true })
  }, workspaceName)
  await page.setViewportSize({ width: 1440, height: 900 })
})

async function editorState(page: Page) {
  return page.evaluate(() => {
    const root = document.getElementById('__nuxt') as HTMLElement & {
      __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, unknown> } } } }
    }
    const stores = root.__vue_app__.config.globalProperties.$pinia._s
    const project = stores.get('@advjs/editor:project') as {
      chapters: { id: string, title: string }[]
      diagnostics: { code: string, severity: string }[]
    }
    const file = stores.get('file') as { openedFilePath: string }
    const monaco = stores.get('@advjs/editor:monaco') as { positions: Record<string, { lineNumber: number }> }
    const flow = stores.get('flow') as {
      graph?: {
        nodes: { id: string, chapterId: string, kind: string, label: string, runtimeKind?: string, source?: { path: string, line: number } }[]
        edges: { source: string, target: string, crossChapter: boolean, conditional: boolean }[]
      }
      visibleNodes: { id: string }[]
      viewport: { x: number, y: number, zoom: number }
    }
    return {
      chapters: project.chapters.map(chapter => ({ id: chapter.id, title: chapter.title })),
      diagnostics: project.diagnostics.map(item => ({ code: item.code, severity: item.severity })),
      nodes: flow?.graph?.nodes ?? [],
      edges: flow?.graph?.edges ?? [],
      visibleNodeIds: flow?.visibleNodes.map(node => node.id) ?? [],
      viewport: flow?.viewport,
      path: file?.openedFilePath,
      line: monaco?.positions[file?.openedFilePath]?.lineNumber,
    }
  })
}

async function createStarter(page: Page, info?: TestInfo) {
  await page.goto(editorUrl)
  await expect(page).toHaveURL(new URL('/', editorUrl).href)
  await expect(page).toHaveTitle(/ADV.JS/)
  await expect(page.locator('.advjs-editor-layout')).toBeVisible()
  const project = page.getByRole('tabpanel', { name: '项目', exact: true })
  await project.getByRole('button', { name: '创建示例项目', exact: true }).click()
  await expect(page.getByText('浏览器工作区', { exact: true })).toBeVisible()
  await expect.poll(async () => (await editorState(page)).chapters.map(chapter => chapter.id)).toEqual(chapterIds)
  const main = page.locator('[data-editor-region="main"]')
  await main.getByRole('tab', { name: '流程图', exact: true }).click()
  const flow = main.locator('.advjs-flow-editor')
  await expect(flow.locator('[data-flow-kind="chapter"]')).toHaveCount(3)
  await expectFittedNodes(flow)
  if (info)
    await screenshot(page, info, 'starter-flow-chapter-overview-dark')
  await flow.getByRole('button', { name: '全部剧情详情', exact: true }).click()
  await expect.poll(() => flow.locator('[data-flow-node-id]').count()).toBeGreaterThanOrEqual(50)
  await expectFittedNodes(flow)
  await expectSeparatedNodes(flow)
  await expect(page.getByText('Preview failed to load', { exact: true })).toHaveCount(0)
  return { main, flow }
}

async function createdChapter(page: Page, chapterId: string) {
  return page.evaluate(async ({ name, chapter }) => {
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle(name)
    const chapters = await (await root.getDirectoryHandle('adv')).getDirectoryHandle('chapters')
    return await (await (await chapters.getFileHandle(`${chapter}.adv.md`)).getFile()).text()
  }, { name: workspaceName, chapter: chapterId })
}

async function expectFittedNodes(flow: Locator) {
  await expect.poll(() => flow.evaluate((element) => {
    const canvas = element.querySelector('.flow-canvas')!.getBoundingClientRect()
    return Array.from(element.querySelectorAll('[data-flow-node-id]')).flatMap((node) => {
      const bounds = node.getBoundingClientRect()
      return bounds.left >= canvas.left - 1 && bounds.right <= canvas.right + 1
        && bounds.top >= canvas.top - 1 && bounds.bottom <= canvas.bottom + 1
        ? []
        : [node.getAttribute('data-flow-node-id')]
    })
  })).toEqual([])
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

async function expectControlsClear(flow: Locator) {
  await expect.poll(() => flow.evaluate((element) => {
    const controls = element.querySelector('.vue-flow__controls')!.getBoundingClientRect()
    return Array.from(element.querySelectorAll('[data-flow-node-id]')).every(node => node.getBoundingClientRect().bottom <= controls.top - 1)
  })).toBe(true)
}

async function expectRenderedIcons(flow: Locator) {
  await expect(flow.locator('[data-flow-icon]')).toHaveCount(await flow.locator('[data-flow-node-id]').count())
  expect(await flow.locator('[data-flow-icon]').evaluateAll(elements => elements.every((element) => {
    const style = getComputedStyle(element)
    return style.maskImage !== 'none' && Number.parseFloat(style.width) > 0 && Number.parseFloat(style.height) > 0
  }))).toBe(true)
}

async function renderedZoom(flow: Locator) {
  return flow.locator('.vue-flow__transformationpane').evaluate(element => new DOMMatrix(getComputedStyle(element).transform).a)
}

async function screenshot(page: Page, info: TestInfo, name: string, flowOnly = false) {
  const directory = process.env.ADVJS_LAYOUT_SCREENSHOTS ?? join(tmpdir(), 'advjs-starter-flow-artifacts')
  await mkdir(directory, { recursive: true })
  await (flowOnly ? page.locator('.advjs-flow-editor') : page).screenshot({ path: join(directory, `${name}-${info.project.name}.png`), animations: 'disabled' })
}

async function expectSource(page: Page, path: string, line: number) {
  const main = page.locator('[data-editor-region="main"]')
  await expect(main.getByRole('tab', { name: '文件', exact: true })).toHaveAttribute('data-state', 'active')
  await expect.poll(async () => (await editorState(page)).path).toBe(path)
  await expect.poll(async () => (await editorState(page)).line).toBe(line)
  await expect(main.locator('.file-source').getByRole('textbox', { name: 'Editor content', exact: true })).toBeFocused()
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

test('creates the actual three-chapter Starter and fits its complete branching graph', async ({ page }, info) => {
  const errors = recordErrors(page)
  const { main, flow } = await createStarter(page, info)
  for (const chapterId of chapterIds) {
    const authored = await readFile(join(repositoryRoot, `demo/starter/public/md/chapters/${chapterId}.adv.md`), 'utf8')
    expect(await createdChapter(page, chapterId)).toBe(authored)
  }
  const state = await editorState(page)
  expect(state.diagnostics.filter(item => item.severity === 'error')).toEqual([])
  const ids = new Set(state.nodes.map(node => node.id))
  expect(state.edges.every(edge => ids.has(edge.source) && ids.has(edge.target))).toBe(true)
  expect(state.edges.filter(edge => edge.crossChapter).length).toBeGreaterThanOrEqual(2)
  expect(state.edges.some(edge => edge.conditional)).toBe(true)
  expect(state.nodes.filter(node => node.runtimeKind === 'end')).toHaveLength(2)
  const reread = state.nodes.find(node => node.kind === 'choice' && node.label === '再读一次来信')!
  const window = state.nodes.find(node => node.runtimeKind === 'anchor' && node.label === '午后的演示室')!
  expect(state.edges.some(edge => edge.source === reread.id && edge.target === window.id)).toBe(true)
  await expect(flow.locator('[data-flow-summary]')).toContainText('3 章节')
  await flow.getByRole('button', { name: '自动排版', exact: true }).click()
  await expectFittedNodes(flow)
  await expectSeparatedNodes(flow)
  await expectRenderedIcons(flow)
  // Measured node sizes determine the fitted scale. The larger hierarchy
  // fixture separately exercises fitting below the historical 0.2 floor.
  expect(await renderedZoom(flow)).toBeLessThan(1)
  await expect.poll(async () => (await editorState(page)).viewport.zoom).toBeLessThan(1)
  expect((await editorState(page)).viewport.zoom).toBeCloseTo(await renderedZoom(flow), 4)
  await screenshot(page, info, 'starter-flow-desktop-dark')
  const fittedViewport = await flow.locator('.vue-flow__transformationpane').evaluate(element => (element as HTMLElement).style.transform)
  await main.getByRole('tab', { name: '文件', exact: true }).click()
  await expect(flow).toBeHidden()
  await main.getByRole('tab', { name: '流程图', exact: true }).click()
  expect(await flow.locator('.vue-flow__transformationpane').evaluate(element => (element as HTMLElement).style.transform)).toBe(fittedViewport)
  await expectFittedNodes(flow)
  await flow.getByRole('button', { name: '垂直布局', exact: true }).click()
  await expectFittedNodes(flow)
  await expectSeparatedNodes(flow)
  await screenshot(page, info, 'starter-flow-desktop-vertical-dark')

  await flow.getByRole('combobox', { name: '流程图章节', exact: true }).click()
  await page.getByRole('option', { name: state.chapters.find(chapter => chapter.id === 'hello')!.title, exact: true }).click()
  await expect.poll(() => flow.locator('[data-flow-kind="section"]').count()).toBeGreaterThan(0)
  await expect.poll(async () => (await editorState(page)).visibleNodeIds.length).toBeLessThan(state.nodes.length)
  await flow.getByRole('button', { name: '水平布局', exact: true }).click()
  await expectFittedNodes(flow)
  await expectSeparatedNodes(flow)
  const hello = await createdChapter(page, 'hello')
  const syntaxLine = hello.split('\n').findIndex(line => line.includes('{#syntax}')) + 1
  expect(syntaxLine).toBeGreaterThan(0)
  const syntax = flow.getByRole('button', { name: '定位源码：语法提示', exact: true })
  await syntax.focus()
  await syntax.press('Enter')
  await expectSource(page, 'adv/chapters/hello.adv.md', syntaxLine)
  await screenshot(page, info, 'starter-flow-source-location')
  await main.getByRole('tab', { name: '流程图', exact: true }).click()
  await flow.getByRole('combobox', { name: '流程图章节', exact: true }).click()
  await page.getByRole('option', { name: state.chapters.find(chapter => chapter.id === 'ending')!.title, exact: true }).click()
  await flow.getByRole('button', { name: '垂直布局', exact: true }).click()
  await expectFittedNodes(flow)
  await expectSeparatedNodes(flow)
  await screenshot(page, info, 'starter-flow-ending-chapter-dark')
  await flow.getByRole('combobox', { name: '流程图章节', exact: true }).click()
  await page.getByRole('option', { name: state.chapters.find(chapter => chapter.id === 'letter')!.title, exact: true }).click()
  const letter = await createdChapter(page, 'letter')
  const postcardLine = letter.split('\n').findIndex(line => line.includes('{#postcard}')) + 1
  const postcard = flow.getByRole('button', { name: '定位源码：邮戳上的日期', exact: true })
  await postcard.focus()
  await postcard.press('Enter')
  await expectSource(page, 'adv/chapters/letter.adv.md', postcardLine)
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  expect(errors).toEqual([])
})

async function advanceTo(scene: Locator, target: Locator) {
  for (let step = 0; step < 100; step++) {
    const narration = scene.locator('.adv-black')
    const dialog = scene.locator('.adv-dialog-box')
    await expect.poll(async () => await target.isVisible() || await narration.isVisible() || await dialog.isVisible()).toBe(true)
    if (await target.isVisible())
      return
    if (await narration.isVisible())
      await narration.click()
    else if (await dialog.isVisible())
      await dialog.click()
    else
      throw new Error(`No story text can advance to ${target.toString()}`)
  }
  await expect(target).toBeVisible()
}

test('plays the created Starter through the clue-gated branch to its first ending', async ({ page }, info) => {
  const errors = recordErrors(page)
  const failedMedia: string[] = []
  page.on('response', (response) => {
    if (response.status() >= 400 && /\.(?:svg|webp)(?:\?|$)/.test(response.url()))
      failedMedia.push(`${response.status()} ${response.url()}`)
  })
  await createStarter(page)
  await page.getByRole('tab', { name: '游戏', exact: true }).click()
  const scene = page.getByRole('tabpanel', { name: '游戏', exact: true })
  const startPreview = scene.getByRole('button', { name: '启动项目预览', exact: true })
  if (await startPreview.isVisible())
    await startPreview.click()
  await expect(scene.locator('.adv-black')).toContainText('这段旁白直接来自一个')
  await expect(scene.locator('.adv-background__layer--current')).toHaveCSS('background-image', /blob:/)
  await advanceTo(scene, scene.locator('.adv-dialog-box'))
  await expect(scene.locator('.adv-dialog-box')).toContainText('欢迎来到 ADV.JS')
  const avatar = scene.locator('.dialog-avatar')
  await expect(avatar).toBeVisible()
  await expect.poll(() => avatar.evaluate(element => (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth > 0)).toBe(true)
  await screenshot(page, info, 'starter-preview-local-media')
  const path = ['直接开始', '打开窗边的来信', '检查信封上的邮戳', '记住日期，重新整理思路', '沿着邮戳理解这封信', '把光寄回明天']
  for (const choice of path) {
    const option = scene.getByRole('button', { name: choice, exact: true })
    await advanceTo(scene, option)
    await option.click()
  }
  await advanceTo(scene, scene.locator('.adv-end'))
  await expect(scene.locator('.adv-end')).toBeVisible()
  const state = await page.evaluate(() => {
    const root = document.getElementById('__nuxt') as HTMLElement & {
      __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, unknown> } } } }
    }
    const runtime = root.__vue_app__.config.globalProperties.$pinia._s.get('@advjs/client/adv') as {
      state: { status: string, cursor: { chapterId: string }, variables: { clueFound: boolean, understoodLetter: boolean, ending: string } }
    }
    return runtime.state
  })
  expect(state.status).toBe('ended')
  expect(state.cursor.chapterId).toBe('ending')
  expect(state.variables).toMatchObject({ clueFound: true, understoodLetter: true, ending: 'send-light' })
  await screenshot(page, info, 'starter-preview-first-ending')
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  expect(failedMedia).toEqual([])
  expect(errors).toEqual([])
})

test('keeps the multi-node graph navigable in 320px dark and light panels', async ({ page }, info) => {
  const errors = recordErrors(page)
  const { main, flow } = await createStarter(page)
  const pane = main.locator('xpath=ancestor::div[contains(@class, "splitpanes__pane")][1]')
  await pane.evaluate(element => Object.assign((element as HTMLElement).style, { width: '320px', flex: '0 0 320px' }))
  await expect.poll(async () => Math.round((await flow.boundingBox())!.width)).toBe(320)
  const vertical = flow.getByRole('button', { name: '垂直布局', exact: true })
  await vertical.focus()
  await vertical.press('Enter')
  await expect(vertical).toHaveAttribute('aria-pressed', 'true')
  await expectFittedNodes(flow)
  await expectSeparatedNodes(flow)
  await expectRenderedIcons(flow)
  await expect(flow.locator('.vue-flow__minimap')).toBeHidden()
  expect(await flow.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await screenshot(page, info, 'starter-flow-320-dark', true)

  const viewport = flow.locator('.vue-flow__transformationpane')
  const fitted = await viewport.evaluate(element => (element as HTMLElement).style.transform)
  const fittedZoom = await renderedZoom(flow)
  const zoom = flow.getByRole('button', { name: '放大', exact: true })
  await zoom.focus()
  await zoom.press('Enter')
  await expect.poll(() => viewport.evaluate(element => (element as HTMLElement).style.transform)).not.toBe(fitted)
  await expect.poll(() => renderedZoom(flow)).toBeCloseTo(fittedZoom * 1.2, 4)
  await expect.poll(async () => (await editorState(page)).viewport.zoom).toBeCloseTo(fittedZoom * 1.2, 4)
  const zoomed = await viewport.evaluate(element => (element as HTMLElement).style.transform)
  const canvas = await flow.locator('.flow-canvas').boundingBox()
  await page.mouse.move(canvas!.x + 24, canvas!.y + canvas!.height - 84)
  await page.mouse.down()
  await page.mouse.move(canvas!.x + 84, canvas!.y + canvas!.height - 124, { steps: 5 })
  await page.mouse.up()
  await expect.poll(() => viewport.evaluate(element => (element as HTMLElement).style.transform)).not.toBe(zoomed)
  await expect.poll(() => flow.evaluate((element) => {
    const root = document.getElementById('__nuxt') as HTMLElement & { __vue_app__: { config: { globalProperties: { $vueFlowStorage: { flows: Map<string, { paneDragging: { value: boolean }, vueFlowRef: { value: HTMLElement } }> } } } } }
    return Array.from(root.__vue_app__.config.globalProperties.$vueFlowStorage.flows.values()).find(instance => instance.vueFlowRef.value === element.querySelector('.flow-canvas'))?.paneDragging.value
  })).toBe(false)
  // D3 suppresses the click following a drag until the gesture's event turn
  // completes. Let that real completion settle before activating a control.
  await flow.evaluate(async () => await new Promise<void>(resolveFrame => requestAnimationFrame(() => resolveFrame())))
  const fit = flow.getByRole('button', { name: '显示全部节点', exact: true })
  await fit.focus()
  await fit.press('Enter')
  await expectFittedNodes(flow)
  await flow.getByRole('button', { name: '返回上一层', exact: true }).click()
  await expect(flow.locator('[data-flow-kind="chapter"]')).toHaveCount(3)
  await flow.getByRole('button', { name: '垂直布局', exact: true }).click()
  await expectFittedNodes(flow)
  await expectControlsClear(flow)
  await screenshot(page, info, 'starter-flow-chapter-overview-320-dark', true)
  await page.evaluate(() => localStorage.setItem('nuxt-color-mode', 'light'))
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/editor-light/)
  await expect.poll(async () => (await editorState(page)).chapters.map(chapter => chapter.id)).toEqual(chapterIds)
  await main.getByRole('tab', { name: '流程图', exact: true }).click()
  await flow.getByRole('button', { name: '全部剧情详情', exact: true }).click()
  await pane.evaluate(element => Object.assign((element as HTMLElement).style, { width: '320px', flex: '0 0 320px' }))
  await flow.getByRole('button', { name: '垂直布局', exact: true }).click()
  await expectFittedNodes(flow)
  await expectSeparatedNodes(flow)
  await expectRenderedIcons(flow)
  expect(await flow.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await expect(flow.locator('.vue-flow__minimap')).toBeHidden()
  await screenshot(page, info, 'starter-flow-320-light', true)
  await flow.getByRole('button', { name: '返回上一层', exact: true }).click()
  await expect(flow.locator('[data-flow-kind="chapter"]')).toHaveCount(3)
  await flow.getByRole('button', { name: '垂直布局', exact: true }).click()
  await expectFittedNodes(flow)
  await expectControlsClear(flow)
  await screenshot(page, info, 'starter-flow-chapter-overview-320-light', true)
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  expect(errors).toEqual([])
})
