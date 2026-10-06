import type { IpcMainInvokeEvent, UtilityProcess } from 'electron'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { app, BrowserWindow, dialog, ipcMain, Menu, utilityProcess } from 'electron'
import { projectConfigFingerprint } from './project-trust.js'
import { createDesktopTasks } from './tasks.js'

if (process.env.ADVJS_DESKTOP_TEST_DATA)
  app.setPath('userData', process.env.ADVJS_DESKTOP_TEST_DATA)
const root = app.getAppPath()
const runtimeRoot = app.isPackaged ? resolve(process.resourcesPath, 'runtime') : root
const publicRoot = app.isPackaged
  ? resolve(runtimeRoot, 'node_modules/@advjs/editor/dist')
  : resolve(root, '../../editor/core/dist')
const tasks = createDesktopTasks(runtimeRoot, resolve(app.isPackaged ? runtimeRoot : root, 'dist/build-worker.mjs'))
let window: BrowserWindow
let service: UtilityProcess | undefined
let session: { origin: string, token: string, root?: string } | undefined
let dirty = false
let leaving = false
let opening = false
let quitting = false
let trustedConfig = ''
interface RecentProject { id: string, name: string, path: string }
let recent: RecentProject[] = []
interface EditorPreferences { locale?: 'en' | 'zh-CN', onboarded: boolean }
let preferences: EditorPreferences = { onboarded: false }
let preferenceWrite = Promise.resolve()
const commandRequests = new Map<string, (success: boolean) => void>()
const recentFile = () => resolve(app.getPath('userData'), 'recent-projects.json')
const preferencesFile = () => resolve(app.getPath('userData'), 'editor-preferences.json')

function setPreferences(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid editor preferences')
  const patch = value as Record<string, unknown>
  if (Object.keys(patch).some(key => key !== 'locale' && key !== 'onboarded')
    || ('locale' in patch && patch.locale !== 'en' && patch.locale !== 'zh-CN')
    || ('onboarded' in patch && typeof patch.onboarded !== 'boolean')) {
    throw new Error('Invalid editor preferences')
  }
  const write = preferenceWrite.then(async () => {
    const next = { ...preferences, ...patch } as EditorPreferences
    const temporary = `${preferencesFile()}.tmp`
    await writeFile(temporary, JSON.stringify(next, null, 2))
    await rename(temporary, preferencesFile())
    preferences = next
  })
  preferenceWrite = write.catch(() => {})
  return write
}

