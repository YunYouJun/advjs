import { randomUUID } from 'node:crypto'
import { mkdir, readFile, realpath, rename, writeFile } from 'node:fs/promises'
import { basename, isAbsolute, resolve } from 'node:path'
import process from 'node:process'
import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, shell } from 'electron'
import { EditorWindow } from './editor-window.js'
import { redactErrorReport } from './error-report.js'
import { createNativeMenu } from './menu.js'
import { createProjectDirectory, findProjectTemplate, parseProjectCreationInput, suggestProjectFolder } from './project-creation.js'
import { projectConfigFingerprint } from './project-trust.js'
import { createWorkspaceStateStorage } from './workspace-state.js'

if (process.env.ADVJS_DESKTOP_TEST_DATA)
  app.setPath('userData', process.env.ADVJS_DESKTOP_TEST_DATA)
// Keep existing development preferences when overriding Electron's internal name.
const userData = app.getPath('userData')
app.setName(app.isPackaged ? 'ADV.JS Editor' : 'ADV.JS Editor Dev')
app.setPath('userData', userData)
const root = app.getAppPath()
let projectTemplates: Parameters<typeof findProjectTemplate>[0] = []
const iconName = app.isPackaged ? 'icon' : 'icon-dev'
const appIcon = resolve(app.isPackaged ? process.resourcesPath : resolve(root, 'assets/generated'), `${iconName}.${process.platform === 'win32' ? 'ico' : 'png'}`)
const runtimeRoot = app.isPackaged ? resolve(process.resourcesPath, 'runtime') : root
const publicRoot = app.isPackaged ? resolve(runtimeRoot, 'node_modules/@advjs/editor/dist') : resolve(root, '../../editor/core/dist')
const stateStorage = createWorkspaceStateStorage(resolve(app.getPath('userData'), 'workspace-state'))
const windows = new Map<number, EditorWindow>()
let active: EditorWindow | undefined
let quitting = false
let allowQuit = false
let operations = Promise.resolve()
interface RecentProject { id: string, name: string, path: string, lastOpenedAt?: number }
let recent: RecentProject[] = []
let recentWrite = Promise.resolve()
interface EditorPreferences { locale?: 'en' | 'zh-CN', onboarded: boolean, projectsDirectory?: string, previewVueDevtools?: boolean }
let preferences: EditorPreferences = { onboarded: false }
let preferenceWrite = Promise.resolve()
const recentFile = () => resolve(app.getPath('userData'), 'recent-projects.json')
const preferencesFile = () => resolve(app.getPath('userData'), 'editor-preferences.json')

