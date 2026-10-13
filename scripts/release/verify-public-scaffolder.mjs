import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import process from 'node:process'
import { parse, stringify } from 'yaml'
import { writeLaunchWorkspaceConfig } from '../../tests/launch/helpers/registry.ts'
import { LAUNCH_VERSION } from './package-specs.mjs'
import { assertPublicLockfile } from './public-lockfile.mjs'

import { resolvePnpmInvocation, runPnpm } from './run-command.mjs'

const mode = process.argv[2]
assert(['pinned', 'default'].includes(mode))
assert.equal((await runPnpm(['--version'])).stdout.trim(), '12.12.1')
const root = await realpath(await mkdtemp(join(tmpdir(), `advjs-public-${mode}-`)))
const cliName = mode === 'pinned' ? `adv@${LAUNCH_VERSION}` : 'adv'
await writeFile(join(root, 'package.json'), JSON.stringify({ private: true }))
await writeFile(join(root, 'registry.npmrc'), 'registry=https://registry.npmjs.org/\n')
await writeLaunchWorkspaceConfig(root)
const settings = parse(await readFile(join(root, 'pnpm-workspace.yaml'), 'utf8'))
await writeFile(join(root, 'pnpm-workspace.yaml'), stringify({ ...settings, cacheDir: join(root, 'cache'), storeDir: join(root, 'store'), dlxCacheMaxAge: 0 }))
const environment = { ...process.env, CI: '1', NODE_ENV: 'production', TEST: 'false', npm_config_userconfig: join(root, 'registry.npmrc'), npm_config_registry: 'https://registry.npmjs.org/', PNPM_CONFIG_CACHE_DIR: join(root, 'cache'), PNPM_CONFIG_STORE_DIR: join(root, 'store'), NO_COLOR: '1', FORCE_COLOR: '0' }
delete environment.NODE_PATH
delete environment.PNPM_HOME
const report = { mode, root, startedAt: new Date().toISOString(), commands: [] }
const reportDirectory = process.env.NPM_VERIFICATION_REPORT_DIR || root
await mkdir(reportDirectory, { recursive: true })
const reportPath = join(reportDirectory, `verification-${mode}.json`)
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
async function run(args, cwd = root) {
  console.log(`RUN pnpm ${args.join(' ')}`)
  const log = join(reportDirectory, `command-${report.commands.length + 1}.log`)
  let result
  try {
    result = await runPnpm(args, { cwd, env: environment, extendEnv: false, timeout: 600000 })
  }
  catch (error) {
    await writeFile(log, `${error.stdout || ''}\n${error.stderr || ''}`)
    report.commands.push({ args, cwd, log, status: 'failed' })
    report.status = 'failed'
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
    throw error
  }
  await writeFile(log, `${result.stdout}\n${result.stderr}`)
  report.commands.push({ args, cwd, log, completedAt: new Date().toISOString() })
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`PASS ${args.join(' ')}`)
  return result
}
async function stopPreview(child, completion) {
  if (child.pid) {
    try {
      process.kill(-child.pid, 'SIGTERM')
    }
    catch (error) {
      if (error.code !== 'ESRCH')
        throw error
    }
  }
  await completion
}
assert.match((await run(['create', cliName, '--help'])).stdout, /--template/u)
assert.equal((await run(['--reporter=silent', 'create', cliName, '--version'])).stdout.trim(), LAUNCH_VERSION)
for (const template of ['adv', 'plugin']) {
  const cwd = join(root, template === 'adv' ? 'game' : 'plugin')
  await run(['create', cliName, cwd, '--template', template, '--yes'])
  const pkg = JSON.parse(await readFile(join(cwd, 'package.json'), 'utf8'))
  assert(Object.values(pkg.devDependencies).includes(`^${LAUNCH_VERSION}`))
  assert(!JSON.stringify(pkg).includes('$ADVJS_VERSION'))
  assert((await stat(join(cwd, '.gitignore'))).isFile())
  if (mode === 'default' || mode === 'pinned') {
    await writeFile(join(cwd, 'pnpm-workspace.yaml'), stringify({ ...settings, cacheDir: join(root, 'cache'), storeDir: join(root, 'store'), dlxCacheMaxAge: 0 }))
    await run(['install', '--no-frozen-lockfile', '--prod=false'], cwd)
    const lock = await readFile(join(cwd, 'pnpm-lock.yaml'), 'utf8')
    assertPublicLockfile(lock)
    assert(!relative(root, await realpath(join(cwd, 'node_modules/.pnpm'))).startsWith('..'))
    const dependency = template === 'adv' ? 'advjs' : '@advjs/types'
    const installed = JSON.parse(await readFile(join(cwd, 'node_modules', dependency, 'package.json'), 'utf8'))
    assert.equal(installed.version, LAUNCH_VERSION)
    if (template === 'adv')
      await run(['run', 'check'], cwd)
    await run(['run', 'build'], cwd)
    assert((await stat(join(cwd, template === 'adv' ? 'dist/index.html' : 'dist/index.mjs'))).isFile())
    if (template === 'adv') {
      const invocation = resolvePnpmInvocation(['run', 'preview', '--host', '127.0.0.1', '--port', '0'], { npmExecPath: environment.npm_execpath })
      const child = spawn(invocation.command, invocation.args, { cwd, detached: true, env: environment, stdio: ['ignore', 'pipe', 'pipe'] })
      let output = ''
      const completion = new Promise(resolve => child.once('close', resolve))
      try {
        const url = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error(`Preview timeout: ${output}`)), 30000)
          const onData = (chunk) => {
            output += chunk.toString()
            const url = output.match(/http:\/\/127\.0\.0\.1:\d+\//u)?.[0]
            if (url) {
              clearTimeout(timer)
              resolve(url)
            }
          }
          child.stdout.on('data', onData)
          child.stderr.on('data', onData)
          child.once('error', (error) => {
            clearTimeout(timer)
            reject(error)
          })
          child.once('exit', () => {
            clearTimeout(timer)
            reject(new Error(`Preview exited: ${output}`))
          })
        })
        const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
        assert.equal(response.status, 200)
        assert((await response.text()).includes('<html'))
        report.preview = { status: response.status, checkedAt: new Date().toISOString() }
        console.log('PASS game preview HTTP 200')
      }
      finally {
        await stopPreview(child, completion)
      }
    }
  }
}
report.completedAt = new Date().toISOString()
report.status = 'passed'
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(`PUBLIC ${mode.toUpperCase()} VERIFICATION PASSED: ${root}`)
