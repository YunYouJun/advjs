import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, delimiter, dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import process from 'node:process'
import { _electron as electron, expect } from '@playwright/test'

const root = resolve(import.meta.dirname, '..')
const repo = resolve(root, '../..')
const target = `${process.platform}-${process.arch}`
const packageRoot = resolve(root, 'out', `ADV.JS Editor-${target}`)
const executable = resolve(process.argv[2] ?? process.env.ADVJS_DESKTOP_EXECUTABLE ?? (
  process.platform === 'darwin'
    ? resolve(packageRoot, 'ADV.JS Editor.app/Contents/MacOS/advjs-editor')
    : resolve(packageRoot, process.platform === 'win32' ? 'advjs-editor.exe' : 'advjs-editor')
))
const original = process.platform === 'darwin' ? resolve(executable, '../../..') : dirname(executable)
assert(process.platform !== 'darwin' || original.endsWith('.app'), 'Expected an executable inside a packaged .app')
const evidence = resolve(root, 'out/evidence')
const reportPath = resolve(evidence, `packaged-smoke-${target}.json`)
const workspace = await mkdtemp(resolve(tmpdir(), 'advjs-package-smoke-'))
const relocated = resolve(workspace, basename(original))
const fixture = resolve(workspace, '中文 创作项目')
const userData = resolve(workspace, 'userData')
const destination = resolve(workspace, 'exported-web')
const roomSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#35465c"/></svg>'
const report = { platform: process.platform, arch: process.arch, executable, status: 'running' }
const errors = []
let app
let page

function contains(parent, child) {
  const part = relative(parent, child)
  return !isAbsolute(part) && part !== '..' && !part.startsWith(`..${sep}`)
}

async function verifyLinks(directory, boundary) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isSymbolicLink())
      assert(contains(boundary, await realpath(path)), `Packaged link escapes the relocated application: ${path}`)
    else if (entry.isDirectory())
      await verifyLinks(path, boundary)
  }
}

// Remove developer tool paths on every platform while retaining OS utilities.
function runtimeEnvironment() {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => ![
    'path',
    'node_path',
    'node_options',
    'electron_run_as_node',
  ].includes(key.toLowerCase())))
  const systemRoot = process.env.SystemRoot ?? process.env.SYSTEMROOT ?? process.env.WINDIR
  if (process.platform === 'win32')
    assert(systemRoot, 'Windows SystemRoot is required')
  env.PATH = process.platform === 'win32'
    ? [resolve(systemRoot, 'System32'), systemRoot].join(delimiter)
    : '/usr/bin:/bin'
  return { ...env, NODE_PATH: '', NODE_OPTIONS: '', ADVJS_DESKTOP_TEST_DATA: userData }
}

async function verifyExport(directory, forbidden) {
  const files = []
  let sceneImage = false
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = resolve(current, entry.name)
      assert(!entry.isSymbolicLink(), `Export must contain ordinary files: ${path}`)
      assert(!['node_modules', 'adv.config.json', 'adv.config.ts', 'package.json'].includes(entry.name), `Unexpected source dependency: ${path}`)
      if (entry.isDirectory()) {
        await visit(path)
      }
      else {
        files.push(relative(directory, path))
        if (/\.(?:html|js|css|json|svg)$/u.test(entry.name)) {
          const source = await readFile(path, 'utf8')
          if (entry.name.endsWith('.svg') && source === roomSvg)
            sceneImage = true
          for (const value of forbidden) {
            for (const encoded of [value, value.replaceAll('\\', '/'), JSON.stringify(value).slice(1, -1)])
              assert(!source.includes(encoded), `Export contains a local path or credential: ${relative(directory, path)}`)
          }
        }
      }
    }
  }
  await visit(directory)
  assert((await readFile(resolve(directory, 'index.html'), 'utf8')).includes('<html'), 'Missing exported HTML')
  assert(files.some(file => file.endsWith('.js')), 'Missing game JavaScript')
  assert(sceneImage, 'Local scene image was not exported intact')
  return files.length
}

