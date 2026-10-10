import type { AdvVoiceContext } from '@advjs/types'
import type { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, realpath, stat } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'

/** Check a path using real filesystem ancestors, including not-yet-created files. */
export async function resolveProjectPath(root: string, path: string, label: string): Promise<string> {
  const resolved = resolve(root, path)
  let ancestor = resolved
  while (true) {
    try {
      const canonical = await realpath(ancestor)
      const candidate = resolve(canonical, relative(ancestor, resolved))
      const distance = relative(root, candidate)
      if (distance === '..' || distance.startsWith(`..${sep}`) || isAbsolute(distance))
        throw new Error(`${label} must stay inside the project root`)
      return candidate
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw error
      const parent = dirname(ancestor)
      if (parent === ancestor)
        throw new Error(`Cannot resolve ${label}`)
      ancestor = parent
    }
  }
}

/** Require a real, absolute project directory before reading authoring inputs. */
export async function resolveProjectRoot(root: string): Promise<string> {
  if (!isAbsolute(root))
    throw new Error('The voice project root must be an absolute path')
  const canonical = await realpath(root)
  if (!(await stat(canonical)).isDirectory())
    throw new Error('The voice project root must identify a directory')
  return canonical
}

/** Hash a local file without passing its contents to a subprocess. */
export async function fileDigest(path: string): Promise<string> {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}

/** Execute a fixed program with argument arrays, progress forwarding, and cancellation. */
export async function executeCommand(command: string, arguments_: string[], context: AdvVoiceContext): Promise<string> {
  context.signal?.throwIfAborted()
  return new Promise<string>((resolvePromise, reject) => {
    const child = spawn(command, arguments_, { cwd: context.root, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let cancelled = false
    let failure: Error | undefined
    let killTimer: ReturnType<typeof setTimeout> | undefined
    const onAbort = (): void => {
      cancelled = true
      child.kill('SIGTERM')
      killTimer = setTimeout(() => child.kill('SIGKILL'), 3000)
      killTimer.unref()
    }
    const cleanup = (): void => {
      context.signal?.removeEventListener('abort', onAbort)
      if (killTimer)
        clearTimeout(killTimer)
    }
    context.signal?.addEventListener('abort', onAbort, { once: true })
    if (context.signal?.aborted)
      onAbort()
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
      if (stdout.length > 8 * 1024 * 1024) {
        failure ??= new Error(`${command} produced too much output`)
        if (!cancelled)
          onAbort()
      }
    })
    child.stderr.on('data', (chunk: Buffer) => {
      const message = chunk.toString()
      stderr = (stderr + message).slice(-64 * 1024)
      try {
        context.onProgress?.(message)
      }
      catch (error) {
        failure = error instanceof Error ? error : new Error(String(error))
        if (!cancelled)
          onAbort()
      }
    })
    child.once('error', (error: NodeJS.ErrnoException) => {
      cleanup()
      reject(new Error(error.code === 'ENOENT' ? `Missing ${command}; install uv for local voice setup` : error.message))
    })
    child.once('close', (code, signal) => {
      cleanup()
      if (failure) {
        reject(failure)
      }
      else if (cancelled) {
        reject(context.signal?.reason ?? new Error('Voice generation was cancelled'))
      }
      else if (code === 0) {
        resolvePromise(stdout)
      }
      else {
        reject(new Error(`${command} exited with ${signal ?? code}${stderr ? `\n${stderr.trim()}` : ''}`))
      }
    })
  })
}
