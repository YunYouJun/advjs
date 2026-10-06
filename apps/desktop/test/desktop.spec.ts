import type { ElectronApplication, Page } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { execFile } from 'node:child_process'
import { cp, mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { parseCharacterMd } from '@advjs/parser'
import { _electron, chromium, expect, test } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

const repo = resolve(import.meta.dirname, '../../..')
let app: ElectronApplication, page: Page, workspace: string, root: string
let closed = false
const evidence = resolve(repo, 'apps/desktop/out/evidence')
async function readSource(path: string) {
  return readFile(path, 'utf8').catch((error) => {
    if (error.code === 'ENOENT')
      return ''
    throw error
  })
}
async function store<T>(id: string, action: string, args: unknown[] = []) {
  return await page.evaluate(async ({ id, action, args }) => {
    const vue = (document.querySelector('#__nuxt') as any).__vue_app__
    const pinia = vue.config.globalProperties.$pinia
    return await pinia._s.get(id)[action](...args)
  }, { id, action, args }) as T
}
async function launch() {
  closed = false
  app = await _electron.launch({ ...(process.env.ADVJS_DESKTOP_EXECUTABLE ? { executablePath: process.env.ADVJS_DESKTOP_EXECUTABLE } : {}), cwd: process.env.ADVJS_DESKTOP_EXECUTABLE ? workspace : repo, args: [...(process.env.ADVJS_DESKTOP_EXECUTABLE ? [] : [resolve(repo, 'apps/desktop')]), `--project=${root}`], env: { ...process.env, PATH: process.env.ADVJS_DESKTOP_EXECUTABLE ? '/usr/bin:/bin' : process.env.PATH, NODE_PATH: '', NODE_OPTIONS: '', ADVJS_DESKTOP_TEST_DATA: resolve(workspace, 'host') } })
  app.on('window', window => window.on('dialog', (dialog) => {
    void dialog.accept().catch(() => {})
  }))
  page = await app.firstWindow()
  await page.addInitScript(() => localStorage.setItem('advjs:editor:onboarded', 'true'))
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' || /^(?:data|blob):/u.test(route.request().url()) ? route.continue() : route.abort())
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false })
  })
  page.on('dialog', (dialog) => {
    void dialog.accept().catch(() => {})
  })
  await page.waitForFunction(() => !!window.advDesktop)
  await page.evaluate(() => localStorage.setItem('advjs:editor:onboarded', 'true'))
  await page.waitForFunction(() => (document.querySelector('#__nuxt') as any).__vue_app__?.config.globalProperties.$pinia?._s.get('@advjs/editor:project')?.project)
  await page.evaluate(() => {
    (document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties.$pinia._s.get('dialog')?.$patch({})
  })
  // Close optional onboarding through its visible control when present.
  const skip = page.getByRole('button', { name: /Skip|跳过/i })
  if (await skip.count())
    await skip.first().click()
}
async function quit() {
  const completion = app.waitForEvent('close')
  await app.evaluate(({ app }) => app.quit())
  await completion
  closed = true
  await expect.poll(async () => (await readdir(resolve(workspace, 'host'))).filter(name => name.startsWith('build-'))).toEqual([])
  // The fixture's normal shutdown completes before a new session is created.
}

test.beforeAll(async () => {
  workspace = await mkdtemp(resolve(tmpdir(), 'advjs-desktop-'))
  root = resolve(workspace, '中文 创作项目')
  await cp(resolve(repo, 'tests/launch/fixtures/golden-project'), root, { recursive: true })
  await mkdir(resolve(root, 'adv/assets'), { recursive: true })
  await writeFile(resolve(root, 'adv/assets/room.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#345"/></svg>')
  await writeFile(resolve(root, 'adv/assets.json'), JSON.stringify({ schemaVersion: 2, id: 'rain', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'adv/assets' } }, assets: [{ id: 'room', kind: 'background', type: 'image', path: 'room.svg' }] }))
  const scene = resolve(root, 'adv/scenes/room.md')
  await writeFile(scene, (await readFile(scene, 'utf8')).replace('id: room', 'id: room\nassetId: room'))
  const character = resolve(root, 'adv/characters/xiaoyu.character.md')
  await writeFile(character, `${(await readFile(character, 'utf8')).replace('name: 小雨', 'name: 小雨\ncustomOwner: preserve-me')}\n## 额外线索\n\n不能丢失。\n`)
  await mkdir(evidence, { recursive: true })
  await launch()
})
test.afterAll(async ({ browserName: _browserName }, info) => {
  if (app && !closed) {
    if (info.status !== info.expectedStatus)
      await app.evaluate(({ app }) => app.exit())
    else await quit()
  }
})