try {
  await mkdir(evidence, { recursive: true })
  assert(!contains(repo, workspace), 'Packaged smoke must run outside the checkout')
  process.stdout.write(`Relocating packaged ${target} application outside the checkout…\n`)
  await cp(original, relocated, { recursive: true, verbatimSymlinks: true })
  await verifyLinks(relocated, await realpath(relocated))
  await cp(resolve(repo, 'tests/launch/fixtures/golden-project'), fixture, { recursive: true })
  await mkdir(resolve(fixture, 'adv/assets'), { recursive: true })
  await writeFile(resolve(fixture, 'adv/assets/room.svg'), roomSvg)
  const manifestPath = resolve(fixture, 'adv/assets.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  manifest.assets = [{ id: 'room', kind: 'background', type: 'image', path: 'room.svg' }]
  await writeFile(manifestPath, JSON.stringify(manifest))
  const scene = resolve(fixture, 'adv/scenes/room.md')
  await writeFile(scene, (await readFile(scene, 'utf8')).replace('id: room', 'id: room\nassetId: room'))
  await writeFile(resolve(fixture, 'index.html'), '<!-- author source must survive the export -->')
  await mkdir(userData, { recursive: true })
  await writeFile(resolve(userData, 'editor-preferences.json'), JSON.stringify({ locale: 'en', onboarded: true }))

  const env = runtimeEnvironment()
  const movedExecutable = resolve(relocated, relative(original, executable))
  app = await electron.launch({ executablePath: movedExecutable, cwd: workspace, args: [`--project=${fixture}`], env, timeout: 60000 })
  page = await app.firstWindow({ timeout: 60000 })
  page.on('pageerror', error => errors.push(String(error)))
  page.on('console', (message) => {
    if (message.type() === 'error')
      errors.push(message.text())
  })
  await page.waitForFunction(() => location.protocol === 'http:' && window.advDesktop, undefined, { timeout: 60000 })
  await page.waitForFunction(async () => (await window.advDesktop.session())?.root?.includes('中文 创作项目'), undefined, { timeout: 60000 })
  await expect(page.locator('.advjs-editor-layout')).toBeVisible({ timeout: 60000 })
  await expect(page.locator('.ae-editor-splash')).toHaveCount(0, { timeout: 60000 })
  const session = await page.evaluate(() => window.advDesktop.session())
  const response = await fetch(`${session.origin}/__advjs/api/project`, { headers: { authorization: `Bearer ${session.token}` } })
  assert.equal(response.status, 200, `Project service failed: ${await response.text()}`)
  assert.equal(await fetch(`${session.origin}/__advjs/api/project`).then(value => value.status), 401, 'Project service must require credentials')
  report.runtime = await app.evaluate(({ app }) => ({ packaged: app.isPackaged, versions: process.versions, path: process.env.PATH, cwd: process.cwd(), executable: process.execPath, resources: process.resourcesPath }))
  assert.equal(report.runtime.packaged, true)
  assert.equal(report.runtime.path, env.PATH)
  assert(contains(await realpath(relocated), await realpath(report.runtime.executable)), 'App must execute from the relocated copy')
  assert(contains(await realpath(relocated), await realpath(report.runtime.resources)), 'App resources must come from the relocated copy')
  await page.screenshot({ path: resolve(evidence, `packaged-smoke-${target}.png`) })

  process.stdout.write('Opened the packaged Editor; exporting a game with its bundled runtime…\n')
  await app.evaluate(({ dialog }, output) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: output })
  }, destination)
  const task = await page.evaluate(() => window.advDesktop.exportGame('directory'))
  assert(task?.id, 'Export did not start')
  await expect.poll(async () => (await page.evaluate(() => window.advDesktop.taskStatus()))?.state, { timeout: 300000, intervals: [250, 500, 1000] }).not.toBe('running')
  const completed = await page.evaluate(() => window.advDesktop.taskStatus())
  report.build = completed
  assert.equal(completed?.state, 'succeeded', JSON.stringify(completed))
  assert.equal(await realpath(completed.output), await realpath(destination))
  report.exportedFiles = await verifyExport(destination, [repo, fixture, userData, relocated, session.token])
  assert.equal(await readFile(resolve(fixture, 'index.html'), 'utf8'), '<!-- author source must survive the export -->')
  report.checks = { relocatedApplication: true, internalPackageLinks: true, restrictedPath: true, authenticatedProject: true, nativeExport: true, portableExport: true, sourcePreserved: true }
  report.status = 'passed'
  process.stdout.write(`Packaged ${target} smoke passed (${report.exportedFiles} exported files).\n`)
}
catch (error) {
  report.status = 'failed'
  report.error = error instanceof Error ? error.stack : String(error)
  if (page)
    await page.screenshot({ path: resolve(evidence, `packaged-smoke-${target}-failure.png`) }).catch(() => {})
  throw error
}
finally {
  report.rendererErrors = errors
  await mkdir(evidence, { recursive: true })
  await writeFile(reportPath, JSON.stringify(report, null, 2))
  try {
    if (app)
      await app.close()
  }
  finally {
    await rm(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
  }
}
