import type { BrowserWindow, UtilityProcess } from 'electron'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { cp, lstat, mkdir, mkdtemp, readdir, readFile, realpath, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { deflateRawSync } from 'node:zlib'
import { app, utilityProcess, WebContentsView, BrowserWindow as Window } from 'electron'
import { createPreviewPresentation } from './preview-presentation.js'

export interface DesktopTask { id: string, kind: string, state: 'running' | 'succeeded' | 'failed' | 'cancelled', logs: string, output?: string, error?: string }
function contains(root: string, path: string) {
  const part = relative(root, path)
  return !isAbsolute(part) && part !== '..' && !part.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)
}
const ignored = new Set(['.git', 'node_modules', '.nuxt', '.output', '.build', '.advjs', 'dist', 'coverage', '.env'])

async function copyProject(root: string, destination: string) {
  const canonical = await realpath(root)
  await cp(canonical, destination, { recursive: true, dereference: true, filter: async (path) => {
    if (path !== canonical && ignored.has(path.split(/[\\/]/u).at(-1)!))
      return false
    const target = await realpath(path)
    if (!contains(canonical, target))
      throw new Error(`项目符号链接越界：${relative(canonical, path)}`)
    return true
  } })
}
async function files(directory: string, prefix = ''): Promise<{ path: string, bytes: Buffer }[]> {
  const output: { path: string, bytes: Buffer }[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    const name = `${prefix}${entry.name}`
    if (entry.isDirectory())
      output.push(...await files(path, `${name}/`))
    else if (entry.isFile())
      output.push({ path: name, bytes: await readFile(path) })
  }
  return output
}
function crc32(bytes: Buffer) {
  let crc = 0xFFFFFFFF
  for (const byte of bytes) {
    crc ^= byte
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}
/** Standard UTF-8 ZIP, including binary media. No source or host configuration. */
async function zip(directory: string) {
  const local: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  const entries = await files(directory)
  if (entries.length > 65535)
    throw new Error('ZIP requires fewer than 65536 files')
  for (const entry of entries) {
    const name = Buffer.from(entry.path)
    const bytes = deflateRawSync(entry.bytes)
    const crc = crc32(entry.bytes)
    const header = Buffer.alloc(30)
    header.writeUInt32LE(0x04034B50)
    header.writeUInt16LE(20, 4)
    header.writeUInt16LE(0x800, 6)
    header.writeUInt16LE(8, 8)
    header.writeUInt32LE(crc, 14)
    header.writeUInt32LE(bytes.length, 18)
    header.writeUInt32LE(entry.bytes.length, 22)
    header.writeUInt16LE(name.length, 26)
    local.push(header, name, bytes)
    const record = Buffer.alloc(46)
    record.writeUInt32LE(0x02014B50)
    record.writeUInt16LE(20, 4)
    record.writeUInt16LE(20, 6)
    record.writeUInt16LE(0x800, 8)
    record.writeUInt16LE(8, 10)
    record.writeUInt32LE(crc, 16)
    record.writeUInt32LE(bytes.length, 20)
    record.writeUInt32LE(entry.bytes.length, 24)
    record.writeUInt16LE(name.length, 28)
    record.writeUInt32LE(offset, 42)
    central.push(record, name)
    offset += header.length + name.length + bytes.length
  }
  const records = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054B50)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(records.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...local, records, end])
}