test('packaged desktop edits real sources, imports media and reopens saved data', async () => {
  const runtime = await app.evaluate(({ app }) => ({ packaged: app.isPackaged, platform: process.platform, arch: process.arch, versions: process.versions, path: process.env.PATH, cwd: process.cwd(), resources: process.resourcesPath }))
  await writeFile(resolve(evidence, 'a12-runtime.json'), JSON.stringify(runtime, null, 2))
  if (process.env.ADVJS_DESKTOP_EXECUTABLE) {
    expect(runtime.packaged).toBe(true)
    expect(runtime.path).toBe('/usr/bin:/bin')
    expect(runtime.cwd).not.toBe(repo)
  }
  const session = await page.evaluate(() => window.advDesktop!.session())
  expect(session.root).toContain('中文 创作项目')
  expect(await page.evaluate(() => typeof (window as any).require)).toBe('undefined')
  const hostKeys = await page.evaluate(() => Object.keys(window.advDesktop!))
  for (const key of ['ipcRenderer', 'require', 'exec', 'readFile']) expect(hostKeys).not.toContain(key)
  await expect(page.evaluate(() => window.advDesktop!.setDirty('invalid' as unknown as boolean))).rejects.toThrow('Invalid dirty state')
  // Navigate using the same Nuxt router used by the workspace UI.
  await page.evaluate(() => (document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties.$router.push('/characters/xiaoyu'))
  await page.getByRole('button', { name: /Edit|编辑/, exact: false }).first().click()
  await page.locator('input[id$="-name"]').fill('小雨·已保存')
  await page.locator('input[id$="-aliases"]').fill('小雨')
  await page.locator('textarea[id$="-personality"]').fill('桌面写入的性格描述。')
  await page.getByRole('button', { name: /^(Save Changes|Save|保存修改|保存)$/ }).last().click()
  await expect.poll(async () => await readFile(resolve(root, 'adv/characters/xiaoyu.character.md'), 'utf8')).toContain('桌面写入的性格描述。')
  const saved = await readFile(resolve(root, 'adv/characters/xiaoyu.character.md'), 'utf8')
  expect(saved).toContain('customOwner: preserve-me')
  expect(saved).toContain('不能丢失。')
  const image = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="256"><rect width="128" height="256" fill="#f96"/></svg>')
  await page.getByLabel('导入立绘', { exact: true }).setInputFiles({ name: '雨 立绘.svg', mimeType: 'image/svg+xml', buffer: image })
  await expect.poll(async () => await readFile(resolve(root, 'adv/characters/xiaoyu.character.md'), 'utf8')).toContain('./adv/assets/imports/')
  await page.screenshot({ path: resolve(evidence, 'a2-a3-character.png') })
  const files = await page.evaluate(() => (document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties.$pinia._s.get('@advjs/editor:project').project.files)
  const char = await readFile(resolve(root, 'adv/characters/xiaoyu.character.md'), 'utf8')
  const assetPath = parseCharacterMd(char).tachies!.default.src.slice(2)
  expect(await readFile(resolve(root, assetPath))).toEqual(image)
  await quit()
  await launch()
  expect(await store('@advjs/editor:project', 'refreshProject')).toBeDefined()
  await page.evaluate(() => (document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties.$router.push('/characters/xiaoyu'))
  await expect(page.getByText('小雨·已保存').first()).toBeVisible()
  await writeFile(resolve(evidence, 'a1-a3.json'), JSON.stringify({ project: root, executable: process.env.ADVJS_DESKTOP_EXECUTABLE ?? 'development', savedFiles: Object.keys(files), assetPath }, null, 2))
})

function wave() {
  const samples = 8000
  const bytes = Buffer.alloc(44 + samples * 2)
  bytes.write('RIFF')
  bytes.writeUInt32LE(bytes.length - 8, 4)
  bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16)
  bytes.writeUInt16LE(1, 20)
  bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(8000, 24)
  bytes.writeUInt32LE(16000, 28)
  bytes.writeUInt16LE(2, 32)
  bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36)
  bytes.writeUInt32LE(samples * 2, 40)
  for (let i = 0; i < samples; i++) bytes.writeInt16LE(Math.round(2000 * Math.sin(i * Math.PI / 10)), 44 + i * 2)
  return bytes
}

test('project audio persists metadata and binary bytes, stops on leaving the panel', async () => {
  await page.evaluate(() => (document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties.$router.push('/'))
  const skip = page.getByRole('button', { name: /Skip|跳过/i })
  await skip.waitFor({ state: 'visible', timeout: 6000 }).then(() => skip.click()).catch(() => {})
  await page.getByRole('tab', { name: /Audio|音频/, exact: false }).first().click()
  const bytes = wave()
  await page.getByLabel('导入项目音频', { exact: true }).setInputFiles({ name: '雨 声.wav', mimeType: 'audio/wav', buffer: bytes })
  await expect(page.getByLabel('音频名称', { exact: true })).toBeVisible()
  await page.getByLabel('音频名称', { exact: true }).fill('雨夜 BGM')
  await page.getByLabel('音频描述', { exact: true }).fill('本地音频，关闭重开仍一致。')
  await page.getByRole('button', { name: '保存音频', exact: true }).click()
  await expect.poll(async () => await readFile(resolve(root, 'adv/assets.json'), 'utf8')).toContain('雨夜 BGM')
  const manifest = JSON.parse(await readFile(resolve(root, 'adv/assets.json'), 'utf8'))
  const audio = manifest.assets.find((asset: { type: string }) => asset.type === 'audio')
  expect(await readFile(resolve(root, 'adv/assets', audio.path))).toEqual(bytes)
  const player = page.getByLabel('项目音频试听', { exact: true })
  await player.evaluate(async (audio: HTMLAudioElement) => {
    await audio.play()
    audio.currentTime = 0.5
    audio.pause()
  })
  expect(await player.evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(0.4)
  await page.screenshot({ path: resolve(evidence, 'a4-project-audio.png') })
  await player.evaluate(async (audio: HTMLAudioElement) => {
    await audio.play();
    (window as any).__lastAudio = audio
  })
  await page.getByRole('tab', { name: /Game|游戏/, exact: false }).first().click()
  expect(await page.evaluate(() => (window as any).__lastAudio.paused)).toBe(true)
  await writeFile(resolve(evidence, 'a4.json'), JSON.stringify({ asset: audio, binaryBytes: bytes.length, seek: true, stopped: true }, null, 2))
})

test('character draft conflicts retain both versions until explicit choice', async () => {
  await page.evaluate(() => (document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties.$router.push('/characters/xiaoyu'))
  await page.getByRole('button', { name: /Edit|编辑/, exact: false }).first().click()
  await page.locator('textarea[id$="-personality"]').fill('未保存的冲突草稿。')
  const path = resolve(root, 'adv/characters/xiaoyu.character.md')
  await writeFile(path, (await readFile(path, 'utf8')).replace('桌面写入的性格描述。', '外部作者的新版本。'))
  await expect.poll(async () => {
    return await page.evaluate(() => (document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties.$pinia._s.get('@advjs/editor:project').characters[0].personality)
  }).toContain('外部作者')
  await page.getByRole('button', { name: /^(Save Changes|Save|保存修改|保存)$/ }).last().click()
  await expect(page.getByRole('alert').filter({ hasText: /conflict/ })).toBeVisible()
  await expect(page.locator('textarea[id$="-personality"]')).toHaveValue('未保存的冲突草稿。')
  expect(await readFile(path, 'utf8')).toContain('外部作者的新版本。')
  await page.screenshot({ path: resolve(evidence, 'a5-character-conflict.png') })
  await page.getByRole('button', { name: '保留草稿并覆盖', exact: true }).click()
  await expect.poll(() => readFile(path, 'utf8')).toContain('未保存的冲突草稿。')
})

test('isolated saved-game preview and Web directory/ZIP export use the actual bundled builder', async () => {
  const manifest = JSON.parse(await readFile(resolve(root, 'adv/assets.json'), 'utf8'))
  const bgm = manifest.assets.find((asset: { type: string }) => asset.type === 'audio')
  const scriptPath = resolve(root, 'adv/chapters/chapter_01.adv.md')
  const script = await readFile(scriptPath, 'utf8')
  const commands = `\n\`\`\`yaml\n- type: background\n  name: room\n- type: bgm\n  name: ${bgm.id}\n- type: tachie\n  enter:\n    name: xiaoyu\n    status: default\n\`\`\`\n`
  await writeFile(scriptPath, script.replace(/^(---\n[\s\S]*?\n---\n)/u, `$1${commands}`))
  await writeFile(resolve(root, 'index.html'), '<!-- original author source -->')
  await page.evaluate(() => (document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties.$router.push('/'))
  const skip = page.getByRole('button', { name: /Skip|跳过/i })
  await skip.waitFor({ state: 'visible', timeout: 2000 }).then(() => skip.click()).catch(() => {})
  await page.getByRole('button', { name: '游戏预览', exact: true }).click()
  await expect.poll(async () => (await page.evaluate(() => window.advDesktop!.taskStatus()))?.state, { timeout: 120000 }).not.toBe('running')
  const status = await page.evaluate(() => window.advDesktop!.taskStatus())
  expect(status?.state, JSON.stringify(status)).toBe('succeeded')
  const preview = app.windows().find(window => window !== page)!
  expect(preview).toBeDefined()
  await preview.waitForLoadState('domcontentloaded')
  await preview.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' || /^(?:data|blob):/u.test(route.request().url()) ? route.continue() : route.abort())
  expect(await preview.evaluate(() => ({ desktop: typeof (window as any).advDesktop, node: typeof (window as any).require }))).toEqual({ desktop: 'undefined', node: 'undefined' })
  const errors: string[] = []
  preview.on('pageerror', error => errors.push(String(error)))
  preview.on('console', (message) => {
    if (message.type() === 'error')
      errors.push(message.text())
  })
  try {
    await playGame(preview)
  }
  catch (failure) {
    await preview.screenshot({ path: resolve(evidence, 'a7-game-failure.png') })
    const runtime = await preview.evaluate(() => {
      const adv = (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$adv
      return { state: adv.store.state, current: adv.store.current, diagnostics: adv.compileDiagnostics.value, chapters: adv.gameConfig.value.chapters }
    })
    throw new Error(`${String(failure)}; runtime=${JSON.stringify(runtime)}; errors=${JSON.stringify(errors)}`)
  }
  await preview.evaluate(() => (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$router.push('/start'))
  await playGame(preview)
  await preview.screenshot({ path: resolve(evidence, 'a7-isolated-preview.png') })
  await page.getByRole('button', { name: '停止预览', exact: true }).click()
  await expect.poll(() => fetch(status!.output!).then(() => 'open').catch(() => 'closed')).toBe('closed')
  expect(await readFile(resolve(root, 'index.html'), 'utf8')).toBe('<!-- original author source -->')
  const directory = resolve(workspace, 'exported-web')
  await app.evaluate(({ dialog }, destination) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: destination })
  }, directory)
  await page.getByRole('button', { name: '导出 Web 目录', exact: true }).click()
  await expect.poll(async () => (await page.evaluate(() => window.advDesktop!.taskStatus()))?.state, { timeout: 120000 }).not.toBe('running')
  const directoryStatus = await page.evaluate(() => window.advDesktop!.taskStatus())
  expect(directoryStatus?.state, JSON.stringify(directoryStatus)).toBe('succeeded')
  expect(await readFile(resolve(directory, 'index.html'), 'utf8')).toContain('<html')
  const session = await page.evaluate(() => window.advDesktop!.session())
  const applicationPath = await app.evaluate(({ app }) => app.getAppPath())
  await assertPortable(directory, [repo, root, session.token, resolve(workspace, 'host'), applicationPath, applicationPath.replace(/\/app\.asar$/u, '/runtime')])
  const zip = resolve(workspace, 'exported-web.zip')
  await app.evaluate(({ dialog }, destination) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: destination })
  }, zip)
  await page.getByRole('button', { name: '导出 ZIP', exact: true }).click()
  await expect.poll(async () => (await page.evaluate(() => window.advDesktop!.taskStatus()))?.state, { timeout: 120000 }).not.toBe('running')
  const zipStatus = await page.evaluate(() => window.advDesktop!.taskStatus())
  expect(zipStatus?.state, JSON.stringify(zipStatus)).toBe('succeeded')
  expect((await readFile(zip)).readUInt32LE(0)).toBe(0x04034B50)
  expect(errors).toEqual([])
  await writeFile(resolve(evidence, 'a7-a8.json'), JSON.stringify({ directory, zip, previewErrors: errors, sourceRestored: true }, null, 2))
})

async function assertPortable(directory: string, forbidden: string[]) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      await assertPortable(file, forbidden)
    }
    else if (/\.(?:html|js|css|json|map)$/u.test(entry.name)) {
      const content = await readFile(file, 'utf8')
      for (const value of forbidden) expect(content).not.toContain(value)
      expect(content).not.toContain('/__advjs/editor/')
    }
  }
}

