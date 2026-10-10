import type { Page } from '@playwright/test'
import type { EditorBridge } from '../../packages/advjs/node/editor'
import { resolve } from 'node:path'
import { expect } from '@playwright/test'
import { createEditorBridge } from '../../packages/advjs/node/editor'
import { test } from './fixtures/browser-workspace'

let bridge: EditorBridge
let editorUrl: string
const directoryName = '恢复测试-project-with-a-long-name'

async function savedProjectSummary(page: Page) {
  return await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolveDatabase, reject) => {
      const request = indexedDB.open('advjs-editor-workspaces', 1)
      request.onsuccess = () => resolveDatabase(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      return await new Promise<{ count: number, hasHandle: boolean }>((resolveSaved) => {
        const request = db.transaction('sessions').objectStore('sessions').get('browser')
        request.onsuccess = () => resolveSaved({ count: request.result?.projects.length ?? 0, hasHandle: request.result?.projects[0]?.handle instanceof FileSystemDirectoryHandle })
      })
    }
    finally { db.close() }
  })
}

test.beforeAll(async () => {
  bridge = await createEditorBridge({
    host: '127.0.0.1',
    port: 0,
    projectRoot: resolve(import.meta.dirname, '../launch/fixtures/golden-project'),
    publicRoot: resolve(import.meta.dirname, '../../editor/core/dist'),
  })
  // Serve the packaged Web UI without selecting a Local Bridge session.
  editorUrl = new URL((await bridge.start()).url).origin
})

test.afterAll(async () => await bridge?.stop())

test('creates the shared Starter example with an intact binary portrait in a browser directory', async ({ browserName, page }) => {
  test.skip(browserName !== 'chromium', 'File System Access support targets Chromium')
  await page.addInitScript(() => {
    localStorage.setItem('advjs:editor:onboarded', 'true')
    localStorage.setItem('advjs:editor:locale', 'en')
    window.showDirectoryPicker = async () => await (await navigator.storage.getDirectory()).getDirectoryHandle('Starter example', { create: true })
  })
  await page.goto(editorUrl)
  const project = page.getByRole('tabpanel', { name: 'Project', exact: true })
  await project.getByRole('button', { name: 'Create example project', exact: true }).click()
  await expect(page.getByText('Browser workspace', { exact: true })).toBeVisible()
  const created = await page.evaluate(async () => {
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('Starter example')
    const config = JSON.parse(await (await (await root.getFileHandle('adv.config.json')).getFile()).text())
    const img = await (await (await root.getDirectoryHandle('public')).getDirectoryHandle('img')).getDirectoryHandle('characters')
    const portrait = await (await img.getFileHandle('xiaoyun.webp')).getFile()
    const adv = await root.getDirectoryHandle('adv')
    const settings = await adv.getDirectoryHandle('settings')
    const game = JSON.parse(await (await (await settings.getFileHandle('game.json')).getFile()).text())
    const chapters = await adv.getDirectoryHandle('chapters')
    return { config, title: game.title, bytes: portrait.size, header: new TextDecoder().decode((await portrait.arrayBuffer()).slice(0, 4)), chapter: await (await (await chapters.getFileHandle('hello.adv.md')).getFile()).text() }
  })
  expect(created.config.showCharacterAvatar).toBe(true)
  expect(created.title).toBe('Starter example')
  expect(created.bytes).toBeGreaterThan(1000)
  expect(created.header).toBe('RIFF')
  expect(created.chapter).toContain('[看看语法](#syntax)')
})

