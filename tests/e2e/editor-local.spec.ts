import type { EditorBridge, EditorBridgeReadyEvent } from '../../packages/advjs/node/editor'
import { cp, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { expect, test } from '@playwright/test'
import { createEditorBridge } from '../../packages/advjs/node/editor'

const repositoryRoot = resolve(import.meta.dirname, '../..')
let bridge: EditorBridge | undefined
let ready: EditorBridgeReadyEvent
let temporaryRoot = ''
let projectRoot = ''

test.beforeAll(async () => {
  const publicRoot = resolve(repositoryRoot, 'editor/core/dist')
  await stat(resolve(publicRoot, 'index.html'))
  temporaryRoot = await mkdtemp(join(tmpdir(), 'advjs-editor-local-e2e-'))
  projectRoot = join(temporaryRoot, 'project')
  await cp(resolve(repositoryRoot, 'tests/launch/fixtures/golden-project'), projectRoot, { recursive: true })
  bridge = await createEditorBridge({
    host: '127.0.0.1',
    port: 0,
    projectRoot,
    publicRoot,
  })
  ready = await bridge.start()
})

test.afterAll(async () => {
  await bridge?.stop()
  if (temporaryRoot)
    await rm(temporaryRoot, { force: true, recursive: true })
})

test('loads, live-refreshes, resolves conflicts, and saves the source project', async ({ browserName, page }) => {
  test.skip(browserName !== 'chromium', 'The launch support matrix targets Chromium stable')
  const launchUrl = new URL(ready.url)
  const token = new URLSearchParams(launchUrl.hash.slice(1)).get('advjs-token')!
  const thirdPartyRequests: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if ((url.protocol === 'http:' || url.protocol === 'https:') && url.origin !== launchUrl.origin)
      thirdPartyRequests.push(url.href)
  })

  const projectResponse = page.waitForResponse(response => response.url().endsWith('/__advjs/api/project'), { timeout: 10_000 })
  await page.goto(ready.url)
  const loadedProjectResponse = await projectResponse
  expect(loadedProjectResponse.status()).toBe(200)
  const skipOnboarding = page.getByText('Skip', { exact: true })
  if (await skipOnboarding.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false))
    await skipOnboarding.click()
  await expect(page.getByRole('dialog', { name: 'Welcome to ADV.JS Editor' })).toBeHidden()
  expect(page.url()).not.toContain('advjs-token')
  expect(await page.evaluate(sessionToken => ({
    document: document.documentElement.outerHTML.includes(sessionToken),
    localStorage: Object.values(localStorage).some(value => value.includes(sessionToken)),
    sessionStorage: Object.values(sessionStorage).some(value => value.includes(sessionToken)),
  }), token)).toEqual({ document: false, localStorage: false, sessionStorage: false })
  await expect(page.getByText('Live local workspace')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('1 chapters')).toBeVisible()
  await expect(page.getByText('1 characters')).toBeVisible()
  await expect(page.getByText('1 scenes')).toBeVisible()
  const startSourcePreview = page.getByRole('button', { name: 'Start source preview' })
  await expect(startSourcePreview).toBeVisible()
  await expect(stat(join(projectRoot, 'dist'))).rejects.toThrow()
  await startSourcePreview.click()
  await expect(startSourcePreview).toBeHidden({ timeout: 15_000 })
  await expect(stat(join(projectRoot, 'dist'))).rejects.toThrow()

  await writeFile(join(projectRoot, 'adv/characters/agent.character.md'), [
    '---',
    'id: agent',
    'name: Agent',
    '---',
    '',
    '# Agent',
    '',
  ].join('\n'), 'utf8')
  await expect(page.getByText('2 characters')).toBeVisible({ timeout: 10_000 })

  await page.getByText('adv/chapters/chapter_01.adv.md', { exact: true }).dblclick()
  await expect(page.getByText('chapter_01.adv.md', { exact: true })).toBeVisible()

  const editor = page.locator('.monaco-editor').last()
  await editor.click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
  await page.keyboard.type('# Unsaved Editor change')

  const chapterPath = join(projectRoot, 'adv/chapters/chapter_01.adv.md')
  await writeFile(chapterPath, '# External Agent change\n', 'utf8')
  const conflictMessage = page.getByText('This file changed outside the Editor while you have unsaved edits.')
  await expect(conflictMessage).toBeVisible({ timeout: 10_000 })

  await page.getByRole('button', { name: 'Use external' }).click()
  await expect(conflictMessage).toBeHidden()
  await editor.click()
  await page.keyboard.press('End')
  await page.keyboard.insertText('\n# SavedFromEditor')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect.poll(async () => await readFile(chapterPath, 'utf8')).toContain('# SavedFromEditor')
  await expect(stat(join(projectRoot, 'dist'))).rejects.toThrow()
  expect(thirdPartyRequests).toEqual([])
})
