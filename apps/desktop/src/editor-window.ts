import type { IpcMainInvokeEvent, UtilityProcess } from 'electron'
import type { DesktopCommand } from './commands.js'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import process from 'node:process'
import { app, BrowserWindow, dialog, utilityProcess } from 'electron'
import { formatEditorErrorReport } from './error-report.js'
import { projectConfigFingerprint } from './project-trust.js'
import { createDesktopTasks } from './tasks.js'

export interface DesktopNotice { id: string, title: string, message: string, report: string }
interface WindowOptions {
  root: string
  runtimeRoot: string
  publicRoot: string
  icon: string
  changed: () => void
  close: (context: EditorWindow) => void
}
export class EditorWindow {
  readonly window: BrowserWindow
  readonly tasks: ReturnType<typeof createDesktopTasks>
  session?: { origin: string, token: string, root?: string }
  private service?: UtilityProcess
  dirty = false
  disposed = false
  rendererReady = false
  projectCreationDirectory?: string
  trustedConfig = ''
  private notices: DesktopNotice[] = []
  private requests = new Map<string, (success: boolean) => void>()

  constructor(private options: WindowOptions) {
    this.window = new BrowserWindow({ width: 1440, height: 900, minWidth: 800, minHeight: 600, title: 'ADV.JS Editor', icon: options.icon, webPreferences: { preload: resolve(options.root, 'dist/preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false } })
    this.tasks = createDesktopTasks(options.runtimeRoot, resolve(app.isPackaged ? options.runtimeRoot : options.root, 'dist/build-worker.mjs'), this.window, options.changed)
    this.window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    this.window.webContents.on('will-navigate', (event, url) => {
      if (!this.session || new URL(url).origin !== this.session.origin)
        event.preventDefault()
    })
    this.window.on('page-title-updated', event => event.preventDefault())
    this.window.webContents.on('did-start-navigation', (event) => {
      if (event.isMainFrame && !event.isSameDocument) {
        this.rendererReady = false
        this.tasks.presentation.setBounds(undefined)
      }
    })
    this.window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
    this.window.on('close', (event) => {
      if (!this.disposed) {
        event.preventDefault()
        options.close(this)
      }
    })
  }

  assertCaller(event: IpcMainInvokeEvent) {
    if (event.sender !== this.window.webContents || event.senderFrame !== this.window.webContents.mainFrame
      || !this.session || new URL(event.senderFrame.url).origin !== this.session.origin || this.disposed) {
      throw new Error('Unauthorized desktop caller')
    }
  }

  focus() {
    if (this.window.isMinimized())
      this.window.restore()
    this.window.show()
    this.window.focus()
  }

  updateTitle() {
    const title = this.session?.root ? `${basename(this.session.root)} — ADV.JS Editor` : 'ADV.JS Editor'
    this.window.setTitle(`${this.dirty ? '● ' : ''}${title}`)
    this.window.setDocumentEdited(this.dirty)
    if (process.platform === 'darwin')
      this.window.setRepresentedFilename(this.session?.root ?? '')
  }

  command(action: DesktopCommand) {
    if (!this.rendererReady || this.disposed)
      return Promise.resolve(false)
    return new Promise<boolean>((done) => {
      const id = randomUUID()
      const timer = setTimeout(() => {
        this.requests.delete(id)
        done(false)
      }, 30_000)
      this.requests.set(id, (success) => {
        clearTimeout(timer)
        this.requests.delete(id)
        done(success)
      })
      this.window.webContents.send('desktop:command', id, action)
    })
  }

  commandResult(id: string, success: boolean) { this.requests.get(id)?.(success) }
  ready() {
    this.rendererReady = true
    this.updateTitle()
    return this.notices.splice(0)
  }

  notify(title: string, error: unknown) {
    const notice = { id: randomUUID(), title, message: error instanceof Error ? error.message : String(error), report: formatEditorErrorReport({ source: title, error, project: this.session?.root, version: app.getVersion(), environment: `Electron ${process.versions.electron} / ${process.platform} ${process.arch}` }, [this.session?.token ?? '']) }
    if (this.rendererReady && !this.disposed)
      this.window.webContents.send('desktop:event', { type: 'error', notice })
    else
      this.notices.push(notice)
  }

  async prepareToLeave() {
    if (this.dirty) {
      this.focus()
      const result = await dialog.showMessageBox(this.window, { type: 'question', message: '项目有未保存内容', buttons: ['保存并继续', '取消'], defaultId: 0, cancelId: 1 })
      if (result.response !== 0 || !await this.command('save'))
        return false
    }
    // Capture the renderer's final layout and editor position before navigation.
    return !this.session?.root || !this.rendererReady || await this.command('capture-state')
  }

  async trust(path: string, reopening = false) {
    const fingerprint = await projectConfigFingerprint(path)
    if (fingerprint && (!reopening || fingerprint !== this.trustedConfig)) {
      const result = await dialog.showMessageBox(this.window, { type: 'warning', message: '此项目包含可执行配置', detail: '只打开你信任的项目。配置会在项目服务中运行，并可访问本机文件。', buttons: ['信任并打开', '取消'], cancelId: 1 })
      if (result.response !== 0)
        return undefined
    }
    return fingerprint
  }

  private async stopService(child = this.service) {
    if (!child)
      return
    if (child === this.service)
      this.service = undefined
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

  private async startService(projectRoot: string, empty = false, port = 0) {
    const child = utilityProcess.fork(resolve(app.isPackaged ? this.options.runtimeRoot : this.options.root, 'dist/service.mjs'), [projectRoot, this.options.publicRoot, empty ? 'empty' : 'project', String(port)], { cwd: this.options.runtimeRoot, stdio: 'pipe', serviceName: 'ADV.JS Project Host' })
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
    child.once('exit', () => {
      if (child === this.service && !this.disposed) {
        this.service = undefined
        this.notify('项目服务已停止', '选择「文件 → 重新连接项目」恢复；当前窗口中的草稿会保留。')
        this.options.changed()
      }
    })
    return { child, ready }
  }

  async load(path?: string, fingerprint = '') {
    const directory = path ?? resolve(app.getPath('userData'), 'empty-workspace')
    if (!path)
      await mkdir(directory, { recursive: true })
    const { child, ready } = await this.startService(directory, !path)
    await this.tasks.dispose()
    const old = this.service
    this.service = child
    this.session = { origin: new URL(ready.url).origin, token: ready.token, ...(path ? { root: ready.root } : {}) }
    this.trustedConfig = fingerprint
    this.dirty = false
    this.rendererReady = false
    this.updateTitle()
    this.options.changed()
    try {
      await this.window.loadURL(`${this.session.origin}/`)
    }
    finally {
      if (old)
        await this.stopService(old)
    }
  }

  async reconnect() {
    if (!this.session?.root)
      throw new Error('请先打开项目')
    const previous = this.session
    const fingerprint = await this.trust(previous.root!, true)
    if (fingerprint === undefined)
      return false
    await this.stopService()
    const { child, ready } = await this.startService(previous.root!, false, Number(new URL(previous.origin).port))
    this.service = child
    this.trustedConfig = fingerprint
    this.session = { origin: new URL(ready.url).origin, token: ready.token, root: ready.root }
    this.options.changed()
    return this.command('reconnect')
  }

  get connected() { return !!this.service }

  async dispose() {
    this.disposed = true
    for (const complete of this.requests.values()) complete(false)
    await this.tasks.dispose()
    await this.stopService()
    if (!this.window.isDestroyed())
      this.window.destroy()
  }
}
