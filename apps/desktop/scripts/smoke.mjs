import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'
import { _electron as electron } from '@playwright/test'

const root = resolve(import.meta.dirname, '..')
const artifact = process.argv[2]
const folder = await mkdtemp(resolve(tmpdir(), 'advjs-desktop-'))
const fixture = resolve(folder, '中文 项目')
await cp(resolve(root, '../../tests/launch/fixtures/golden-project'), fixture, { recursive: true })
const media = resolve(fixture, 'adv/assets')
await mkdir(media, { recursive: true })
await writeFile(resolve(media, 'room.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#35465c"/><text x="80" y="100" fill="white" font-size="36">Rainy letter</text></svg>')
const manifest = JSON.parse(await readFile(resolve(fixture, 'adv/assets.json'), 'utf8'))
manifest.assets = [{ id: 'room', kind: 'background', type: 'image', path: 'room.svg' }]
await writeFile(resolve(fixture, 'adv/assets.json'), JSON.stringify(manifest))
const scene = resolve(fixture, 'adv/scenes/room.md')
await writeFile(scene, (await readFile(scene, 'utf8')).replace('id: room', 'id: room\nassetId: room'))
const app = await electron.launch({
  ...(artifact ? { executablePath: artifact } : { args: [root] }),
  args: artifact ? [`--project=${fixture}`] : [root, `--project=${fixture}`],
  env: { ...process.env, PATH: '/usr/bin:/bin', ADVJS_DESKTOP_TEST_DATA: resolve(folder, 'userData') },
  timeout: 60000,
})
try {
  const page = await app.firstWindow()
  page.on('requestfailed', request => process.stderr.write(`FAIL ${request.url()}: ${request.failure()?.errorText}\n`))
  page.on('pageerror', error => process.stderr.write(`PAGE ${error.stack}\n`))
  page.on('console', (message) => {
    if (message.type() === 'error')
      process.stderr.write(`${message.text()}\n`)
  })
  await page.waitForFunction(() => location.protocol === 'http:' && window.advDesktop, { timeout: 30000 })
  await page.waitForFunction(async () => (await window.advDesktop.session()).root?.includes('中文 项目'))
  await page.waitForTimeout(3000)
  process.stdout.write(`${JSON.stringify(await page.evaluate(async () => {
    const host = window.advDesktop
    const session = await host.session()
    const loaded = await fetch(`${session.origin}/__advjs/api/project`, { headers: { authorization: `Bearer ${session.token}` } })
    const stores = document.querySelector('#__nuxt').__vue_app__?.config.globalProperties.$pinia?.state.value['@advjs/editor/console']
    return { url: location.href, status: loaded.status, project: await loaded.json(), stores }
  }), null, 2)}\n`)
  const result = await app.evaluate(async ({ utilityProcess, app }, { fixture, root, artifact }) => {
    const path = process.getBuiltinModule('node:path')
    const fs = process.getBuiltinModule('node:fs/promises')
    const workspace = path.resolve(fixture, '..', 'build-copy')
    await fs.cp(fixture, workspace, { recursive: true })
    const runtimeRoot = artifact ? path.resolve(process.resourcesPath, 'runtime') : root
    await fs.symlink(path.resolve(runtimeRoot, 'node_modules'), path.resolve(workspace, 'node_modules'))
    return await new Promise((resolveResult, reject) => {
      const child = utilityProcess.fork(path.resolve(runtimeRoot, 'dist/build-worker.mjs'), [path.resolve(workspace, 'web')], { cwd: workspace, stdio: 'pipe' })
      let log = ''
      child.stdout?.on('data', (chunk) => {
        log += chunk
      })
      child.stderr?.on('data', (chunk) => {
        log += chunk
      })
      child.on('message', (message) => {
        child.kill()
        resolveResult({ ...message, log, versions: process.versions, packaged: app.isPackaged })
      })
      child.once('exit', code => reject(new Error(`Build child exit ${code}: ${log}`)))
    })
  }, { fixture, root, artifact })
  await mkdir(resolve(root, 'out/evidence'), { recursive: true })
  await page.screenshot({ path: resolve(root, 'out/evidence/p0-packaged.png') })
  await writeFile(resolve(root, 'out/evidence/p0-smoke.json'), JSON.stringify(result, null, 2))
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (result.type !== 'result')
    process.exitCode = 1
}
finally {
  const closed = app.waitForEvent('close')
  await app.evaluate(({ app }) => app.quit())
  await closed
}
