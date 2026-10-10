// @vitest-environment node
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { executeCommand } from '../src/runtime'

let root: string
beforeEach(async () => {
  root = await mkdtemp(resolve(tmpdir(), 'advjs-qwen-runtime-'))
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('voice subprocess execution', () => {
  it('preserves shell metacharacters as literal arguments', async () => {
    const literal = '$(touch escaped); `echo unsafe`'
    await expect(executeCommand(process.execPath, ['-e', 'process.stdout.write(process.argv[1])', literal], { root })).resolves.toBe(literal)
  })

  it('rejects nonzero exit status with useful stderr', async () => {
    await expect(executeCommand(process.execPath, ['-e', 'process.stderr.write("missing weights");process.exit(7)'], { root })).rejects.toThrow('exited with 7\nmissing weights')
  })

  it('forwards progress and terminates a running child on cancellation', async () => {
    const controller = new AbortController()
    const pending = executeCommand(process.execPath, ['-e', 'process.stderr.write("ready");setInterval(()=>{},1000)'], {
      root,
      signal: controller.signal,
      onProgress: (message) => {
        if (message.includes('ready'))
          controller.abort(new Error('Stop voice generation'))
      },
    })
    await expect(pending).rejects.toThrow('Stop voice generation')
  })
})
