import type { FSWatcher } from 'node:fs'
import { watch } from 'node:fs'
import process from 'node:process'
import { createProjectPreviewServer } from 'advjs'
import { createProjectMirror, ignoredProjectPath } from './project-copy.js'
import { projectConfigFingerprint } from './project-trust.js'

const root = process.argv[2]!
const fingerprint = process.argv[3]!
const vueDevtools = process.argv[4] === 'true'
const mirror = createProjectMirror(root, process.cwd())
let preview: Awaited<ReturnType<typeof createProjectPreviewServer>> | undefined
let watcher: FSWatcher | undefined
let timer: ReturnType<typeof setTimeout> | undefined
let pending = Promise.resolve()
let stopped = false
const send = (message: object) => process.parentPort!.postMessage(message)

async function sync() {
  if (await projectConfigFingerprint(root) !== fingerprint)
    throw new Error('可执行配置已变更，请重新连接项目并确认信任')
  await mirror.sync()
  if (await projectConfigFingerprint(process.cwd()) !== fingerprint)
    throw new Error('可执行配置已变更，请重新连接项目并确认信任')
}
async function stop() {
  stopped = true
  clearTimeout(timer)
  watcher?.close()
  await pending
  await preview?.server.close()
}
async function run() {
  try {
    await sync()
    preview = await createProjectPreviewServer({ userRoot: process.cwd() }, {
      cacheDir: '../vite-cache',
      define: { 'import.meta.env.ADVJS_OFFLINE': true, 'import.meta.env.ADVJS_EDITOR_PREVIEW': true },
      server: { host: '127.0.0.1', port: 0, open: false, cors: false, watch: null },
    }, { vueDevtools })
    await preview.server.listen()
    const address = preview.server.httpServer!.address() as { port: number }
    watcher = watch(root, { recursive: true }, (_event, path) => {
      if (ignoredProjectPath(path?.toString() ?? ''))
        return
      clearTimeout(timer)
      timer = setTimeout(() => {
        pending = pending.then(async () => {
          if (stopped)
            return
          send({ type: 'updating' })
          try {
            await sync()
            const restarted = await preview!.refresh()
            send({ type: 'updated', restarted })
          }
          catch (error) {
            send({ type: 'update-error', message: error instanceof Error ? error.message : String(error) })
            // Keep the last valid player for content errors, but stop serving a
            // changed executable configuration until native trust is renewed.
            if (await projectConfigFingerprint(root) !== fingerprint) {
              stopped = true
              watcher?.close()
              await preview?.server.close()
              send({ type: 'blocked' })
            }
          }
        }).catch(error => send({ type: 'update-error', message: String(error) }))
      }, 250)
    })
    watcher.on('error', error => send({ type: 'update-error', message: error.message }))
    // Catch saves made while Vite initialized, before its original-file watcher.
    await sync()
    await preview.refresh()
    send({ type: 'ready', origin: `http://127.0.0.1:${address.port}` })
  }
  catch (error) {
    send({ type: 'error', message: error instanceof Error ? error.message : String(error) })
    await stop()
    process.exit(1)
  }
}
process.parentPort!.on('message', async ({ data }) => {
  if (data === 'stop') {
    await stop()
    process.exit(0)
  }
})
void run()
