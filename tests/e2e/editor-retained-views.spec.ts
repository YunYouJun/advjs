import type { EditorBridge } from '../../packages/advjs/node/editor'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { expect, test } from '@playwright/test'
import { createEditorBridge } from '../../packages/advjs/node/editor'

const repositoryRoot = resolve(import.meta.dirname, '../..')
let bridge: EditorBridge
let url: string
let temporaryRoot: string

test.beforeAll(async () => {
  temporaryRoot = await mkdtemp(join(tmpdir(), 'advjs-retained-views-'))
  const projectRoot = join(temporaryRoot, 'project')
  await cp(resolve(repositoryRoot, 'tests/launch/fixtures/golden-project'), projectRoot, { recursive: true })
  await mkdir(join(projectRoot, 'adv/assets'), { recursive: true })
  await writeFile(join(projectRoot, 'adv/assets/room.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#496b87"/></svg>')
  await writeFile(join(projectRoot, 'adv/assets.json'), JSON.stringify({ schemaVersion: 2, id: 'retained-preview', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'adv/assets' } }, assets: [{ id: 'room', kind: 'background', type: 'image', path: 'room.svg' }] }))
  bridge = await createEditorBridge({ host: '127.0.0.1', port: 0, projectRoot, publicRoot: resolve(repositoryRoot, 'editor/core/dist') })
  url = (await bridge.start()).url
})

test.afterAll(async () => {
  await bridge?.stop()
  if (temporaryRoot)
    await rm(temporaryRoot, { recursive: true, force: true })
})

