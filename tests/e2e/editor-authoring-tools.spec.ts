import type { Page } from '@playwright/test'
import type { EditorBridge } from '../../packages/advjs/node/editor'
import { Buffer } from 'node:buffer'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { createEditorBridge } from '../../packages/advjs/node/editor'

const root = resolve(import.meta.dirname, '../..')
let bridge: EditorBridge
let url: string
let temporaryRoot: string
let chapterPath: string

test.beforeEach(async () => {
  temporaryRoot = await mkdtemp(join(tmpdir(), 'advjs-authoring-tools-'))
  const projectRoot = join(temporaryRoot, 'project')
  await cp(join(root, 'tests/launch/fixtures/golden-project'), projectRoot, { recursive: true })
  await mkdir(join(projectRoot, 'adv/assets'), { recursive: true })
  await writeFile(join(projectRoot, 'adv/assets/room.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#496b87"/></svg>')
  await writeFile(join(projectRoot, 'adv/assets.json'), JSON.stringify({ schemaVersion: 2, id: 'authoring-tools', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'adv/assets' } }, assets: [{ id: 'room', kind: 'background', type: 'image', path: 'room.svg' }] }))
  chapterPath = join(projectRoot, 'adv/chapters/chapter_01.adv.md')
  bridge = await createEditorBridge({ host: '127.0.0.1', port: 0, projectRoot, publicRoot: join(root, 'editor/core/dist') })
  url = (await bridge.start()).url
})

test.afterEach(async () => {
  await bridge?.stop()
  if (temporaryRoot)
    await rm(temporaryRoot, { recursive: true, force: true })
})

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('advjs:editor:locale', 'zh-CN')
    localStorage.setItem('advjs:editor:onboarded', 'true')
  })
  await page.setViewportSize({ width: 1440, height: 900 })
})

async function draft(page: Page) {
  return page.evaluate(() => {
    const root = document.getElementById('__nuxt') as HTMLElement & { __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, { fileContent: string }> } } } } }
    return root.__vue_app__.config.globalProperties.$pinia._s.get('@advjs/editor:monaco')!.fileContent
  })
}

function previewUrl(params: Record<string, string> = {}) {
  const target = new URL(url)
  target.pathname = '/preview'
  target.search = new URLSearchParams(params).toString()
  return target.href
}

test('inserts dialogue and choices at the cursor, keeps drafts and undo, and saves only on request', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const original = await readFile(chapterPath, 'utf8')
  await page.goto(url)
  await expect(page.locator('.advjs-editor-layout')).toBeVisible()
  const main = page.locator('[data-editor-region="main"]')
  await main.getByRole('tab', { name: '文件', exact: true }).click()
  await expect(main.getByRole('button', { name: '插入对白', exact: true })).toBeDisabled()
  const navigation = page.locator('[data-editor-region="navigation"]')
  await navigation.getByRole('tab', { name: '项目', exact: true }).click()
  await navigation.getByRole('textbox', { name: '搜索项目文件', exact: true }).fill('chapter_01.adv.md')
  await navigation.getByRole('treeitem', { name: 'chapter_01.adv.md', exact: true }).dblclick()
  const source = main.locator('.file-source')
  const input = source.getByRole('textbox', { name: 'Editor content', exact: true })
  await expect(source.locator('.monaco-editor')).toBeVisible()
  await expect(input).toBeAttached()
  await expect(main.getByRole('button', { name: '插入对白', exact: true })).toBeEnabled()
  await source.locator('.monaco-editor').click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  await page.keyboard.type('existing draft')
  const before = await draft(page)
  expect(before).toContain('existing draft')
  expect(before.startsWith(original)).toBe(true)
  await main.getByRole('button', { name: '插入对白', exact: true }).click()
  await expect.poll(() => draft(page)).toBe(`${before}\n\n@角色\n对白内容。\n\n`)
  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(() => draft(page)).toBe(before)
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect.poll(() => draft(page)).toContain('@角色\n对白内容。')
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('ArrowRight')
  const beforeChoice = await draft(page)
  await source.getByRole('button', { name: '阅读', exact: true }).click()
  await main.getByRole('tab', { name: '游戏', exact: true }).click()
  await page.getByRole('menuitem', { name: '故事', exact: true }).click()
  await page.getByRole('menuitem', { name: '创建', exact: true }).hover()
  await page.getByRole('menuitem', { name: '选项', exact: true }).click()
  await expect(source.locator('.monaco-editor')).toBeVisible()
  await expect.poll(() => draft(page)).toBe(`${beforeChoice}- [ ] 选项一\n- [ ] 选项二\n\n`)
  await expect(input).toBeFocused()
  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(() => draft(page)).toBe(beforeChoice)
  expect(await readFile(chapterPath, 'utf8')).toBe(original)
  await main.getByRole('button', { name: '插入选项', exact: true }).click()
  await expect.poll(() => draft(page)).toBe(`${beforeChoice}- [ ] 选项一\n- [ ] 选项二\n\n`)
  const result = await draft(page)
  await page.screenshot({ path: info.outputPath('story-insertion-wide.png') })
  await source.getByRole('button', { name: '保存', exact: true }).click()
  await expect.poll(() => readFile(chapterPath, 'utf8')).toBe(result)
  await expect(source.getByRole('button', { name: '保存', exact: true })).toBeDisabled()
  const pane = main.locator('xpath=ancestor::div[contains(@class, "splitpanes__pane")][1]')
  await pane.evaluate(element => Object.assign((element as HTMLElement).style, { width: '320px', flex: '0 0 320px' }))
  await expect(main.getByRole('button', { name: '插入选项', exact: true })).toBeVisible()
  await main.screenshot({ path: info.outputPath('story-insertion-narrow.png') })
  await navigation.getByRole('textbox', { name: '搜索项目文件', exact: true }).fill('room.md')
  await navigation.getByRole('treeitem', { name: 'room.md', exact: true }).dblclick()
  await expect(main.getByRole('button', { name: '插入对白', exact: true })).toBeDisabled()
  expect(errors).toEqual([])
})