test('restores a structured-cloned directory, requests permission on click, and forgets removed entries', async ({ browserName, page }, testInfo) => {
  test.skip(browserName !== 'chromium', 'File System Access support targets Chromium')
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript((name) => {
    localStorage.setItem('advjs:editor:onboarded', 'true')
    localStorage.setItem('advjs:editor:locale', 'en')
    // Real browser handles + real IndexedDB exercise structured cloning. Only
    // the OS picker and permission prompt are replaced for headless automation.
    window.showDirectoryPicker = async () => {
      return await (await navigator.storage.getDirectory()).getDirectoryHandle(name)
    }
    const queryPermission = FileSystemHandle.prototype.queryPermission
    FileSystemHandle.prototype.queryPermission = async function (options) {
      return localStorage.getItem('recovery-test-permission') === 'prompt' ? 'prompt' : await queryPermission.call(this, options)
    }
    FileSystemHandle.prototype.requestPermission = async () => {
      if (!navigator.userActivation.isActive)
        throw new DOMException('Permission must be requested from a click', 'SecurityError')
      localStorage.setItem('recovery-test-requested', 'true')
      localStorage.removeItem('recovery-test-permission')
      return 'granted'
    }
  }, directoryName)
  await page.goto(editorUrl)
  await page.evaluate(async (name) => {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true })
    const config = await (await dir.getFileHandle('adv.config.json', { create: true })).createWritable()
    await config.write('{"id":"recovery-test","root":"adv"}')
    await config.close()
    const adv = await dir.getDirectoryHandle('adv', { create: true })
    const chapters = await adv.getDirectoryHandle('chapters', { create: true })
    const intro = await (await chapters.getFileHandle('intro.adv.md', { create: true })).createWritable()
    await intro.write('# Intro\n\nAlice: Hello.\n')
    await intro.close()
  }, directoryName)
  const start = page.getByRole('tabpanel', { name: 'Project', exact: true })
  const game = page.getByRole('tabpanel', { name: 'Game', exact: true })
  await expect(page.locator('.project-start')).toHaveCount(1)
  await expect(game).toContainText('No game to preview')
  await start.getByText('More ways to start', { exact: true }).click()
  await start.getByRole('button', { name: 'Online configuration Load remote adv.config' }).click()
  await expect(page.getByRole('dialog', { name: 'Load Online ADV Config File' })).toBeVisible()
  await page.keyboard.press('Escape')
  await start.getByRole('button', { name: 'Open local project', exact: true }).click()
  await expect(page.getByText('Browser workspace', { exact: true })).toBeVisible()

  // Wait for the transaction to commit before refreshing, as a user would
  // after the open operation has completed.
  await expect.poll(async () => (await savedProjectSummary(page)).hasHandle).toBe(true)
  await page.reload()
  await expect(page.getByText('Browser workspace', { exact: true })).toBeVisible()
  await expect(page.getByText(directoryName, { exact: true }).first()).toBeVisible()

  await page.evaluate(() => localStorage.setItem('recovery-test-permission', 'prompt'))
  await page.reload()
  const recovery = start.locator('.project-recovery')
  await expect(recovery).toContainText('Grant folder access')
  expect(await page.evaluate(() => localStorage.getItem('recovery-test-requested'))).toBeNull()
  await expect(page.locator('.z-9999')).toBeHidden()
  await page.screenshot({ path: testInfo.outputPath('recovery-desktop.png') })

  await start.locator('.project-start').evaluate((element) => {
    element.style.maxWidth = '320px'
  })
  const grant = start.getByRole('button', { name: 'Grant access', exact: true })
  await grant.focus()
  await page.screenshot({ path: testInfo.outputPath('recovery-narrow.png') })
  expect(await recovery.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await grant.click()
  await expect(page.getByText('Browser workspace', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('recovery-test-requested'))).toBe('true')

  await page.evaluate(() => localStorage.setItem('recovery-test-permission', 'prompt'))
  await page.reload()
  await expect(recovery).toContainText('Grant folder access')
  await start.getByRole('button', { name: `Remove ${directoryName}`, exact: true }).click()
  await expect(recovery).toBeHidden()
  await expect.poll(async () => (await savedProjectSummary(page)).count).toBe(0)
  await page.reload()
  await expect(start.getByRole('button', { name: 'Open local project', exact: true })).toBeVisible()
  await expect(recovery).toBeHidden()
  await expect(page.getByText('Browser workspace', { exact: true })).toBeHidden()
})
