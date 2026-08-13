import { existsSync } from 'node:fs'
import { win32 } from 'node:path'
import process from 'node:process'
import { execa } from 'execa'

/**
 * Run a short-lived command through one cross-platform process boundary.
 * Execa resolves Windows command shims without enabling a shell, so arguments
 * retain their exact boundaries on every supported runner.
 */
export async function runCommand(command, args = [], options = {}) {
  const result = await execa(command, args, {
    cwd: options.cwd,
    env: options.env,
    extendEnv: options.extendEnv ?? true,
    maxBuffer: options.maxBuffer ?? 20 * 1024 * 1024,
    stderr: options.stderr ?? 'pipe',
    stdout: options.stdout ?? 'pipe',
    timeout: options.timeout,
    windowsHide: true,
  })

  return {
    stderr: typeof result.stderr === 'string' ? result.stderr : '',
    stdout: typeof result.stdout === 'string' ? result.stdout : '',
  }
}

export async function runPnpm(args, options = {}) {
  const npmExecPath = options.env?.npm_execpath || process.env.npm_execpath
  if (npmExecPath && /\.(?:c|m)?js$/u.test(npmExecPath))
    return await runCommand(process.execPath, [npmExecPath, ...args], options)
  return await runCommand('pnpm', args, options)
}

export function resolveNpxInvocation(args, runtime = {}) {
  const execPath = runtime.execPath ?? process.execPath
  const platform = runtime.platform ?? process.platform
  if (platform === 'win32') {
    return {
      args: [win32.join(win32.dirname(execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js'), ...args],
      command: execPath,
    }
  }
  return { args, command: 'npx' }
}

export async function runNpx(args, options = {}) {
  const invocation = resolveNpxInvocation(args)
  if (process.platform === 'win32' && !existsSync(invocation.args[0]))
    throw new Error(`Unable to locate the npm npx CLI beside Node.js: ${invocation.args[0]}`)
  return await runCommand(invocation.command, invocation.args, options)
}