export function createDesktopTasks(runtime: string, worker: string, owner: BrowserWindow, onPreviewFocus: () => void) {
  const presentation = createPreviewPresentation(owner, onPreviewFocus)
  let current: DesktopTask | undefined
  let child: UtilityProcess | undefined
  let preview: BrowserWindow | undefined
  let stopPreview: (() => Promise<void>) | undefined
  let previewCleanup: Promise<void> | undefined
  let cancelled = false
  let active: Promise<void> | undefined
  let runMode: 'live' | 'build' = 'live'
  let vueDevtools = false
  let updating = false
  let previewError: string | undefined
  const directories = new Set<string>()
  async function closePreview() {
    presentation.release()
    preview?.destroy()
    preview = undefined
    await previewCleanup
    previewCleanup = undefined
    await stopPreview?.()
    stopPreview = undefined
    updating = false
    previewError = undefined
  }

  async function openPlayer(origin: string, task: DesktopTask, staging: string) {
    preview = new Window({ show: false, width: 1100, height: 720, title: 'ADV.JS 游戏预览', webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true, partition: `preview-${task.id}` } })
    const player = new WebContentsView({ webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true, partition: `preview-${task.id}` } })
    player.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    player.webContents.on('will-navigate', (event, url) => {
      if (new URL(url).origin !== origin)
        event.preventDefault()
    })
    player.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
    player.webContents.on('page-title-updated', (_event, title) => preview?.setTitle(title || 'ADV.JS 游戏预览'))
    preview.once('closed', () => {
      presentation.release()
      preview = undefined
      const stop = stopPreview
      stopPreview = undefined
      previewCleanup = (async () => {
        await stop?.()
        await rm(staging, { recursive: true, force: true })
        directories.delete(staging)
      })()
      void previewCleanup.catch(error => task.logs += `\nPreview cleanup failed: ${String(error)}`)
    })
    presentation.attach(preview, player)
    await player.webContents.loadURL(origin)
    task.output = origin
  }

  async function startLive(root: string, fingerprint: string, enableVueDevtools = false) {
    if (current?.state === 'running')
      throw new Error('任务正在运行')
    const task: DesktopTask = { id: randomUUID(), kind: 'live', state: 'running', logs: '' }
    current = task
    cancelled = false
    active = (async () => {
      let staging = ''
      let liveProcess: UtilityProcess | undefined
      let closing = false
      let exited = false
      try {
        await closePreview()
        runMode = 'live'
        vueDevtools = enableVueDevtools
        staging = await mkdtemp(join(app.getPath('userData'), 'build-'))
        directories.add(staging)
        const copy = join(staging, 'project')
        // The worker creates the mirror. Only the bundled dependencies are linked.
        await mkdir(copy, { recursive: true })
        await symlink(resolve(runtime, 'node_modules'), join(copy, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
        if (cancelled)
          throw new Error('已取消')
        liveProcess = utilityProcess.fork(join(dirname(worker), 'live-worker.mjs'), [root, fingerprint, String(enableVueDevtools)], { cwd: copy, stdio: 'pipe', serviceName: 'ADV.JS Live Preview' })
        child = liveProcess
        const append = (data: Buffer) => {
          task.logs = (task.logs + String(data)).slice(-100000)
        }
        liveProcess.stdout?.on('data', append)
        liveProcess.stderr?.on('data', append)
        const origin = await new Promise<string>((done, fail) => {
          const timer = setTimeout(() => fail(new Error('实时预览启动超时')), 120000)
          liveProcess!.once('exit', (code) => {
            exited = true
            clearTimeout(timer)
            fail(new Error(`实时预览进程退出 (${code})`))
            if (!closing && task.state === 'succeeded') {
              previewError = `实时预览进程退出 (${code})，请重新运行`
              task.state = 'failed'
              task.error = previewError
            }
          })
          liveProcess!.on('message', (message) => {
            if (message.type === 'ready') {
              clearTimeout(timer)
              done(message.origin)
            }
            else if (message.type === 'error') {
              clearTimeout(timer)
              fail(new Error(message.message))
            }
            else if (message.type === 'updating') {
              updating = true
            }
            else if (message.type === 'updated') {
              updating = false
              previewError = undefined
              task.error = undefined
              task.state = 'succeeded'
              // A Vite restart can interrupt the player's reconnect request.
              // Reload only the origin already assigned to this managed task.
              if (message.restarted && task.output && current?.id === task.id) {
                void presentation.reload(task.output).catch((error) => {
                  previewError = String(error)
                  task.logs += `\nPreview reload failed: ${previewError}`
                })
              }
            }
            else if (message.type === 'update-error') {
              updating = false
              previewError = message.message
              task.error = message.message
              task.state = 'failed'
            }
            else if (message.type === 'blocked') {
              presentation.release()
            }
          })
        })
        if (cancelled)
          throw new Error('已取消')
        child = undefined
        stopPreview = async () => {
          closing = true
          if (exited)
            return
          await new Promise<void>((done) => {
            const timer = setTimeout(() => {
              liveProcess?.kill()
              done()
            }, 2000)
            liveProcess!.once('exit', () => {
              clearTimeout(timer)
              done()
            })
            liveProcess!.postMessage('stop')
          })
        }
        await openPlayer(origin, task, staging)
        task.state = 'succeeded'
      }
      catch (error) {
        closing = true
        liveProcess?.kill()
        child = undefined
        await closePreview()
        task.state = cancelled ? 'cancelled' : 'failed'
        task.error = String(error)
        if (staging) {
          await rm(staging, { recursive: true, force: true })
          directories.delete(staging)
        }
      }
    })()
    return task
  }
  async function cancel() {
    if (current?.state === 'running') {
      cancelled = true
      child?.kill()
      await active
    }
  }
  async function dispose() {
    await cancel()
    await closePreview()
    for (const path of directories) await rm(path, { recursive: true, force: true })
    directories.clear()
    presentation.dispose()
  }
  async function start(root: string, kind: 'preview' | 'directory' | 'zip', destination?: string) {
    if (current?.state === 'running')
      throw new Error('构建任务正在运行')
    if (destination) {
      const parent = await realpath(dirname(destination))
      destination = resolve(parent, destination.split(/[\\/]/u).at(-1)!)
      for (const boundary of [await realpath(root), await realpath(runtime), await realpath(app.getPath('userData'))]) {
        if (contains(boundary, destination) || contains(destination, boundary))
          throw new Error('导出目标不能覆盖项目、应用或工作目录')
      }
      if (await lstat(destination).then(() => true).catch(error => error.code === 'ENOENT' ? false : Promise.reject(error)))
        throw new Error('导出目标已存在，请选择新名称')
    }
    const task: DesktopTask = { id: randomUUID(), kind, state: 'running', logs: '' }
    current = task
    cancelled = false
    active = (async () => {
      let staging = ''
      try {
        staging = await mkdtemp(join(app.getPath('userData'), 'build-'))
        directories.add(staging)
        const copy = join(staging, 'project')
        const output = join(staging, 'web')
        await copyProject(root, copy)
        if (cancelled)
          throw new Error('已取消')
        await symlink(resolve(runtime, 'node_modules'), join(copy, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
        await new Promise<void>((done, fail) => {
          child = utilityProcess.fork(worker, [output], { cwd: copy, stdio: 'pipe', serviceName: 'ADV.JS Web Build' })
          const append = (data: Buffer) => {
            task.logs = (task.logs + String(data)).slice(-100000)
          }
          child.stdout?.on('data', append)
          child.stderr?.on('data', append)
          const timer = setTimeout(() => {
            child?.kill()
            fail(new Error('构建超时（5 分钟）'))
          }, 300000)
          child.once('exit', (code) => {
            clearTimeout(timer)
            fail(new Error(`构建进程退出 (${code})`))
          })
          child.on('message', (message) => {
            clearTimeout(timer)
            if (message.type === 'result')
              done()
            else if (message.type === 'error')
              fail(new Error(message.message))
          })
        })
        child?.kill()
        child = undefined
        if (cancelled)
          throw new Error('已取消')
        if (kind === 'preview') {
          await closePreview()
          runMode = 'build'
          const server = createServer(async (request, response) => {
            try {
              const url = new URL(request.url ?? '/', 'http://localhost')
              if (url.pathname.startsWith('/__advjs/')) {
                response.writeHead(404).end()
                return
              }
              const name = decodeURIComponent(url.pathname).replace(/^\//u, '')
              const target = resolve(output, name || 'index.html')
              if (!contains(output, target)) {
                response.writeHead(403).end()
                return
              }
              const content = await readFile(target).catch(async () => {
                if (extname(target))
                  throw new Error('Missing resource')
                return await readFile(join(output, 'index.html'))
              })
              const mime = ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' } as Record<string, string>)[extname(target)] ?? 'application/octet-stream'
              response.writeHead(200, { 'content-type': mime, 'cache-control': 'no-store', 'content-security-policy': 'default-src \'self\' data: blob:; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob: https:; media-src \'self\' data: blob: https:; connect-src \'self\' data: blob: https:; frame-src \'none\'; object-src \'none\'' })
              response.end(content)
            }
            catch {
              response.writeHead(404).end()
            }
          })
          await new Promise<void>(done => server.listen(0, '127.0.0.1', done))
          stopPreview = () => new Promise<void>((done) => {
            server.closeAllConnections()
            server.close(() => done())
          })
          const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`
          await openPlayer(origin, task, staging)
        }
        else {
          const target = destination!
          const temporary = `${target}.advjs-${task.id}`
          try {
            if (kind === 'zip')
              await writeFile(temporary, await zip(output), { flag: 'wx' })
            else await cp(output, temporary, { recursive: true, errorOnExist: true, force: false })
            if (await lstat(target).then(() => true).catch(() => false))
              throw new Error('导出目标在构建过程中被创建，请选择新名称')
            await rename(temporary, target)
            task.output = target
          }
          finally {
            await rm(temporary, { recursive: true, force: true })
          }
        }
        task.state = 'succeeded'
      }
      catch (error) {
        if (kind === 'preview')
          await closePreview()
        task.state = cancelled ? 'cancelled' : 'failed'
        task.error = String(error)
      }
      finally {
        child?.kill()
        child = undefined
        if (staging && (kind !== 'preview' || task.state !== 'succeeded')) {
          await rm(staging, { recursive: true, force: true })
          directories.delete(staging)
        }
      }
    })()
    return task
  }
  return { start, startLive, cancel, dispose, closePreview, presentation, previewStatus: () => ({ ...presentation.status(), runMode, vueDevtools, updating, error: previewError }), status: () => current }
}
