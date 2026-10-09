import type { ElectronApplication, Page } from '@playwright/test'
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'
import { _electron, expect, test } from '@playwright/test'

const repositoryRoot = resolve(import.meta.dirname, '../../..')

async function selectNativeAction(app: ElectronApplication, command: string) {
  await app.evaluate(async ({ Menu, BrowserWindow }, command) => {
    const item = Menu.getApplicationMenu()!.getMenuItemById(`desktop.${command}`)!
    if (!item.enabled)
      throw new Error(`Disabled native action: ${command}`)
    await item.click(item, BrowserWindow.getAllWindows()[0], {} as never)
  }, command)
}

async function openedFileState(page: Page) {
  return page.evaluate(() => {
    const root = document.getElementById('__nuxt') as HTMLElement & {
      __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, unknown> } } } }
    }
    const stores = root.__vue_app__.config.globalProperties.$pinia._s
    const file = stores.get('file') as { openedFilePath: string, isDirty: boolean }
    const monaco = stores.get('@advjs/editor:monaco') as { fileContent: string }
    const project = stores.get('@advjs/editor:project') as { chapters: { id: string }[], scenes: { id: string, name?: string }[] }
    return { path: file.openedFilePath, content: monaco.fileContent, dirty: file.isDirty, chapters: project.chapters.map(chapter => chapter.id), scenes: project.scenes.map(({ id, name }) => ({ id, name })) }
  })
}