// Serialize open/replace/close decisions, including directory pickers, so two
// simultaneous requests cannot create writable sessions for the same real path.
function enqueue<T>(run: () => Promise<T>): Promise<T> {
  const result = operations.then(run)
  operations = result.then(() => {}, () => {})
  return result
}
function current() {
  const id = BrowserWindow.getFocusedWindow()?.id ?? -1
  return windows.get(id) ?? [...windows.values()].find(context => context.tasks.presentation.ownsWindow(id)) ?? (active && !active.disposed ? active : [...windows.values()].find(window => !window.disposed))
}
function changed() {
  updateMenu()
  for (const context of windows.values()) {
    if (context.rendererReady && !context.disposed)
      context.window.webContents.send('desktop:event', { type: 'projects-changed' })
  }
}
function saveRecentProjects(update: (projects: RecentProject[]) => RecentProject[]) {
  const write = recentWrite.then(async () => {
    const projects = update(recent)
    const temporary = `${recentFile()}.tmp`
    await writeFile(temporary, JSON.stringify(projects, null, 2))
    await rename(temporary, recentFile())
    recent = projects
    changed()
  })
  recentWrite = write.catch(() => {})
  return write
}
function setPreferences(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid editor preferences')
  const patch = value as Record<string, unknown>
  if (Object.keys(patch).some(key => !['locale', 'onboarded', 'previewVueDevtools'].includes(key))
    || ('locale' in patch && patch.locale !== 'en' && patch.locale !== 'zh-CN')
    || ('onboarded' in patch && typeof patch.onboarded !== 'boolean')
    || ('previewVueDevtools' in patch && typeof patch.previewVueDevtools !== 'boolean')) {
    throw new Error('Invalid editor preferences')
  }
  const write = preferenceWrite.then(async () => {
    const next = { ...preferences, ...patch } as EditorPreferences
    const temporary = `${preferencesFile()}.tmp`
    await writeFile(temporary, JSON.stringify(next, null, 2))
    await rename(temporary, preferencesFile())
    preferences = next
    updateMenu()
  })
  preferenceWrite = write.catch(() => {})
  return write
}
function createWindow() {
  const context = new EditorWindow({ root, runtimeRoot, publicRoot, icon: appIcon, changed, close: (context) => {
    void enqueue(async () => {
      if (!context.disposed && await context.prepareToLeave())
        await context.dispose()
    }).catch(error => context.notify('无法关闭窗口', error))
  } })
  const id = context.window.id
  windows.set(id, context)
  active = context
  context.window.on('focus', () => {
    active = context
    updateMenu()
  })
  context.window.on('closed', () => {
    windows.delete(id)
    if (active === context)
      active = undefined
    changed()
  })
  changed()
  return context
}
async function newWindow() {
  const context = createWindow()
  try {
    await context.load()
    context.focus()
    return context
  }
  catch (error) {
    await context.dispose()
    throw error
  }
}
function openTarget(value: unknown): 'auto' | 'current' {
  if (value !== undefined && value !== 'auto' && value !== 'current')
    throw new Error('Invalid project open target')
  return value === 'current' ? 'current' : 'auto'
}
async function openProject(source: EditorWindow, path?: string, target: 'auto' | 'current' = 'auto') {
  let destination = source
  try {
    if (source.disposed)
      return false
    if (!path) {
      const selection = await dialog.showOpenDialog(source.window, { title: target === 'current' ? '在当前窗口打开 ADV.JS 项目' : '打开 ADV.JS 项目', properties: ['openDirectory'] })
      if (selection.canceled)
        return false
      path = selection.filePaths[0]
    }
    if (!path)
      return false
    const canonical = await realpath(path)
    const existing = [...windows.values()].find(context => !context.disposed && context.session?.root === canonical)
    if (existing) {
      existing.focus()
      return true
    }
    const fingerprint = await source.trust(canonical)
    if (fingerprint === undefined)
      return false
    if (target === 'current' || !source.session?.root) {
      if (!await source.prepareToLeave())
        return false
    }
    else {
      destination = createWindow()
    }
    const entry = { ...(recent.find(item => item.path === canonical) ?? { id: randomUUID(), name: basename(canonical), path: canonical }), lastOpenedAt: Date.now() }
    await destination.load(canonical, fingerprint)
    await saveRecentProjects(projects => [entry, ...projects.filter(item => item.path !== canonical)].slice(0, 12))
    destination.focus()
    return true
  }
  catch (error) {
    source.notify('无法打开项目', error)
    if (destination !== source)
      await destination.dispose()
    return false
  }
}
async function closeProject(context: EditorWindow) {
  if (!await context.prepareToLeave())
    return false
  await context.load()
  return true
}
function projectCreationDirectory(context: EditorWindow) {
  return context.projectCreationDirectory ?? preferences.projectsDirectory ?? resolve(app.getPath('documents'), 'advjs-projects')
}
async function selectProjectCreationDirectory(context: EditorWindow) {
  const selection = await dialog.showOpenDialog(context.window, {
    title: preferences.locale === 'zh-CN' ? '选择项目存储位置' : 'Choose project storage location',
    defaultPath: projectCreationDirectory(context),
    properties: ['openDirectory', 'createDirectory'],
  })
  if (selection.canceled || !selection.filePaths[0] || context.disposed)
    return undefined
  context.projectCreationDirectory = await realpath(selection.filePaths[0])
  return context.projectCreationDirectory
}
async function createProject(context: EditorWindow, id: unknown, value: unknown) {
  const template = findProjectTemplate(projectTemplates, id)
  const input = parseProjectCreationInput(value)
  if (context.disposed)
    return { created: false }
  try {
    // The parent is selected by the native host, never supplied by a renderer.
    const parent = projectCreationDirectory(context)
    await mkdir(parent, { recursive: true })
    const directory = await createProjectDirectory(template, resolve(parent, input.folderName), input.name)
    const write = preferenceWrite.then(async () => {
      const next = { ...preferences, projectsDirectory: parent }
      const temporary = `${preferencesFile()}.tmp`
      await writeFile(temporary, JSON.stringify(next, null, 2))
      await rename(temporary, preferencesFile())
      preferences = next
    })
    preferenceWrite = write.catch(() => {})
    await write
    return { created: await openProject(context, directory) }
  }
  catch (error) {
    context.notify('无法创建项目', error)
    return { created: false, error: error instanceof Error ? error.message : String(error) }
  }
}
function snapshot(context: EditorWindow) {
  return {
    opened: [...windows.values()].filter(item => item.session?.root && !item.disposed).map(item => ({ id: String(item.window.id), name: basename(item.session!.root!), path: item.session!.root!, current: item === context })),
    recent: recent.map(item => ({ ...item })),
  }
}
function updateMenu() {
  if (!app.isReady())
    return
  const context = current()
  const run = (action: (context: EditorWindow) => Promise<unknown>) => {
    if (context)
      void action(context).catch(error => context.notify('桌面操作失败', error))
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate(createNativeMenu({
    platform: process.platform,
    locale: preferences.locale,
    hasProject: !!context?.session?.root,
    recent,
    templates: projectTemplates.map(item => ({ id: item.meta.id, name: preferences.locale === 'zh-CN' ? item.meta.name : item.meta.nameEn ?? item.meta.name })),
    create: (id) => {
      findProjectTemplate(projectTemplates, id)
      context?.window.webContents.send('desktop:event', { type: 'create-project', templateId: id })
    },
    command: action => run(context => context.command(action)),
    newWindow: () => { void enqueue(newWindow).catch(error => context?.notify('无法新建窗口', error)) },
    open: () => { void enqueue(async () => openProject(context ?? await newWindow())) },
    openCurrent: () => { void enqueue(async () => openProject(context ?? await newWindow(), undefined, 'current')) },
    reconnect: () => run(context => enqueue(() => context.reconnect())),
    openRecent: (id) => {
      const entry = recent.find(item => item.id === id)
      if (entry)
        void enqueue(async () => openProject(context ?? await newWindow(), entry.path))
    },
    close: () => run(context => enqueue(() => closeProject(context))),
    reload: () => run(context => enqueue(async () => {
      if (await context.prepareToLeave())
        context.window.reload()
    })),
    openHelp: url => shell.openExternal(url),
  })))
}
async function quit() {
  if (quitting)
    return
  quitting = true
  try {
    // No window is destroyed until every dirty project has accepted the exit.
    for (const context of windows.values()) {
      if (!await context.prepareToLeave())
        return
    }
    for (const context of [...windows.values()]) await context.dispose()
    await Promise.all([recentWrite, preferenceWrite])
    allowQuit = true
    app.quit()
  }
  finally { quitting = false }
}
function registerIpc() {
  const handlers: Record<string, (context: EditorWindow, ...args: unknown[]) => unknown> = {
    'ready': context => context.ready(),
    'prepare-leave': context => context.prepareToLeave(),
    'reconnect': context => enqueue(() => context.reconnect()),
    'task-status': context => context.tasks.status(),
    'status': (context) => {
      const preview = context.tasks.previewStatus()
      return { connected: context.connected, dirty: context.dirty, hasProject: !!context.session?.root, task: context.tasks.status(), preview: { ...preview, vueDevtools: preview.active && preview.runMode === 'live' ? preview.vueDevtools : preferences.previewVueDevtools === true } }
    },
    'task-cancel': context => context.tasks.cancel(),
    'preview-stop': context => context.tasks.closePreview(),
    'preview-presentation': (context, mode) => context.tasks.presentation.setMode(mode),
    'preview-bounds': (context, bounds) => context.tasks.presentation.setBounds(bounds),
    'preview': async (context, runMode = 'build') => {
      if (runMode !== 'live' && runMode !== 'build')
        throw new Error('Invalid preview run mode')
      if (!context.session?.root)
        throw new Error('请先打开项目')
      if (!await context.prepareToLeave())
        return
      if (await projectConfigFingerprint(context.session.root) !== context.trustedConfig)
        throw new Error('可执行配置已变更，请重新连接项目并确认信任')
      return runMode === 'live' ? context.tasks.startLive(context.session.root, context.trustedConfig, preferences.previewVueDevtools === true) : context.tasks.start(context.session.root, 'preview')
    },
    'export': async (context, kind) => {
      if (kind !== 'directory' && kind !== 'zip')
        throw new Error('Invalid export kind')
      if (!context.session?.root)
        throw new Error('请先打开项目')
      if (!await context.prepareToLeave())
        return
      if (await projectConfigFingerprint(context.session.root) !== context.trustedConfig)
        throw new Error('可执行配置已变更，请重新连接项目并确认信任')
      const selection = await dialog.showSaveDialog(context.window, { title: kind === 'zip' ? '导出 Web 游戏 ZIP' : '导出 Web 游戏目录（使用新名称）', defaultPath: `${basename(context.session.root)}-web${kind === 'zip' ? '.zip' : ''}`, ...(kind === 'zip' ? { filters: [{ name: 'ZIP', extensions: ['zip'] }] } : {}) })
      if (selection.canceled || !selection.filePath)
        return
      return context.tasks.start(context.session.root, kind, selection.filePath)
    },
    'reveal': (context) => {
      const output = context.tasks.status()?.output
      if (output && !output.startsWith('http:'))
        shell.showItemInFolder(output)
    },
    'open': (context, target) => {
      const mode = openTarget(target)
      return enqueue(() => openProject(context, undefined, mode))
    },
    'new-window': () => enqueue(async () => {
      await newWindow()
      return true
    }),
    'creation-defaults': async (context, id) => {
      findProjectTemplate(projectTemplates, id)
      const directory = preferences.projectsDirectory ?? resolve(app.getPath('documents'), 'advjs-projects')
      context.projectCreationDirectory = directory
      return { directory, folderName: await suggestProjectFolder(directory, id as string) }
    },
    'creation-directory': context => enqueue(() => selectProjectCreationDirectory(context)),
    'create': (context, id, options) => {
      findProjectTemplate(projectTemplates, id)
      parseProjectCreationInput(options)
      return enqueue(() => createProject(context, id, options))
    },
    'documentation': () => shell.openExternal('https://docs.advjs.org/guide/editor/desktop'),
    'close': context => enqueue(() => closeProject(context)),
    'recent': () => recent.map(item => ({ ...item })),
    'projects': context => snapshot(context),
    'focus-project': (_context, id) => {
      if (typeof id !== 'string')
        throw new Error('Invalid project window')
      const target = windows.get(Number(id))
      if (!target?.session?.root || target.disposed)
        throw new Error('Project window is closed')
      target.focus()
      return true
    },
    'open-recent': (context, id, target) => {
      const mode = openTarget(target)
      if (typeof id !== 'string')
        throw new Error('Invalid recent project')
      const entry = recent.find(item => item.id === id)
      if (!entry)
        throw new Error('Unknown recent project')
      return enqueue(() => openProject(context, entry.path, mode))
    },
    'remove-recent': (_context, id) => {
      if (typeof id !== 'string' || !recent.some(item => item.id === id))
        throw new Error('Unknown recent project')
      return saveRecentProjects(projects => projects.filter(item => item.id !== id))
    },
    'session': context => context.session,
    'workspace-state': context => context.session?.root ? stateStorage.read(context.session.root) : { version: 1 },
    'save-workspace-state': (context, state) => {
      if (context.session?.root)
        return stateStorage.write(context.session.root, state)
    },
    'copy-error-report': (context, report) => {
      if (typeof report !== 'string' || report.length > 1_000_000)
        throw new Error('Invalid error report')
      clipboard.writeText(redactErrorReport(report, [context.session?.token ?? '']))
    },
    'preferences': () => preferences,
    'set-preferences': (_context, patch) => setPreferences(patch),
    'dirty': (context, value) => {
      if (typeof value !== 'boolean')
        throw new Error('Invalid dirty state')
      context.dirty = value
      context.updateTitle()
    },
    'command-result': (context, id, success) => {
      if (typeof id !== 'string' || typeof success !== 'boolean')
        throw new Error('Invalid command result')
      context.commandResult(id, success)
    },
  }
  for (const [name, handler] of Object.entries(handlers)) {
    ipcMain.handle(`desktop:${name}`, (event, ...args) => {
      const context = [...windows.values()].find(context => context.window.webContents === event.sender)
      if (!context)
        throw new Error('Unauthorized desktop caller')
      context.assertCaller(event)
      return handler(context, ...args)
    })
  }
}
const launchPath = (args: string[]) => args.find(arg => arg.startsWith('--project='))?.slice('--project='.length)
if (!app.requestSingleInstanceLock()) {
  app.quit()
}
else {
  app.on('second-instance', (_event, args) => {
    void app.whenReady().then(() => enqueue(async () => {
      const context = current() ?? await newWindow()
      const path = launchPath(args)
      if (path)
        await openProject(context, path)
      else
        context.focus()
    }))
  })
  app.on('before-quit', (event) => {
    if (!allowQuit) {
      event.preventDefault()
      void enqueue(quit)
    }
  })
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && !quitting)
      app.quit()
  })
  app.on('activate', () => {
    if (!windows.size)
      void enqueue(newWindow)
  })
  app.whenReady().then(async () => {
    projectTemplates = JSON.parse(await readFile(resolve(root, 'dist/project-templates.json'), 'utf8'))
    if (!app.isPackaged)
      app.dock?.setIcon(appIcon)
    await mkdir(app.getPath('userData'), { recursive: true })
    const savedRecent: unknown = await readFile(recentFile(), 'utf8').then(JSON.parse).catch(() => [])
    recent = Array.isArray(savedRecent) ? savedRecent.filter(item => item && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.path === 'string').slice(0, 12) : []
    const savedPreferences = await readFile(preferencesFile(), 'utf8').then(JSON.parse).catch(() => undefined)
    preferences = { ...(savedPreferences?.locale === 'en' || savedPreferences?.locale === 'zh-CN' ? { locale: savedPreferences.locale } : {}), onboarded: savedPreferences?.onboarded === true, ...(typeof savedPreferences?.projectsDirectory === 'string' && isAbsolute(savedPreferences.projectsDirectory) ? { projectsDirectory: savedPreferences.projectsDirectory } : {}), ...(typeof savedPreferences?.previewVueDevtools === 'boolean' ? { previewVueDevtools: savedPreferences.previewVueDevtools } : {}) }
    registerIpc()
    await enqueue(async () => {
      const context = createWindow()
      const path = launchPath(process.argv) ?? recent[0]?.path
      if (!path || !await openProject(context, path))
        await context.load()
    })
  }).catch((error) => {
    process.stderr.write(`${error.stack ?? error}\n`)
    app.exit(1)
  })
}