async function playGame(game: Page) {
  await expect(game.locator('.start-menu-item').first()).toBeVisible({ timeout: 20000 })
  await game.locator('.start-menu-item').first().click()
  const choice = game.getByRole('button', { name: '现在打开', exact: true })
  for (let i = 0; i < 12 && !await choice.isVisible(); i++) {
    const target = game.locator('.adv-black, .adv-dialog-box').filter({ visible: true }).first()
    await expect(target).toBeVisible()
    await target.click()
    await game.waitForTimeout(100)
  }
  await expect(choice).toBeVisible()
  await choice.click()
  await expect(choice).toBeHidden()
  await expect(game.locator('.adv-dialog-box')).toContainText('无论答案是什么')
  await expect.poll(() => game.locator('.adv-tachie-box img').first().evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
  const audio = await game.evaluate(() => {
    const adv = (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$adv
    return { bgm: adv.store.state.stage.bgm, library: adv.gameConfig.value.bgm.library, diagnostics: adv.compileDiagnostics.value }
  })
  expect(audio.bgm).toBeTruthy()
  const source = audio.library[audio.bgm].src
  expect(source).toMatch(/^\.\/project-assets\//u)
  expect((await game.request.get(new URL(source, game.url()).href)).status()).toBe(200)
  expect(audio.diagnostics).toEqual([])
}

test('ZIP runs through an independent static server after Electron and its bridge close', async () => {
  const receipt = JSON.parse(await readFile(resolve(evidence, 'a7-a8.json'), 'utf8'))
  const expanded = resolve(workspace, 'unpacked')
  await mkdir(expanded)
  await promisify(execFile)('unzip', ['-q', receipt.zip, '-d', expanded])
  const origin = (await page.evaluate(() => window.advDesktop!.session())).origin
  await quit()
  await expect.poll(async () => await fetch(origin).then(() => 'open').catch(() => 'closed')).toBe('closed')
  const server = createServer(async (request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname
    const extension = path.split('.').at(-1)!
    try {
      const content = await readFile(resolve(expanded, `.${path === '/' ? '/index.html' : path}`))
      response.writeHead(200, { 'content-type': ({ html: 'text/html', js: 'text/javascript', css: 'text/css', svg: 'image/svg+xml', wav: 'audio/wav' } as Record<string, string>)[extension] ?? (path === '/' ? 'text/html' : 'application/octet-stream') })
      response.end(content)
    }
    catch {
      response.writeHead(404).end()
    }
  })
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done))
  const browser = await chromium.launch()
  const game = await browser.newPage()
  const errors: string[] = []
  game.on('pageerror', error => errors.push(String(error)))
  await game.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' || /^(?:data|blob):/u.test(route.request().url()) ? route.continue() : route.abort())
  try {
    const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`
    await game.goto(url)
    await playGame(game)
    await game.screenshot({ path: resolve(evidence, 'a9-independent-export.png') })
    expect(errors).toEqual([])
    expect(await game.evaluate(() => typeof (window as any).advDesktop)).toBe('undefined')
    await writeFile(resolve(evidence, 'a9.json'), JSON.stringify({ ...receipt, expanded, independentUrl: url, electronClosed: true, bridgeClosed: true, offlineNetwork: true, errors }, null, 2))
  }
  finally {
    await browser.close()
    await new Promise<void>((done) => {
      server.closeAllConnections()
      server.close(() => done())
    })
  }
  await launch()
})

test('AGUI character panel stays usable at 320px in light/dark modes and with keyboard focus', async () => {
  await page.evaluate(() => (document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties.$router.push('/characters/xiaoyu'))
  await page.getByRole('button', { name: /Edit|编辑/ }).first().click()
  const panel = page.locator('.character-form')
  await panel.evaluate((element) => {
    element.style.width = '320px'
    element.style.maxWidth = '320px'
  })
  for (const mode of ['light', 'dark']) {
    await page.evaluate((mode) => {
      document.documentElement.classList.remove('light', 'dark')
      document.documentElement.classList.add(mode)
    }, mode)
    await page.locator('input[id$="-name"]').focus()
    await page.keyboard.press('Tab')
    expect(await panel.evaluate(element => element.contains(document.activeElement))).toBe(true)
    expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    await panel.screenshot({ path: resolve(evidence, `a12-panel-320-${mode}.png`) })
  }
  await page.getByRole('button', { name: /^(Cancel|取消)$/ }).last().click()
  await page.evaluate(() => (document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties.$router.push('/'))
  await expect(page.getByRole('button', { name: '打开项目', exact: true }).first()).toBeVisible()
  await expect(page.locator('.fixed.z-9999')).toHaveCount(0)
  expect(await page.locator('.desktop-actions').evaluate(element => element.getBoundingClientRect().height)).toBeLessThan(70)
  await page.screenshot({ path: resolve(evidence, 'a12-desktop.png') })
})

test('creates and deletes characters, preserves relationships and an externally deleted draft', async () => {
  await page.evaluate(() => (document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties.$router.push('/characters'))
  await page.getByRole('button', { name: /New Character|新建角色/ }).click()
  await page.locator('input[id$="-id"]').fill('desktop_friend')
  await page.locator('input[id$="-name"]').fill('桌面朋友')
  await page.locator('textarea[id$="-background"]').fill('真实新增角色正文。')
  await page.getByRole('button', { name: /^(Create|Create Character|创建|创建角色)$/ }).click()
  const created = resolve(root, 'adv/characters/desktop_friend.character.md')
  await expect.poll(() => readSource(created)).toContain('真实新增角色正文。')
  await expect(page.getByRole('dialog', { name: /New Character|新建角色/ })).toBeHidden()
  await page.evaluate(() => (document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties.$router.push('/characters/desktop_friend'))
  await page.locator('input[id$="-target"]').fill('xiaoyu')
  await page.locator('input[id$="-type"]').fill('friend')
  await page.locator('input[id$="-description"]').fill('保存关系描述')
  await page.getByRole('button', { name: /Add relationship|添加关系/ }).click()
  await expect.poll(() => readFile(created, 'utf8')).toContain('保存关系描述')
  await page.getByRole('button', { name: /Edit|编辑/, exact: false }).first().click()
  await page.locator('textarea[id$="-personality"]').fill('外部删除后仍保留的草稿。')
  await rm(created)
  await page.waitForTimeout(500)
  await expect(page.locator('textarea[id$="-personality"]')).toHaveValue('外部删除后仍保留的草稿。')
  await page.getByRole('button', { name: /^(Save Changes|Save|保存修改|保存)$/ }).last().click()
  await expect(page.getByRole('alert').filter({ hasText: /conflict/ })).toBeVisible()
  await page.getByRole('button', { name: '保留草稿并覆盖', exact: true }).click()
  await expect.poll(() => readSource(created)).toContain('外部删除后仍保留的草稿。')
  await page.getByRole('button', { name: /^(Delete character|删除角色)$/ }).click()
  await expect.poll(() => readFile(created).then(() => true).catch(() => false)).toBe(false)
  await expect(page).toHaveURL(/\/characters(?:#.*)?$/u)
})

test('refreshes same-path image/audio bytes, reports missing media, and removes only references', async () => {
  await page.evaluate(() => (document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties.$router.push('/characters/xiaoyu'))
  const characterPath = resolve(root, 'adv/characters/xiaoyu.character.md')
  const characterSource = await readFile(characterPath, 'utf8')
  const char = parseCharacterMd(characterSource)
  const imagePath = resolve(root, char.tachies!.default.src.slice(2))
  const original = await readFile(imagePath)
  const thumbnail = page.locator('img[alt="default"]')
  const oldUrl = await thumbnail.getAttribute('src')
  await writeFile(imagePath, '<svg xmlns="http://www.w3.org/2000/svg" width="333" height="120"><rect width="333" height="120" fill="#acf"/></svg>')
  try {
    await expect.poll(() => thumbnail.getAttribute('src')).not.toBe(oldUrl)
  }
  catch (failure) {
    const state = await page.evaluate(() => {
      const stores = (document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties.$pinia._s
      return { revision: stores.get('@advjs/editor:project').resourceRevision, characters: stores.get('character')?.characters, console: [...stores.keys()].filter((id: string) => id.includes('console')) }
    })
    throw new Error(`${String(failure)}; image=${await thumbnail.getAttribute('src', { timeout: 100 }).catch(() => null)}; state=${JSON.stringify(state)}`)
  }
  await expect.poll(() => thumbnail.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(333)
  await rename(imagePath, `${imagePath}.missing`)
  await expect(page.getByRole('alert').filter({ hasText: '立绘资源缺失' })).toBeVisible()
  await rename(`${imagePath}.missing`, imagePath)
  await writeFile(imagePath, original)
  await page.getByLabel('导入立绘', { exact: true }).setInputFiles({ name: '替换.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="222" height="222"/>') })
  await expect.poll(() => thumbnail.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(222)
  const replaced = parseCharacterMd(await readFile(resolve(root, 'adv/characters/xiaoyu.character.md'), 'utf8')).tachies!.default.src
  expect(await readFile(imagePath)).toEqual(original)
  await page.getByRole('button', { name: /Remove tachie|移除立绘|删除立绘/i }).click()
  await expect.poll(async () => parseCharacterMd(await readFile(resolve(root, 'adv/characters/xiaoyu.character.md'), 'utf8')).tachies?.default).toBeUndefined()
  expect(await readFile(resolve(root, replaced.slice(2)))).toBeDefined()
  await page.evaluate(() => (document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties.$router.push('/'))
  await page.getByRole('tab', { name: /Audio|音频/, exact: false }).first().click()
  const manifest = JSON.parse(await readFile(resolve(root, 'adv/assets.json'), 'utf8'))
  const audio = manifest.assets.find((asset: { type: string }) => asset.type === 'audio')
  const audioPath = resolve(root, 'adv/assets', audio.path)
  const player = page.getByLabel('项目音频试听', { exact: true })
  const oldAudio = await player.getAttribute('src')
  const bytes = wave()
  bytes.writeInt16LE(1234, 46)
  await writeFile(audioPath, bytes)
  await expect.poll(() => player.getAttribute('src')).not.toBe(oldAudio)
  await player.evaluate(async (audio: HTMLAudioElement) => {
    await audio.play()
    audio.pause()
  })
  const externalManifest = JSON.parse(await readFile(resolve(root, 'adv/assets.json'), 'utf8'))
  externalManifest.assets.find((entry: { id: string }) => entry.id === audio.id).title = '外部音频名称'
  await writeFile(resolve(root, 'adv/assets.json'), JSON.stringify(externalManifest))
  await expect(page.getByLabel('音频名称', { exact: true })).toHaveValue('外部音频名称')
  await page.getByLabel('音频名称', { exact: true }).fill('待保存的音频草稿')
  externalManifest.assets.find((entry: { id: string }) => entry.id === audio.id).alt = '外部音频描述'
  await writeFile(resolve(root, 'adv/assets.json'), JSON.stringify(externalManifest))
  await expect.poll(() => store('@advjs/editor:project', 'refreshProject')).toBeDefined()
  await page.getByRole('button', { name: '保存音频', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: /conflict/ })).toBeVisible()
  await expect(page.getByLabel('音频名称', { exact: true })).toHaveValue('待保存的音频草稿')
  expect(await readFile(resolve(root, 'adv/assets.json'), 'utf8')).toContain('外部音频描述')
  await page.getByRole('button', { name: '保留草稿并覆盖', exact: true }).click()
  await expect.poll(() => readFile(resolve(root, 'adv/assets.json'), 'utf8')).toContain('待保存的音频草稿')
  await page.getByRole('button', { name: '移除音频', exact: true }).click()
  await expect(player).toHaveCount(0)
  expect(await readFile(audioPath)).toEqual(bytes)
  await page.screenshot({ path: resolve(evidence, 'a3-a5-media-refresh.png') })
  // Restore the valid story references for the following build/lifecycle checks.
  await writeFile(characterPath, characterSource)
  await writeFile(resolve(root, 'adv/assets.json'), JSON.stringify(manifest))
})

test('cancelled/failed builds preserve sources and refuse existing or unsafe destinations', async () => {
  const source = await readFile(resolve(root, 'index.html'), 'utf8')
  await page.getByRole('button', { name: '游戏预览', exact: true }).click()
  await page.evaluate(() => window.advDesktop!.cancelTask())
  await expect.poll(async () => (await page.evaluate(() => window.advDesktop!.taskStatus()))?.state).toBe('cancelled')
  // A missing scene resource fails real project preparation in the worker.
  await rename(resolve(root, 'adv/assets/room.svg'), resolve(root, 'adv/assets/room.svg.missing'))
  await page.getByRole('button', { name: '游戏预览', exact: true }).click()
  await expect.poll(async () => (await page.evaluate(() => window.advDesktop!.taskStatus()))?.state, { timeout: 30000 }).toBe('failed')
  expect((await page.evaluate(() => window.advDesktop!.taskStatus()))?.error).toContain('Missing project resource')
  await rename(resolve(root, 'adv/assets/room.svg.missing'), resolve(root, 'adv/assets/room.svg'))
  const existing = resolve(workspace, 'existing')
  await mkdir(existing)
  await writeFile(resolve(existing, 'keep.txt'), 'untouched')
  for (const destination of [existing, root]) {
    await app.evaluate(({ dialog }, destination) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: destination })
    }, destination)
    await page.getByRole('button', { name: '导出 Web 目录', exact: true }).click()
    await expect(page.getByRole('alert')).toBeVisible()
  }
  expect(await readFile(resolve(existing, 'keep.txt'), 'utf8')).toBe('untouched')
  expect(await readFile(resolve(root, 'index.html'), 'utf8')).toBe(source)
  await page.screenshot({ path: resolve(evidence, 'a8-failure.png') })
})

test('native lifecycle cancellation, switching, reload, service reconnect and credential boundaries', async () => {
  const first = await page.evaluate(() => window.advDesktop!.session())
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false })
    dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] })
  })
  expect(await page.evaluate(() => window.advDesktop!.openProject())).toBe(false)
  expect((await page.evaluate(() => window.advDesktop!.session())).token).toBe(first.token)
  await app.evaluate(({ dialog }, invalid) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [invalid] })
  }, workspace)
  expect(await page.evaluate(() => window.advDesktop!.openProject())).toBe(false)
  expect((await page.evaluate(() => window.advDesktop!.session())).token).toBe(first.token)
  await page.evaluate(() => (document.querySelector('#__nuxt') as any).__vue_app__.config.globalProperties.$router.push('/characters/xiaoyu'))
  await page.getByRole('button', { name: /Edit|编辑/, exact: false }).first().click()
  await page.locator('textarea[id$="-personality"]').fill('服务恢复后保存的草稿。')
  expect(await page.evaluate(() => window.advDesktop!.closeProject())).toBe(false)
  await expect(page.locator('textarea[id$="-personality"]')).toHaveValue('服务恢复后保存的草稿。')
  const hostPid = await app.evaluate(({ app }) => app.getAppMetrics().find(item => item.name === 'ADV.JS Project Host')?.pid)
  expect(hostPid).toBeDefined()
  process.kill(hostPid!, 'SIGKILL')
  await page.waitForTimeout(300)
  expect(await page.evaluate(() => window.advDesktop!.reconnect())).toBe(true)
  const refreshed = await page.evaluate(() => window.advDesktop!.session())
  expect(refreshed.token).not.toBe(first.token)
  await expect(page.locator('textarea[id$="-personality"]')).toHaveValue('服务恢复后保存的草稿。')
  await page.getByRole('button', { name: /^(Save Changes|Save|保存修改|保存)$/ }).last().click()
  await expect.poll(() => readFile(resolve(root, 'adv/characters/xiaoyu.character.md'), 'utf8')).toContain('服务恢复后保存的草稿。')
  await page.reload()
  await page.waitForFunction(() => !!(document.querySelector('#__nuxt') as any).__vue_app__?.config.globalProperties.$pinia?._s.get('@advjs/editor:project')?.project)
  const other = resolve(workspace, '第二个 项目')
  await cp(root, other, { recursive: true })
  await app.evaluate(({ dialog }, other) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [other] })
    dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false })
  }, other)
  await page.evaluate(() => {
    void window.advDesktop!.openProject()
  })
  await expect.poll(async () => (await page.evaluate(() => window.advDesktop!.session())).root).toContain('第二个 项目')
  const recent = await page.evaluate(() => window.advDesktop!.recentProjects())
  await page.evaluate((id) => {
    void window.advDesktop!.openRecent(id)
  }, recent.find(item => item.name === '中文 创作项目')!.id)
  await expect.poll(async () => (await page.evaluate(() => window.advDesktop!.session())).root).toContain('中文 创作项目')
  await expect.poll(() => page.evaluate(() => (document.querySelector('#__nuxt') as any).__vue_app__?.config.globalProperties.$pinia?._s.get('@advjs/editor:project')?.rootDir?.name).catch(() => undefined)).toBe('中文 创作项目')
  await expect(page.locator('.fixed.z-9999')).toHaveCount(0)
  const session = await page.evaluate(() => window.advDesktop!.session())
  expect(await fetch(`${session.origin}/__advjs/api/project`).then(response => response.status)).toBe(401)
  expect(await fetch(`${session.origin}/__advjs/api/file?path=../../etc/passwd`, { headers: { authorization: `Bearer ${session.token}` } }).then(response => response.status)).toBe(400)
  expect(await page.evaluate(token => ({ markup: document.documentElement.outerHTML.includes(token), local: Object.values(localStorage).some(value => value.includes(token)), session: Object.values(sessionStorage).some(value => value.includes(token)), url: location.href.includes(token) }), session.token)).toEqual({ markup: false, local: false, session: false, url: false })
  await expect(page.evaluate(() => window.advDesktop!.openRecent('../escape'))).rejects.toThrow('Unknown recent project')
  await page.screenshot({ path: resolve(evidence, 'a6-session-recovery.png') })
})

test('trusted existing CLI project builds without project dependencies and rejects changed config until retrusted', async () => {
  const cli = resolve(workspace, 'CLI starter 项目')
  await cp(resolve(repo, 'demo/starter'), cli, { recursive: true, filter: path => !path.split('/').some(part => ['node_modules', 'dist', '.nuxt', '.output', '.advjs'].includes(part)) })
  await app.evaluate(({ dialog }, cli) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [cli] })
    dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false })
  }, cli)
  expect(await page.evaluate(() => window.advDesktop!.openProject())).toBe(false)
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false })
  })
  await page.evaluate(() => {
    void window.advDesktop!.openProject()
  })
  await expect.poll(async () => (await page.evaluate(() => window.advDesktop!.session())).root).toContain('CLI starter 项目')
  await page.waitForFunction(() => !!(document.querySelector('#__nuxt') as any).__vue_app__?.config.globalProperties.$pinia?._s.get('@advjs/editor:project')?.project)
  const skip = page.getByRole('button', { name: /Skip|跳过/i })
  await skip.waitFor({ state: 'visible', timeout: 1500 }).then(() => skip.click()).catch(() => {})
  await page.getByRole('button', { name: '游戏预览', exact: true }).click()
  await expect.poll(async () => (await page.evaluate(() => window.advDesktop!.taskStatus()))?.state, { timeout: 120000 }).not.toBe('running')
  const original = await page.evaluate(() => window.advDesktop!.taskStatus())
  expect(original?.state).toBe('failed')
  expect(original?.error).toContain('packages/shared')
  // The repository example uses a development-only alias outside its project.
  // Keep its story/adv config and use the ordinary independent Vite setup.
  await writeFile(resolve(cli, 'vite.config.ts'), 'export default {}\n')
  expect(await page.evaluate(() => window.advDesktop!.reconnect())).toBe(true)
  await page.getByRole('button', { name: '游戏预览', exact: true }).click()
  await expect.poll(async () => (await page.evaluate(() => window.advDesktop!.taskStatus()))?.state, { timeout: 120000 }).not.toBe('running')
  const portable = await page.evaluate(() => window.advDesktop!.taskStatus())
  expect(portable?.state, JSON.stringify(portable)).toBe('succeeded')
  const preview = app.windows().find(window => window !== page)!
  await expect(preview.locator('.start-menu-item').first()).toBeVisible({ timeout: 20000 })
  await preview.locator('.start-menu-item').first().click()
  for (let i = 0; i < 4 && !await preview.locator('.adv-dialog-box').isVisible(); i++) {
    await expect(preview.locator('.adv-black')).toBeVisible()
    await preview.locator('.adv-black').click()
    await preview.waitForTimeout(100)
  }
  await expect(preview.locator('.adv-dialog-box')).toContainText('欢迎来到 ADV.JS')
  await preview.screenshot({ path: resolve(evidence, 'a1-cli-project.png') })
  await page.evaluate(() => window.advDesktop!.stopPreview())
  const configPath = resolve(cli, 'adv.config.ts')
  await writeFile(configPath, `${await readFile(configPath, 'utf8')}\n// external config edit\n`)
  await expect(page.evaluate(() => window.advDesktop!.preview())).rejects.toThrow('可执行配置已变更')
  const session = await page.evaluate(() => window.advDesktop!.session())
  const response = await fetch(`${session.origin}/__advjs/api/project`, { headers: { authorization: `Bearer ${session.token}` } })
  expect(response.status).toBe(500)
  expect(await response.text()).toContain('可执行配置已变更')
  expect(await page.evaluate(() => window.advDesktop!.reconnect())).toBe(true)
  await writeFile(resolve(evidence, 'a1-cli.json'), JSON.stringify({ root: cli, dependenciesInstalled: false, trustCancellation: true, changedConfigBlocked: true, retrusted: true }, null, 2))
})
