import { spawnSync } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const heapOption = /--max[-_]old[-_]space[-_]size(?:[-_]percentage)?(?=[=\s]|$)/u

/** The CLI declaration build exceeds Node's default ~2 GB heap on CI runners. */
export function buildNodeOptions(nodeOptions = '', execArgv = []) {
  if (heapOption.test(nodeOptions) || execArgv.some(argument => heapOption.test(argument)))
    return nodeOptions
  return [nodeOptions, '--max-old-space-size=6144'].filter(Boolean).join(' ')
}

export function runBuild({ args = process.argv.slice(2), execArgv = process.execArgv, env = process.env, runner = spawnSync } = {}) {
  // Resolve beside unbuild's public entry instead of relying on shell shims.
  const cli = fileURLToPath(new URL('cli.mjs', import.meta.resolve('unbuild')))
  const result = runner(process.execPath, [...execArgv, cli, ...args], {
    env: { ...env, NODE_OPTIONS: buildNodeOptions(env.NODE_OPTIONS, execArgv) },
    stdio: 'inherit',
    windowsHide: true,
  })
  if (result.error)
    throw result.error
  return result
}

export function finishBuild(result, host = process) {
  if (result.signal) {
    host.kill(host.pid, result.signal)
    return
  }
  host.exitCode = result.status ?? 1
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
  finishBuild(runBuild())
