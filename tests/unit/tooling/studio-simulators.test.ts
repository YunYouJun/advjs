// @vitest-environment node

import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, resolve } from 'node:path'
import { promisify } from 'node:util'
import { expect, it } from 'vitest'

const execFileAsync = promisify(execFile)
const script = resolve(import.meta.dirname, '../../../apps/studio-ios/scripts/simulator-destinations.mjs')

async function simulatorFixture(run: (invoke: (...args: string[]) => Promise<{ stdout: string, stderr: string }>, calls: () => Promise<string[][]>) => Promise<void>) {
  const cwd = await mkdtemp(resolve(tmpdir(), 'advjs-simulators-'))
  try {
    const callsPath = resolve(cwd, 'calls.jsonl')
    await writeFile(callsPath, '')
    await writeFile(resolve(cwd, 'xcrun'), `#!/usr/bin/env node
const fs = require('node:fs')
const args = process.argv.slice(2)
fs.appendFileSync(process.env.SIMULATOR_CALLS, JSON.stringify(args) + '\\n')
if (args[1] === 'list') {
  process.stdout.write(JSON.stringify({ devices: { 'com.apple.CoreSimulator.SimRuntime.iOS-26-5': [
    { name: 'iPhone', udid: 'phone-id', deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro' },
    { name: 'iPad', udid: 'pad-id', deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPad-Pro', state: 'Shutdown' },
  ] } }))
} else if (args[1] === 'bootstatus') {
  process.stderr.write('boot failed before readiness\\n')
  process.exit(37)
} else if (args[1] !== 'shutdown') {
  process.exit(99)
}
`, { mode: 0o755 })
    const invoke = (...args: string[]) => execFileAsync(process.execPath, [script, ...args], {
      cwd,
      env: { ...process.env, PATH: `${cwd}${delimiter}${process.env.PATH}`, SIMULATOR_CALLS: callsPath },
    })
    await run(invoke, async () => (await readFile(callsPath, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line)))
  }
  finally {
    await rm(cwd, { recursive: true, force: true })
  }
}

it('waits for selected simulator readiness and propagates boot failure', async () => {
  await simulatorFixture(async (invoke, calls) => {
    await expect(invoke('--only', 'iphone', '--boot')).rejects.toMatchObject({ code: 37, stderr: expect.stringContaining('boot failed before readiness') })
    expect(await calls()).toEqual([
      ['simctl', 'list', 'devices', 'available', '-j'],
      ['simctl', 'bootstatus', 'phone-id', '-b'],
    ])
  })
})

it('shuts down only the selected device before switching coverage', async () => {
  await simulatorFixture(async (invoke, calls) => {
    await invoke('--only', 'iphone', '--shutdown')
    expect(await calls()).toEqual([
      ['simctl', 'list', 'devices', 'available', '-j'],
      ['simctl', 'shutdown', 'phone-id'],
    ])
  })
})

it('keeps destination lookup read-only', async () => {
  await simulatorFixture(async (invoke, calls) => {
    expect((await invoke('--only', 'ipad')).stdout).toBe('-destination id=pad-id')
    expect(await calls()).toEqual([['simctl', 'list', 'devices', 'available', '-j']])
  })
})