async function expectOpenedSource(page: Page, path: string, content: string) {
  await expect(page).toHaveURL(/\/$/)
  const main = page.locator('[data-editor-region="main"]')
  await expect(main.getByRole('tab', { name: 'File', exact: true })).toHaveAttribute('data-state', 'active')
  await expect(main.locator('.file-source .monaco-editor')).toBeVisible()
  await expect(main.getByRole('button', { name: 'Source', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(async () => (await openedFileState(page)).path).toBe(path)
  await expect.poll(async () => (await openedFileState(page)).content).toBe(content)
}

test('native Story creation writes all three content types, returns from character routes, and preserves unsaved character drafts', async ({ browserName: _browserName }, info) => {
  test.skip(process.platform !== 'darwin', 'macOS native menu acceptance')
  const workspace = await realpath(await mkdtemp(resolve(tmpdir(), 'advjs-native-content-')))
  const projectRoot = resolve(workspace, 'project')
  const hostRoot = resolve(workspace, 'host')
  await cp(resolve(repositoryRoot, 'tests/launch/fixtures/golden-project'), projectRoot, { recursive: true })
  await mkdir(resolve(projectRoot, 'adv/assets'), { recursive: true })
  await writeFile(resolve(projectRoot, 'adv/assets/room.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#496b87"/></svg>')
  await writeFile(resolve(projectRoot, 'adv/assets.json'), JSON.stringify({ schemaVersion: 2, id: 'native-creation', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'adv/assets' } }, assets: [{ id: 'room', kind: 'background', type: 'image', path: 'room.svg' }] }))
  const scenePath = resolve(projectRoot, 'adv/scenes/room.md')
  await writeFile(scenePath, (await readFile(scenePath, 'utf8')).replace('id: room', 'id: room\nassetId: room'))
  await mkdir(hostRoot, { recursive: true })
  await writeFile(resolve(hostRoot, 'editor-preferences.json'), JSON.stringify({ locale: 'en', onboarded: true }))
  let app: ElectronApplication | undefined
  try {
    app = await _electron.launch({
      ...(process.env.ADVJS_DESKTOP_EXECUTABLE ? { executablePath: process.env.ADVJS_DESKTOP_EXECUTABLE } : {}),
      cwd: workspace,
      args: [...(process.env.ADVJS_DESKTOP_EXECUTABLE ? [] : [resolve(repositoryRoot, 'apps/desktop')]), `--project=${projectRoot}`],
      env: { ...process.env, PATH: process.env.ADVJS_DESKTOP_EXECUTABLE ? '/usr/bin:/bin' : process.env.PATH, NODE_PATH: '', NODE_OPTIONS: '', ADVJS_DESKTOP_TEST_DATA: hostRoot },
    })
    const page = await app.firstWindow()
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' || /^(?:data|blob):/u.test(route.request().url()) ? route.continue() : route.abort())
    await expect(page.locator('.advjs-editor-layout')).toBeVisible()
    await expect(page.locator('.ae-editor-splash')).toHaveCount(0)
    expect(await page.evaluate(() => window.advDesktop!.nativeMenu)).toBe(true)
    await expect(page.getByRole('menubar')).toHaveCount(0)
    const menu = await app.evaluate(({ Menu }) => ['create-world', 'create-scene', 'create-chapter'].map(command => ({ id: command, enabled: Menu.getApplicationMenu()!.getMenuItemById(`desktop.${command}`)!.enabled })))
    expect(menu.every(item => item.enabled)).toBe(true)

    await selectNativeAction(app, 'create-world')
    const world = page.getByRole('dialog', { name: 'Create world', exact: true })
    await expect(world).toBeVisible()
    await world.getByRole('textbox', { name: 'Name', exact: true }).fill('Native world')
    await world.getByRole('button', { name: 'Create and edit', exact: true }).click()
    await expect(world).toBeHidden()
    const worldContent = await readFile(resolve(projectRoot, 'adv/world.md'), 'utf8')
    expect(worldContent).toContain('Native world')
    await expectOpenedSource(page, 'adv/world.md', worldContent)

    await selectNativeAction(app, 'characters')
    await expect(page).toHaveURL(/\/characters$/)
    await selectNativeAction(app, 'create-scene')
    const scene = page.getByRole('dialog', { name: 'Create scene', exact: true })
    await expect(scene).toBeVisible()
    await scene.getByRole('textbox', { name: 'Name', exact: true }).fill('Native library')
    await scene.getByRole('textbox', { name: 'ID', exact: true }).fill('native-library')
    await scene.getByRole('button', { name: 'Create and edit', exact: true }).click()
    await expect(scene).toBeHidden()
    const sceneContent = await readFile(resolve(projectRoot, 'adv/scenes/native-library.md'), 'utf8')
    expect(sceneContent).toContain('Native library')
    await expectOpenedSource(page, 'adv/scenes/native-library.md', sceneContent)
    await expect.poll(async () => (await openedFileState(page)).scenes).toContainEqual({ id: 'native-library', name: 'Native library' })

    await selectNativeAction(app, 'characters')
    await expect(page).toHaveURL(/\/characters$/)
    await page.getByText('小雨', { exact: true }).first().click()
    await expect(page).toHaveURL(/\/characters\/xiaoyu$/)
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click()
    const characterName = page.locator('.character-form input[id$="-name"]')
    await characterName.fill('Native unsaved character')
    const characterPath = resolve(projectRoot, 'adv/characters/xiaoyu.character.md')
    const originalCharacter = await readFile(characterPath, 'utf8')
    await selectNativeAction(app, 'create-chapter')
    const chapter = page.getByRole('dialog', { name: 'Create chapter', exact: true })
    await expect(chapter).toBeVisible()
    await chapter.getByRole('textbox', { name: 'Name', exact: true }).fill('Native next chapter')
    await chapter.getByRole('textbox', { name: 'ID', exact: true }).fill('native-next')
    await chapter.getByRole('button', { name: 'Create and edit', exact: true }).click()
    await expect(chapter.getByRole('alert')).toContainText('Save or discard')
    await page.screenshot({ path: info.outputPath('native-content-character-draft.png') })
    await chapter.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(chapter).toBeHidden()
    await expect(page).toHaveURL(/\/characters\/xiaoyu$/)
    await expect(characterName).toHaveValue('Native unsaved character')
    expect(await readFile(characterPath, 'utf8')).toBe(originalCharacter)
    await expect(readFile(resolve(projectRoot, 'adv/chapters/native-next.adv.md'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
    await page.locator('.character-form').getByRole('button', { name: 'Cancel', exact: true }).click()

    await selectNativeAction(app, 'create-chapter')
    await expect(chapter).toBeVisible()
    await chapter.getByRole('textbox', { name: 'Name', exact: true }).fill('Native next chapter')
    await chapter.getByRole('textbox', { name: 'ID', exact: true }).fill('native-next')
    await chapter.getByRole('button', { name: 'Create and edit', exact: true }).click()
    await expect(chapter).toBeHidden()
    const chapterContent = await readFile(resolve(projectRoot, 'adv/chapters/native-next.adv.md'), 'utf8')
    expect(chapterContent).toContain('Native next chapter')
    await expectOpenedSource(page, 'adv/chapters/native-next.adv.md', chapterContent)
    await expect.poll(async () => (await openedFileState(page)).chapters).toContain('native-next')
    expect((await openedFileState(page)).dirty).toBe(false)
    await page.screenshot({ path: info.outputPath('native-content-created-source.png') })
    expect(errors).toEqual([])
  }
  finally {
    try {
      await app?.close()
    }
    finally {
      await rm(workspace, { recursive: true, force: true })
    }
  }
})
