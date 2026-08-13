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

export async function runNpx(args, options = {}) {
  return await runCommand('npx', args, options)
}