function assertCaller(event: IpcMainInvokeEvent) {
  if (event.sender !== window?.webContents || event.senderFrame !== window.webContents.mainFrame
    || !session || new URL(event.senderFrame.url).origin !== session.origin) {
    throw new Error('Unauthorized desktop caller')
  }
}
function command(action: string) {
  return new Promise<boolean>((resolveResult) => {
    const id = randomUUID()
    const timer = setTimeout(() => {
      commandRequests.delete(id)
      resolveResult(false)
    }, 30_000)
    commandRequests.set(id, (success) => {
      clearTimeout(timer)
      commandRequests.delete(id)
      resolveResult(success)
    })
    window.webContents.send('desktop:command', id, action)
  })
}
async function prepareToLeave() {
  if (!dirty)
    return true
  const result = await dialog.showMessageBox(window, { type: 'question', message: '项目有未保存内容', buttons: ['保存并继续', '取消'], defaultId: 0, cancelId: 1 })
  return result.response === 0 && await command('save')
}
async function trustProject(path: string, reopening = false) {
  const fingerprint = await projectConfigFingerprint(path)
  if (fingerprint && (!reopening || fingerprint !== trustedConfig)) {
    const trust = await dialog.showMessageBox(window, { type: 'warning', message: '此项目包含可执行配置', detail: '只打开你信任的项目。配置会在项目服务中运行，并可访问本机文件。', buttons: ['信任并打开', '取消'], cancelId: 1 })
    if (trust.response !== 0)
      return undefined
  }
  return fingerprint
}
async function stopService(child: UtilityProcess | undefined) {
  if (!child)
    return
  if (child === service)
    service = undefined
  await new Promise<void>((done) => {
    const timer = setTimeout(() => {
      child.kill()
      done()
    }, 2000)
    child.once('exit', () => {
      clearTimeout(timer)
      done()
    })
    try {
      child.postMessage('stop')
    }
    catch {
      clearTimeout(timer)
      done()
    }
  })
}
async function startService(projectRoot: string, empty = false, port = 0) {
  const entry = app.isPackaged ? resolve(runtimeRoot, 'dist/service.mjs') : resolve(root, 'dist/service.mjs')
  const child = utilityProcess.fork(entry, [projectRoot, publicRoot, empty ? 'empty' : 'project', String(port)], { cwd: runtimeRoot, stdio: 'pipe', serviceName: 'ADV.JS Project Host' })
  child.stdout?.on('data', data => process.stdout.write(data))
  child.stderr?.on('data', data => process.stderr.write(data))
  const ready = await new Promise<{ url: string, root: string, token: string }>((done, fail) => {
    const timer = setTimeout(() => {
      child.kill()
      fail(new Error('项目服务启动超时'))
    }, 30000)
    child.once('exit', (code) => {
      clearTimeout(timer)
      fail(new Error(`项目服务退出 (${code})`))
    })
    child.on('message', (message) => {
      if (message.type === 'ready') {
        clearTimeout(timer)
        done(message)
      }
      if (message.type === 'error') {
        clearTimeout(timer)
        child.kill()
        fail(new Error(message.message))
      }
    })
  })
  return { child, ready }
}
async function openProject(path?: string) {
  if (opening)
    return false
  opening = true
  try {
    if (!await prepareToLeave())
      return false
    if (!path) {
      const selection = await dialog.showOpenDialog(window, { title: '打开 ADV.JS 项目', properties: ['openDirectory'] })
      if (selection.canceled)
        return false
      path = selection.filePaths[0]
    }
    if (!path)
      return false
    const fingerprint = await trustProject(path)
    if (fingerprint === undefined)
      return false
    const { child, ready } = await startService(path)
    await tasks.dispose()
    const old = service
    service = child
    trustedConfig = fingerprint
    session = { origin: new URL(ready.url).origin, token: ready.token, root: ready.root }
    dirty = false
    observeService(child)
    await window.loadURL(`${session.origin}/`)
    await stopService(old)
    const entry = recent.find(item => item.path === ready.root) ?? { id: randomUUID(), path: ready.root, name: ready.root.split('/').at(-1)! }
    recent = [entry, ...recent.filter(item => item.id !== entry.id)].slice(0, 12)
    await writeFile(recentFile(), JSON.stringify(recent, null, 2))
    updateMenu()
    return true
  }
  catch (error) {
    await dialog.showMessageBox(window, { type: 'error', message: '无法打开项目', detail: error instanceof Error ? error.message : String(error) })
    return false
  }
  finally {
    opening = false
  }
}
async function closeProject() {
  if (opening)
    return false
  opening = true
  try {
    if (!await prepareToLeave())
      return false
    const emptyRoot = resolve(app.getPath('userData'), 'empty-workspace')
    await mkdir(emptyRoot, { recursive: true })
    const { child, ready } = await startService(emptyRoot, true)
    await tasks.dispose()
    const old = service
    service = child
    session = { origin: new URL(ready.url).origin, token: ready.token }
    dirty = false
    await window.loadURL(`${session.origin}/`)
    await stopService(old)
    return true
  }
  finally {
    opening = false
  }
}
function observeService(child: UtilityProcess) {
  child.once('exit', () => {
    if (service === child && !leaving) {
      service = undefined
      void dialog.showMessageBox(window, { type: 'error', message: '项目服务已停止', detail: '点击“重新连接项目”恢复；当前窗口中的草稿会保留。' })
    }
  })
}
function updateMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'ADV.JS', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }] },
    { label: '文件', submenu: [
      { label: '打开项目…', accelerator: 'CmdOrCtrl+O', click: () => {
        void openProject()
      } },
      { label: '最近项目', submenu: recent.map(item => ({ label: item.name, click: () => {
        void openProject(item.path)
      } })) },
      { label: '保存', accelerator: 'CmdOrCtrl+S', click: () => {
        void command('save')
      } },
      { label: '关闭项目', click: () => {
        void closeProject()
      } },
    ] },
    { role: 'editMenu' },
    { label: '视图', submenu: [{ label: '重载窗口', accelerator: 'CmdOrCtrl+R', click: async () => {
      if (await prepareToLeave())
        window.reload()
    } }, { role: 'toggleDevTools' }, { role: 'togglefullscreen' }] },
    { role: 'windowMenu' },
  ]))
}
app.whenReady().then(async () => {
  await mkdir(app.getPath('userData'), { recursive: true })
  const savedRecent: unknown = await readFile(recentFile(), 'utf8').then(JSON.parse).catch(() => [])
  recent = Array.isArray(savedRecent) ? savedRecent.filter(item => item && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.path === 'string').slice(0, 12) : []
  const savedPreferences = await readFile(preferencesFile(), 'utf8').then(JSON.parse).catch(() => undefined)
  preferences = {
    ...(savedPreferences?.locale === 'en' || savedPreferences?.locale === 'zh-CN' ? { locale: savedPreferences.locale } : {}),
    onboarded: savedPreferences?.onboarded === true,
  }
  window = new BrowserWindow({ width: 1440, height: 900, minWidth: 800, minHeight: 600, title: 'ADV.JS Editor', webPreferences: { preload: resolve(root, 'dist/preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false } })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, url) => {
    if (!session || new URL(url).origin !== session.origin)
      event.preventDefault()
  })
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  for (const [name, handler] of Object.entries({
    'prepare-leave': prepareToLeave,
    'reconnect': async () => {
      if (opening)
        return false
      opening = true
      try {
        if (!session?.root)
          throw new Error('请先打开项目')
        const previous = session
        const fingerprint = await trustProject(previous.root!, true)
        if (fingerprint === undefined)
          return false
        await stopService(service)
        const { child, ready } = await startService(previous.root!, false, Number(new URL(previous.origin).port))
        service = child
        trustedConfig = fingerprint
        observeService(child)
        session = { origin: new URL(ready.url).origin, token: ready.token, root: ready.root }
        return command('reconnect')
      }
      finally {
        opening = false
      }
    },
    'task-status': () => tasks.status(),
    'task-cancel': () => tasks.cancel(),
    'preview-stop': () => tasks.closePreview(),
    'preview': async () => {
      if (!session?.root)
        throw new Error('请先打开项目')
      if (!await prepareToLeave())
        return
      if (await projectConfigFingerprint(session.root) !== trustedConfig)
        throw new Error('可执行配置已变更，请重新连接项目并确认信任')
      return tasks.start(session.root, 'preview')
    },
    'export': async (kind: unknown) => {
      if (kind !== 'directory' && kind !== 'zip')
        throw new Error('Invalid export kind')
      if (!session?.root)
        throw new Error('请先打开项目')
      if (!await prepareToLeave())
        return
      if (await projectConfigFingerprint(session.root) !== trustedConfig)
        throw new Error('可执行配置已变更，请重新连接项目并确认信任')
      const selection = await dialog.showSaveDialog(window, { title: kind === 'zip' ? '导出 Web 游戏 ZIP' : '导出 Web 游戏目录（使用新名称）', defaultPath: `${recent[0]?.name ?? 'game'}-web${kind === 'zip' ? '.zip' : ''}`, ...(kind === 'zip' ? { filters: [{ name: 'ZIP', extensions: ['zip'] }] } : {}) })
      if (selection.canceled || !selection.filePath)
        return
      return tasks.start(session.root, kind, selection.filePath)
    },
    'reveal': async () => {
      const output = tasks.status()?.output
      if (output && !output.startsWith('http:')) {
        const { shell } = await import('electron')
        shell.showItemInFolder(output)
      }
    },
    'open': () => openProject(),
    'close': () => closeProject(),
    'recent': () => recent.map(({ id, name }) => ({ id, name })),
    'open-recent': (id: unknown) => {
      if (typeof id !== 'string')
        throw new Error('Invalid recent project')
      const entry = recent.find(item => item.id === id)
      if (!entry)
        throw new Error('Unknown recent project')
      return openProject(entry.path)
    },
    'session': () => session,
    'preferences': () => preferences,
    'set-preferences': setPreferences,
    'dirty': (value: unknown) => {
      if (typeof value !== 'boolean')
        throw new Error('Invalid dirty state')
      dirty = value
    },
    'command-result': (id: unknown, success: unknown) => {
      if (typeof id !== 'string' || typeof success !== 'boolean')
        throw new Error('Invalid command result')
      commandRequests.get(id)?.(success)
    },
  })) {
    ipcMain.handle(`desktop:${name}`, (event, ...args) => {
      assertCaller(event)
      return (handler as (...args: unknown[]) => unknown)(...args)
    })
  }
  updateMenu()
  window.on('close', (event) => {
    if (leaving)
      return
    event.preventDefault()
    void prepareToLeave().then(async (allowed) => {
      if (!allowed)
        return
      leaving = true
      await tasks.dispose()
      await stopService(service)
      window.close()
      app.quit()
    })
  })
  app.on('before-quit', (event) => {
    if (!leaving && !quitting) {
      event.preventDefault()
      quitting = true
      window.close()
      quitting = false
    }
  })
  app.on('window-all-closed', () => app.quit())
  const launchProject = process.argv.find(arg => arg.startsWith('--project='))?.slice('--project='.length)
  if (launchProject) {
    if (!await openProject(launchProject))
      await closeProject()
  }
  else if (recent[0]) {
    if (!await openProject(recent[0].path))
      await closeProject()
  }
  else {
    await closeProject()
  }
}).catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`)
  app.exit(1)
})
