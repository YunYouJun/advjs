import process from 'node:process'
import { createEditorBridge, loadProject } from 'advjs'
import { projectConfigFingerprint } from './project-trust.js'

const root = process.argv[2]!
const publicRoot = process.argv[3]!
let bridge: Awaited<ReturnType<typeof createEditorBridge>>
async function run() {
  try {
    const fingerprint = await projectConfigFingerprint(root)
    if (process.argv[4] !== 'empty') {
      const project = await loadProject({ root })
      if (project.config.format === 'synthetic')
        throw new Error('请选择包含 adv.config.json 或 adv.config.ts 的 ADV.JS 项目')
    }
    bridge = await createEditorBridge({ projectRoot: root, publicRoot, port: Number(process.argv[5] ?? 0), validateProjectAccess: async () => {
      if (await projectConfigFingerprint(root) !== fingerprint)
        throw new Error('可执行配置已变更，请点击“重新连接项目”重新确认信任。')
    } })
    const ready = await bridge.start()
    process.parentPort!.postMessage({ type: 'ready', ...ready, token: bridge.token, versions: process.versions })
  }
  catch (error) {
    process.parentPort!.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}
void run()
process.parentPort!.on('message', async ({ data }) => {
  if (data === 'stop') {
    await bridge?.stop()
    process.exit(0)
  }
})