function triangleModel(binary: boolean) {
  const positions = Buffer.from(new Float32Array([-1, -1, 0, 1, -1, 0, 0, 1, 0]).buffer)
  const json = {
    asset: { version: '2.0' },
    buffers: [{ byteLength: positions.length, ...(!binary && { uri: `data:application/octet-stream;base64,${positions.toString('base64')}` }) }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positions.length }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-1, -1, 0], max: [1, 1, 0] }],
    materials: [{ doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [0.2, 0.5, 0.8, 1], metallicFactor: 0, roughnessFactor: 0.8 } }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  }
  if (!binary)
    return JSON.stringify(json)
  const text = JSON.stringify(json)
  const jsonBytes = Buffer.from(text.padEnd(Math.ceil(Buffer.byteLength(text) / 4) * 4, ' '))
  const header = Buffer.alloc(20)
  header.writeUInt32LE(0x46546C67, 0)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(20 + jsonBytes.length + 8 + positions.length, 8)
  header.writeUInt32LE(jsonBytes.length, 12)
  header.writeUInt32LE(0x4E4F534A, 16)
  const binaryHeader = Buffer.alloc(8)
  binaryHeader.writeUInt32LE(positions.length, 0)
  binaryHeader.writeUInt32LE(0x004E4942, 4)
  return Buffer.concat([header, jsonBytes, binaryHeader, positions])
}

test('renders actual GLB and glTF models, recovers after load failure, and handles empty or unsupported files', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  let fail = true
  const requests: string[] = []
  await page.route(url => url.pathname.startsWith('/models/'), async (route) => {
    requests.push(route.request().url())
    if (fail)
      await route.fulfill({ status: 503, body: 'temporarily unavailable' })
    else if (route.request().url().includes('.glb'))
      await route.fulfill({ contentType: 'model/gltf-binary', body: triangleModel(true) })
    else
      await route.fulfill({ contentType: 'model/gltf+json', body: triangleModel(false) })
  })
  const src = '/models/triangle%20model.glb?key=%2F'
  await page.goto(previewUrl({ fileUrl: src, type: 'GLB' }))
  const preview = page.getByRole('region', { name: '模型预览', exact: true })
  await expect(preview.getByRole('alert')).toContainText('模型加载失败')
  await preview.screenshot({ path: info.outputPath('model-preview-error.png') })
  fail = false
  await preview.getByRole('button', { name: '重试', exact: true }).click()
  await expect.poll(() => preview.locator('model-viewer').evaluate(element => (element as HTMLElement & { src: string }).src)).toBe(src)
  await expect.poll(() => preview.locator('model-viewer').evaluate(element => (element as HTMLElement & { loaded: boolean }).loaded)).toBe(true)
  await expect(preview.locator('.model-preview-overlay')).toHaveCount(0)
  await expect(preview.locator('.model-preview-source')).toHaveCount(0)
  // One binary model request per attempt; no extra fetch for a nonexistent JSON pane.
  expect(requests).toHaveLength(2)
  await preview.screenshot({ path: info.outputPath('model-preview-glb.png') })
  await page.goto(previewUrl({ fileUrl: '/models/triangle.gltf' }))
  await expect.poll(() => preview.locator('model-viewer').evaluate(element => (element as HTMLElement & { loaded: boolean }).loaded)).toBe(true)
  await expect(preview.locator('.model-preview-source .monaco-editor')).toBeVisible()
  await preview.screenshot({ path: info.outputPath('model-preview-gltf-wide.png') })
  await page.setViewportSize({ width: 320, height: 640 })
  await expect.poll(() => preview.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await preview.screenshot({ path: info.outputPath('model-preview-gltf-narrow.png') })
  await page.evaluate(() => localStorage.setItem('nuxt-color-mode', 'light'))
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/editor-light/)
  await expect(preview.locator('.model-preview-source .monaco-editor')).toBeVisible()
  await preview.screenshot({ path: info.outputPath('model-preview-gltf-light.png') })
  await page.goto(previewUrl())
  await expect(preview.getByRole('status')).toHaveText('未指定模型文件。')
  await page.goto(previewUrl({ fileUrl: '/models/file.obj' }))
  await expect(preview.getByRole('status')).toContainText('支持 glTF 和 GLB')
  expect(requests.some(request => request.includes('file.obj'))).toBe(false)
  expect(errors).toEqual([])
})
