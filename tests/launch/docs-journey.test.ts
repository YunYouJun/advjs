// @vitest-environment node

import type { Browser, BrowserContext } from 'playwright'
import { spawn } from 'node:child_process'
import { appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { verifyDeploymentUrl } from '../../packages/advjs/node/deploy'
import { createPackageManifest, LAUNCH_VERSION } from '../../scripts/release/package-manifest.mjs'
import { createLaunchJourney } from './helpers'
import { createLaunchRegistry, launchRegistryEnvironment, runLaunchCommand } from './helpers/registry'

const repositoryRoot = resolve(import.meta.dirname, '../..')
const pnpmExecutable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
let temporaryRoot = ''
let installRoot = ''
let advTarball = ''
let registry: Awaited<ReturnType<typeof createLaunchRegistry>>
const journeyRoots: string[] = []

function localJourneyCommands(source: string) {
  const markerStart = source.indexOf('<!-- launch-journey:local:start -->')
  const markerEnd = source.indexOf('<!-- launch-journey:local:end -->', markerStart)
  const fenceStart = source.indexOf('```bash\n', markerStart)
  const contentStart = fenceStart + '```bash\n'.length
  const fenceEnd = source.indexOf('```', contentStart)
  if (markerStart < 0 || markerEnd < 0 || fenceStart < 0 || fenceEnd < 0 || fenceEnd > markerEnd)
    throw new Error('Quick start has no launch-journey:local command block')
  return source.slice(contentStart, fenceEnd).trim().split('\n').map(line => line.trim()).filter(Boolean)
}

function editorReadyEvent(output: string) {
  for (const line of output.split('\n')) {
    try {
      const envelope = JSON.parse(line)
      if (envelope.data?.event === 'ready' && typeof envelope.data.url === 'string')
        return envelope.data as { event: 'ready', root: string, url: string }
    }
    catch {}
  }
  throw new Error('Packed Editor ready event did not contain a URL')
}

function wholeFileDiff(path: string, before: string, after: string) {
  const removed = before.split('\n').map(line => `-${line}`).join('\n')
  const added = after.split('\n').map(line => `+${line}`).join('\n')
  return `--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n${removed}\n${added}\n`
}

beforeAll(async () => {
  temporaryRoot = await mkdtemp(join(tmpdir(), 'advjs-docs-journey-'))
  installRoot = join(temporaryRoot, 'install')
  const packageRoot = join(temporaryRoot, 'packages')
  await Promise.all([mkdir(installRoot), mkdir(packageRoot)])
  const manifest = await createPackageManifest({ build: process.env.ADVJS_DOCS_JOURNEY_SKIP_BUILD !== '1', outputDirectory: packageRoot, root: repositoryRoot })
  advTarball = join(packageRoot, manifest.packages.find(pkg => pkg.name === 'advjs')!.tarball!)
  registry = await createLaunchRegistry(manifest, packageRoot)
  await writeFile(join(installRoot, 'package.json'), '{"name":"advjs-docs-journey","private":true}\n', 'utf8')
  await runLaunchCommand(pnpmExecutable, [
    `--registry=${registry.url}`,
    'add',
    `advjs@${LAUNCH_VERSION}`,
    `@advjs/mcp-server@${LAUNCH_VERSION}`,
  ], installRoot, registry.url, temporaryRoot)
}, 600_000)

afterAll(async () => {
  await registry?.close()
  await Promise.all(journeyRoots.map(root => rm(root, { force: true, recursive: true })))
  if (temporaryRoot)
    await rm(temporaryRoot, { force: true, recursive: true })
})

describe('published launch documentation journey', () => {
  it('removes stale launch claims and keeps one product boundary', async () => {
    const paths = ['README.md', 'docs/guide/index.md', 'docs/guide/quick-start.md', 'docs/guide/editor/index.md']
    const source = (await Promise.all(paths.map(path => readFile(resolve(repositoryRoot, path), 'utf8')))).join('\n')

    expect(source).not.toMatch(/Working in Progress|Demo\(WIP\)|尚未发布|pnpm create adv|npm init adv/iu)
    for (const product of ['advjs', '@advjs/editor', '@advjs/studio', 'Skills'])
      expect(source).toContain(product)
    expect(source).toContain('Chromium Stable')
    expect(source).toContain('adv deploy --provider cloudflare-pages --project rain-letter --json')
  })

  it('extracts packed commands and completes every required launch stage', async () => {
    const quickStart = await readFile(resolve(repositoryRoot, 'docs/guide/quick-start.md'), 'utf8')
    const commands = localJourneyCommands(quickStart)
    const binRoot = join(installRoot, 'node_modules/.bin')
    const advBin = join(installRoot, 'node_modules/advjs/bin/adv.mjs')
    const home = join(temporaryRoot, 'home')
    await mkdir(home)
    const environment = {
      ...launchRegistryEnvironment(registry.url, temporaryRoot),
      HOME: home,
      PATH: `${binRoot}${delimiter}${process.env.PATH || ''}`,
    }
    const journey = await createLaunchJourney({ packageSource: { kind: 'tarball', value: advTarball } })
    journeyRoots.push(journey.workspaceRoot)
    await writeFile(journey.artifacts.commandLog, '', 'utf8')
    let cwd = journey.workspaceRoot
    const envelopes: Array<Record<string, unknown>> = []
    let projectRoot = ''

    async function runDocumented(command: string) {
      if (command.startsWith('cd ')) {
        cwd = resolve(cwd, command.slice(3))
        projectRoot = cwd
        await appendFile(journey.artifacts.commandLog, `$ ${command}\n`, 'utf8')
        return
      }
      const [executable, ...args] = command.split(/\s+/u)
      expect(executable).toBe('adv')
      const result = await runLaunchCommand(process.execPath, [advBin, ...args], cwd, registry.url, temporaryRoot, environment).catch((error: Error & { stderr?: string, stdout?: string }) => {
        throw new Error(`${command} failed\nstdout:\n${error.stdout || ''}\nstderr:\n${error.stderr || ''}`, { cause: error })
      })
      await appendFile(journey.artifacts.commandLog, `$ ${command}\n${result.stdout}`, 'utf8')
      envelopes.push(JSON.parse(result.stdout))
    }

    const commandByPrefix = (prefix: string) => commands.find(command => command.startsWith(prefix))!
    const report = await journey.run({
      'install': async () => {
        await runDocumented(commandByPrefix('adv init '))
        await runDocumented(commandByPrefix('cd '))
        return { summary: 'packed CLI installed and default template initialized' }
      },
      'agent-mcp': async () => {
        await runDocumented(commandByPrefix('adv agent install '))
        await runDocumented(commandByPrefix('adv doctor '))
        return { summary: 'Codex Skills installed and MCP handshake passed' }
      },
      'check': async () => {
        await runDocumented(commandByPrefix('adv check '))
        return { summary: 'Markdown project validation passed' }
      },
      'editor': async () => {
        const output: string[] = []
        const child = spawn(process.execPath, [advBin, 'editor', '.', '--no-open', '--port', '0', '--json'], {
          cwd: projectRoot,
          env: environment,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        child.stdout.setEncoding('utf8')
        child.stdout.on('data', chunk => output.push(chunk))
        const closed = new Promise<number | null>((resolveClose, reject) => {
          child.once('error', reject)
          child.once('close', resolveClose)
        })
        let browser: Browser | undefined
        let context: BrowserContext | undefined
        try {
          await new Promise<void>((resolveReady, reject) => {
            const timer = setTimeout(() => reject(new Error('Packed Editor did not become ready')), 20_000)
            const inspect = () => {
              if (output.join('').includes('"event":"ready"')) {
                clearTimeout(timer)
                resolveReady()
              }
            }
            child.stdout.on('data', inspect)
            child.once('error', reject)
            child.once('exit', code => code === 0 ? undefined : reject(new Error(`Packed Editor exited with ${code}`)))
          })

          const ready = editorReadyEvent(output.join(''))
          const chapterRelativePath = 'adv/chapters/chapter_01.adv.md'
          const chapterPath = join(projectRoot, chapterRelativePath)
          const before = await readFile(chapterPath, 'utf8')
          browser = await chromium.launch({ headless: true })
          context = await browser.newContext()
          await context.tracing.start({ screenshots: true, snapshots: true })
          const page = await context.newPage()
          page.on('console', message => output.push(`[browser:${message.type()}] ${message.text()}\n`))
          page.on('pageerror', error => output.push(`[browser:pageerror] ${error.stack || error.message}\n`))
          page.on('requestfailed', request => output.push(`[browser:requestfailed] ${request.url()} ${request.failure()?.errorText || 'unknown'}\n`))
          await page.goto(ready.url)
          const skipOnboarding = page.getByText('Skip', { exact: true })
          if (await skipOnboarding.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false))
            await skipOnboarding.click()
          await page.getByText('Live local workspace').waitFor({ state: 'visible', timeout: 30_000 }).catch(async (error) => {
            output.push(`[browser:body] ${await page.locator('body').textContent().catch(() => '<unavailable>')}\n`)
            throw error
          })
          const startSourcePreview = page.getByRole('button', { name: 'Start source preview' })
          await startSourcePreview.click()
          await startSourcePreview.waitFor({ state: 'hidden', timeout: 15_000 })

          await page.getByText(chapterRelativePath, { exact: true }).dblclick()
          const editor = page.locator('.monaco-editor').last()
          await editor.click()
          await page.keyboard.press('Control+End')
          await page.keyboard.insertText('\n\n@艾莉亚\n首发旅程已由本地 Editor 保存。\n')
          await page.getByRole('button', { name: 'Save' }).click()
          await expect.poll(async () => await readFile(chapterPath, 'utf8')).toContain('首发旅程已由本地 Editor 保存。')
          const after = await readFile(chapterPath, 'utf8')
          await writeFile(journey.artifacts.projectDiff, wholeFileDiff(chapterRelativePath, before, after), 'utf8')
        }
        finally {
          if (context)
            await context.tracing.stop({ path: journey.artifacts.browserTrace })
          await browser?.close()
          child.kill('SIGTERM')
          await writeFile(journey.artifacts.editorLog, output.join(''), 'utf8')
        }
        const exitCode = await closed
        if (exitCode !== 0)
          throw new Error(`Packed Editor stopped with ${exitCode}`)
        await writeFile(journey.artifacts.editorLog, output.join(''), 'utf8')
        expect(output.join('')).toContain('"event":"stopped"')
        return { summary: 'Playwright edited, saved, and started source play in the packed local Editor' }
      },
      'build': async () => {
        await runDocumented(commandByPrefix('adv build '))
        const buildEnvelope = envelopes.find(envelope => envelope.command === 'build')
        await writeFile(journey.artifacts.buildSummary, `${JSON.stringify(buildEnvelope, null, 2)}\n`, 'utf8')
        return { summary: 'fresh static build passed' }
      },
      'deploy': async () => {
        const fixture = resolve(repositoryRoot, 'tests/launch/fixtures/run-packed-deploy.mjs')
        const installedModule = join(installRoot, 'node_modules/advjs/dist/node/index.mjs')
        const result = await runLaunchCommand(
          process.execPath,
          [fixture, installedModule, projectRoot],
          projectRoot,
          registry.url,
          temporaryRoot,
          environment,
        )
        const machineResult = result.stdout.trim().split('\n').at(-1)
        expect(JSON.parse(machineResult!)).toMatchObject({ deploymentId: 'launch-deployment' })
        return { summary: 'Cloudflare provider contract wrote immutable receipts' }
      },
      'verify-url': async () => {
        const fetchImpl = async (input: string | URL | Request) => {
          const url = String(input)
          if (url.endsWith('.js'))
            return new Response('console.log(1)', { headers: { 'content-type': 'application/javascript' } })
          if (url.includes('__advjs_verify__'))
            return new Response('<html>fallback</html>', { headers: { 'content-type': 'text/html' } })
          return new Response('<html><script src="/app.js"></script></html>', { headers: { 'content-type': 'text/html' } })
        }
        await verifyDeploymentUrl({ fetch: fetchImpl, url: 'https://rain-letter.pages.dev/' })
        return { summary: 'HTTPS entry, asset MIME, and SPA fallback verified' }
      },
    })

    expect(report.status, JSON.stringify(report)).toBe('passed')
    expect(report.stages.every(stage => stage.status === 'passed')).toBe(true)
    expect(envelopes.map(envelope => envelope.command)).toEqual(['init', 'agent.install', 'doctor', 'check', 'build'])
    expect(envelopes.every(envelope => envelope.ok === true)).toBe(true)
    expect(await readFile(join(journey.workspaceRoot, 'rain-letter/adv.config.json'), 'utf8')).toContain('adv-md')
    await expect(readFile(journey.artifacts.editorLog, 'utf8')).resolves.toContain('"event":"stopped"')
    await expect(readFile(journey.artifacts.projectDiff, 'utf8')).resolves.toContain('首发旅程已由本地 Editor 保存。')
    await expect(readFile(journey.artifacts.buildSummary, 'utf8')).resolves.toContain('"command": "build"')
    expect((await readFile(journey.artifacts.browserTrace)).byteLength).toBeGreaterThan(0)
  }, 300_000)
})
