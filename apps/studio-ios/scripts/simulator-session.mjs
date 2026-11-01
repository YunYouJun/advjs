#!/usr/bin/env node
/** Run xcodebuild on existing simulators, one at a time. Never create/erase/delete. */
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rmdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { selectDevices } from './simulator-destinations.mjs'

let child
let interrupted = 0
let cleaning = false
for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143]]) {
  process.on(signal, () => {
    interrupted ||= code
    // Forward only to the direct child started by this session, then await exit.
    if (!cleaning)
      child?.kill(signal)
  })
}

async function command(executable, args, capture = false) {
  if (interrupted && !cleaning)
    throw new Error('Session interrupted')
  return new Promise((resolve, reject) => {
    const current = spawn(executable, args, { stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit' })
    child = current
    let output = ''
    current.stdout?.setEncoding('utf8').on('data', chunk => output += chunk)
    current.on('error', reject)
    current.on('close', (code, signal) => {
      if (child === current)
        child = undefined
      if (code === 0)
        resolve(output)
      else
        reject(new Error(`${executable} ${args[0]} failed (${signal || code})`))
    })
  })
}

async function listDevices() {
  return JSON.parse(await command('xcrun', ['simctl', 'list', 'devices', 'available', '-j'], true)).devices
}

function findSameDevice(devices, selected) {
  const device = (devices[selected.runtime] || []).find(device => device.udid === selected.udid)
  if (!device || device.isAvailable === false || device.name !== selected.name || device.deviceTypeIdentifier !== selected.deviceTypeIdentifier)
    throw new Error(`Device identity/availability changed: ${selected.udid}; leaving it untouched`)
  return device
}

async function lockDevice(device) {
  if (!/^[A-F\d-]{36}$/iu.test(device.udid))
    throw new Error('Invalid simulator UDID')
  // A stable per-user host path: TMPDIR differs between worktrees/executors.
  const root = path.join('/tmp', `advjs-studio-simulators-${process.getuid?.() ?? 'user'}`)
  await mkdir(root, { recursive: true, mode: 0o700 })
  const directory = path.join(root, `${device.udid}.lock`)
  try {
    await mkdir(directory, { mode: 0o700 })
  }
  catch (error) {
    if (error.code === 'EEXIST')
      throw new Error(`Device ${device.udid} is locked: ${directory}. No device state changed. Verify the owner before removing a stale lock; locks are never auto-reclaimed.`)
    throw error
  }
  const ownerPath = path.join(directory, 'owner.json')
  const token = randomUUID()
  try {
    await writeFile(ownerPath, JSON.stringify({ token, pid: process.pid, startedAt: new Date().toISOString(), ...device }), { flag: 'wx', mode: 0o600 })
  }
  catch (error) {
    await rmdir(directory).catch(() => {})
    throw error
  }
  return async () => {
    const owner = JSON.parse(await readFile(ownerPath, 'utf8'))
    if (owner.token !== token)
      throw new Error(`Lock ownership changed: ${directory}; leaving it untouched`)
    await unlink(ownerPath)
    await rmdir(directory)
  }
}

async function session(device, buildArgs) {
  const unlock = await lockDevice(device)
  let bootOwned = false
  try {
    const current = findSameDevice(await listDevices(), device)
    process.stderr.write(`Using ${device.name}: ${device.udid} / ${device.runtime} / ${device.deviceTypeIdentifier}; initial=${current.state}\n`)
    if (current.state === 'Shutdown') {
      // A failed/interrupted boot request has uncertain ownership: never shut it down.
      try {
        await command('xcrun', ['simctl', 'boot', device.udid])
      }
      catch (error) {
        process.stderr.write(`Boot outcome uncertain for ${device.udid}; no automatic shutdown will be attempted.\n`)
        throw error
      }
      bootOwned = true
      await command('xcrun', ['simctl', 'bootstatus', device.udid])
    }
    else if (current.state === 'Booting') {
      await command('xcrun', ['simctl', 'bootstatus', device.udid])
    }
    else if (current.state !== 'Booted') {
      throw new Error(`Unsupported device state ${current.state}; leaving it untouched`)
    }
    const args = buildArgs.map(arg => arg.replaceAll('{family}', device.family))
    await command('xcodebuild', [...args, '-destination', `id=${device.udid}`, '-parallel-testing-enabled', 'NO', '-parallel-testing-worker-count', '1', '-maximum-concurrent-test-simulator-destinations', '1'])
  }
  finally {
    cleaning = true
    try {
      if (bootOwned) {
        // Keep the lock until our child exits and cleanup finishes. Never act on a
        // changed identity or an unavailable device when cleanup reads fail.
        const current = findSameDevice(await listDevices(), device)
        if (current.state === 'Booted' || current.state === 'Booting')
          await command('xcrun', ['simctl', 'shutdown', device.udid])
        else if (current.state !== 'Shutdown')
          throw new Error(`Cleanup cannot confirm the state of ${device.udid}; left untouched`)
      }
    }
    catch (error) {
      process.stderr.write(`Cleanup could not confirm/shut down ${device.udid}; inspect the device after this task. Data was left untouched.\n`)
      throw error
    }
    finally {
      await unlock()
      cleaning = false
    }
  }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help')) {
    process.stdout.write('Usage: simulator-session.mjs [--only iphone|ipad|both] [--config profile.json | --ci] -- <xcodebuild arguments>\nExisting devices only; both runs serially; use {family} in result bundle paths.\n')
    return
  }
  const separator = args.indexOf('--')
  if (separator < 0 || separator === args.length - 1)
    throw new Error('Supply xcodebuild arguments after -- (see --help)')
  const options = args.slice(0, separator)
  const buildArgs = args.slice(separator + 1)
  let only = 'both'
  let config = new URL('./simulator-profile.json', import.meta.url)
  let ci = false
  let explicitConfig = false
  for (let index = 0; index < options.length; index++) {
    const flag = options[index]
    if (flag === '--only')
      only = options[++index]
    else if (flag === '--config') {
      config = options[++index]
      explicitConfig = true
    }
    else if (flag === '--ci')
      ci = true
    else
      throw new Error(`Unknown option: ${flag}`)
  }
  if (!['both', 'iphone', 'ipad'].includes(only) || !config)
    throw new Error('Invalid --only or --config')
  if (ci && (process.env.CI !== 'true' || explicitConfig))
    throw new Error('--ci requires CI=true and cannot be combined with --config')
  const reserved = ['-destination', '-parallel-testing-enabled', '-parallel-testing-worker-count', '-maximum-concurrent-test-simulator-destinations']
  if (buildArgs.some(arg => reserved.some(flag => arg === flag || arg.startsWith(`${flag}=`))))
    throw new Error('Destination and simulator parallelism are owned by this session; remove those xcodebuild arguments')
  const profile = ci ? undefined : JSON.parse(await readFile(config, 'utf8'))
  const selected = selectDevices(await listDevices(), only, profile)
  for (const device of selected) {
    if (interrupted)
      break
    await session(device, buildArgs)
  }
}

try {
  await main()
}
catch (error) {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
}
if (interrupted)
  process.exitCode = interrupted