test('retains the game and flow viewport, resizes on return, and releases flow observers on route exit', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error')
      errors.push(message.text())
  })
  await page.addInitScript(() => {
    localStorage.setItem('advjs:editor:locale', 'zh-CN')
    localStorage.setItem('advjs:editor:onboarded', 'true')
    const observers = new Set<Set<Element>>()
    const NativeResizeObserver = window.ResizeObserver
    window.ResizeObserver = class extends NativeResizeObserver {
      targets = new Set<Element>()
      constructor(callback: ResizeObserverCallback) {
        super(callback)
        observers.add(this.targets)
      }

      observe(target: Element, options?: ResizeObserverOptions) {
        this.targets.add(target)
        super.observe(target, options)
      }

      unobserve(target: Element) {
        this.targets.delete(target)
        super.unobserve(target)
      }

      disconnect() {
        this.targets.clear()
        super.disconnect()
      }
    }
    Object.defineProperty(window, '__flowResizeTargets', { get: () => [...observers].flatMap(targets => [...targets]).filter(target => target.closest('.advjs-flow-editor')).length })
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(url)
  await expect(page).toHaveTitle(/ADV.JS/)
  await expect(page.locator('.advjs-editor-layout')).toBeVisible()
  const main = page.locator('[data-editor-region="main"]')
  await expect(main.locator('.advjs-flow-editor')).toHaveCount(0)
  const game = main.locator('.adv-game')
  const start = main.getByRole('button', { name: '启动项目预览', exact: true })
  await expect(start.or(game)).toBeVisible()
  if (await start.isVisible())
    await start.click()
  await expect(game).toBeVisible()
  await game.evaluate(element => element.setAttribute('data-retention-marker', 'original-game'))
  await main.getByRole('tab', { name: '流程图', exact: true }).click()
  const flow = main.locator('.advjs-flow-editor')
  await expect(flow.locator('.vue-flow__node').first()).toBeVisible()
  await flow.evaluate(element => element.setAttribute('data-retention-marker', 'original-flow'))
  const originalNodes = await flow.locator('[data-flow-node-id]').evaluateAll(elements => elements.map(element => element.getAttribute('data-flow-node-id')).sort())
  expect(originalNodes.length).toBeGreaterThan(0)
  await expect(flow.locator('[data-flow-source="adv/chapters/chapter_01.adv.md"]').first()).toBeVisible()
  await flow.getByRole('button', { name: '刷新', exact: true }).click()
  await expect.poll(() => flow.locator('[data-flow-node-id]').evaluateAll(elements => elements.map(element => element.getAttribute('data-flow-node-id')).sort())).toEqual(originalNodes)
  await expect(flow.locator('.vue-flow__node').first()).toBeInViewport()
  await flow.locator('.vue-flow__controls-zoomin').click()
  await expect(flow.locator('.vue-flow__node').first()).toBeInViewport()
  const viewport = flow.locator('.vue-flow__transformationpane')
  const transform = await viewport.evaluate(element => (element as HTMLElement).style.transform)
  expect(transform).toContain('scale(')

  for (let i = 0; i < 3; i++) {
    await main.getByRole('tab', { name: '游戏', exact: true }).click()
    await expect(game).toBeVisible()
    await expect(game).toHaveAttribute('data-retention-marker', 'original-game')
    await expect(flow).toBeHidden()
    await expect(flow.locator('.vue-flow__minimap')).toHaveCount(0)
    await main.getByRole('tab', { name: '流程图', exact: true }).click()
    await expect(flow).toBeVisible()
    await expect(flow).toHaveAttribute('data-retention-marker', 'original-flow')
    expect(await viewport.evaluate(element => (element as HTMLElement).style.transform)).toBe(transform)
    if (originalNodes.length > 10)
      await expect(flow.locator('.vue-flow__minimap')).toBeVisible()
    else
      await expect(flow.locator('.vue-flow__minimap')).toHaveCount(0)
  }
  await page.screenshot({ path: info.outputPath('retained-flow-desktop.png') })
  const pane = main.locator('xpath=ancestor::div[contains(@class, "splitpanes__pane")][1]')
  await main.getByRole('tab', { name: '游戏', exact: true }).click()
  await pane.evaluate(element => Object.assign((element as HTMLElement).style, { width: '320px', flex: '0 0 320px' }))
  await main.getByRole('tab', { name: '流程图', exact: true }).click()
  expect(Math.round((await flow.boundingBox())!.width)).toBe(320)
  expect(await flow.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await flow.getByRole('button', { name: '垂直布局', exact: true }).click()
  await expect(flow.locator('.vue-flow__node').first()).toBeInViewport()
  await flow.screenshot({ path: info.outputPath('retained-flow-narrow.png') })
  await page.evaluate(() => localStorage.setItem('nuxt-color-mode', 'light'))
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/editor-light/)
  await expect(flow).toBeVisible()
  await flow.getByRole('button', { name: '水平布局', exact: true }).click()
  await expect(flow.locator('.vue-flow__node').first()).toBeInViewport()
  await page.screenshot({ path: info.outputPath('retained-flow-light.png') })

  // Leaving the workspace destroys its renderer. Returning uses a new working instance.
  await expect.poll(() => page.evaluate(() => (window as unknown as { __flowResizeTargets: number }).__flowResizeTargets)).toBeGreaterThan(0)
  await page.getByRole('menuitem', { name: '故事', exact: true }).click()
  await page.getByRole('menuitem', { name: '角色', exact: true }).click()
  await expect(page).toHaveURL(/\/characters$/)
  await expect(flow).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => (window as unknown as { __flowResizeTargets: number }).__flowResizeTargets)).toBe(0)
  await page.goBack()
  await expect(flow.locator('.vue-flow__node').first()).toBeVisible()
  await expect(flow).not.toHaveAttribute('data-retention-marker', 'original-flow')
  await expect.poll(() => page.evaluate(() => (window as unknown as { __flowResizeTargets: number }).__flowResizeTargets)).toBeGreaterThan(0)
  await flow.getByRole('button', { name: '垂直布局', exact: true }).click()
  await expect(flow.locator('.vue-flow__node').first()).toBeInViewport()
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  const diagnostics = await page.evaluate(() => {
    const root = document.getElementById('__nuxt') as HTMLElement & { __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, { diagnostics: unknown[] }> } } } } }
    return root.__vue_app__.config.globalProperties.$pinia._s.get('@advjs/editor:project')!.diagnostics
  })
  expect(diagnostics).toEqual([])
  expect(errors).toEqual([])
  if (process.env.ADVJS_LAYOUT_SCREENSHOTS)
    await page.screenshot({ path: join(process.env.ADVJS_LAYOUT_SCREENSHOTS, 'retained-flow-remount.png') })
})
