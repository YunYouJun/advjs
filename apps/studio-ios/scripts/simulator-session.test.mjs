import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const runner = fileURLToPath(new URL('./simulator-session.mjs', import.meta.url))
const runtime = 'com.apple.CoreSimulator.SimRuntime.iOS-27-0'
const phoneID = '11111111-1111-4111-8111-111111111111'
const padID = '22222222-2222-4222-8222-222222222222'
const unrelatedID = '33333333-3333-4333-8333-333333333333'
const profile = {
  runtime,
  devices: {
    iphone: {
      name: 'ADV Studio iPhone 18 Pro',
      deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-18-Pro',
    },
    ipad: {
      name: 'ADV Studio iPad Pro 11 M5',
      deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPad-Pro-11-inch-M5-12GB',
    },
  },
}

// The fake binaries have no fallback to the real tools. Unknown commands fail.
const fakeTool = String.raw`
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
const tool = path.basename(process.argv[1])
const args = process.argv.slice(2)
const load = () => JSON.parse(fs.readFileSync(process.env.MOCK_STATE, 'utf8'))
const save = value => fs.writeFileSync(process.env.MOCK_STATE, JSON.stringify(value))
const event = (kind, details = {}) => fs.appendFileSync(process.env.MOCK_EVENTS,
  JSON.stringify({ kind, tool, pid: process.pid, args, ...details }) + '\n')
const fail = message => { console.error(message); process.exit(90) }
if (tool === 'xcrun') {
  if (args[0] !== 'simctl') fail('Only mock simctl is supported')
  const command = args[1]
  const state = load()
  event(command)
  if (command === 'list' && args[2] === 'devices') {
    console.log(JSON.stringify({ devices: state.devices }))
  }
  else if (command === 'boot' || command === 'bootstatus' || command === 'shutdown') {
    const device = Object.values(state.devices).flat().find(item => item.udid === args[2])
    if (!device) fail('Unknown mock device')
    if (command === 'boot') {
      if (device.state !== 'Shutdown') fail('Mock refuses to boot a running device')
      device.state = 'Booted'
    }
    if (command === 'bootstatus') {
      if (args.includes('-b')) fail('bootstatus must not implicitly boot a device')
      if (device.state !== 'Booted' && device.state !== 'Booting') fail('Device was not booted')
      device.state = 'Booted'
    }
    if (command === 'shutdown') device.state = 'Shutdown'
    save(state)
  }
  else fail('Unexpected mock simctl command: ' + args.join(' '))
}
else if (tool === 'xcodebuild') {
  const destination = args[args.indexOf('-destination') + 1]
  event('build-start', { destination })
  const finish = code => { event('build-exit', { code, destination }); process.exit(code) }
  if (process.env.MOCK_BUILD_MODE === 'hold') {
    process.on('SIGTERM', () => { event('build-signal', { signal: 'SIGTERM' }); setTimeout(() => finish(143), 30) })
    process.on('SIGINT', () => { event('build-signal', { signal: 'SIGINT' }); setTimeout(() => finish(130), 30) })
    setInterval(() => {
      if (fs.existsSync(process.env.MOCK_RELEASE)) finish(0)
    }, 20)
  }
  else finish(process.env.MOCK_BUILD_MODE === 'fail' ? 65 : 0)
}
else fail('Unexpected mock executable')
`

function device(family, state = 'Shutdown') {
  return {
    ...profile.devices[family],
    udid: family === 'iphone' ? phoneID : padID,
    isAvailable: true,
    state,
  }
}

async function fixture(t, devices = [device('iphone'), device('ipad')]) {
  // Each fixture owns unique mock IDs, even when multiple test runs share /tmp.
  const ids = { phoneID: randomUUID(), padID: randomUUID(), unrelatedID: randomUUID() }
  const replacements = new Map([[phoneID, ids.phoneID], [padID, ids.padID], [unrelatedID, ids.unrelatedID]])
  devices = devices.map(item => ({ ...item, udid: replacements.get(item.udid) || item.udid }))
  const directory = await mkdtemp(path.join(tmpdir(), 'studio-simulator-test-'))
  const bin = path.join(directory, 'bin')
  await mkdir(bin)
  // env's PATH lookup handles bundled Node paths containing spaces in the host.
  await symlink(process.execPath, path.join(bin, 'node'))
  const stateFile = path.join(directory, 'state.json')
  const eventsFile = path.join(directory, 'events.jsonl')
  const configFile = path.join(directory, 'profile.json')
  await writeFile(stateFile, JSON.stringify({ devices: { [runtime]: devices } }))
  await writeFile(eventsFile, '')
  await writeFile(configFile, JSON.stringify(profile))
  for (const name of ['xcrun', 'xcodebuild']) {
    const executable = path.join(bin, name)
    await writeFile(executable, `#!/usr/bin/env node\n${fakeTool}`)
    await chmod(executable, 0o755)
  }
  const children = new Set()
  t.after(async () => {
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGTERM')
        await child.completed
      }
    }
    await rm(directory, { recursive: true, force: true })
  })
  const env = {
    ...process.env,
    PATH: bin,
    TMPDIR: directory,
    MOCK_STATE: stateFile,
    MOCK_EVENTS: eventsFile,
    MOCK_RELEASE: path.join(directory, 'release'),
  }
  return {
    directory,
    ...ids,
    async events() {
      return (await readFile(eventsFile, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
    },
    async state() { return JSON.parse(await readFile(stateFile, 'utf8')) },
    async setState(state) { await writeFile(stateFile, JSON.stringify(state)) },
    async setConfig(config) { await writeFile(configFile, JSON.stringify(config)) },
    async release() { await writeFile(env.MOCK_RELEASE, '') },
    run({ only = 'iphone', args = ['test', '-scheme', 'StudioApp'], options = [], mode = 'ok', temporaryDirectory = directory } = {}) {
      const invocation = ['--config', configFile, ...(only ? ['--only', only] : []), ...options, '--', ...args]
      const child = spawn(process.execPath, [runner, ...invocation], {
        env: { ...env, TMPDIR: temporaryDirectory, MOCK_BUILD_MODE: mode },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      children.add(child)
      let stdout = ''
      let stderr = ''
      child.stdout.on('data', chunk => stdout += chunk)
      child.stderr.on('data', chunk => stderr += chunk)
      child.completed = new Promise((resolve, reject) => {
        child.on('error', reject)
        child.on('close', (code, signal) => resolve({ code, signal, stdout, stderr }))
      })
      return child
    },
  }
}

function calls(events, command) {
  return events.filter(event => event.kind === command)
}

function assertNoDeviceChanges(events) {
  assert.deepEqual(events.filter(event => event.tool === 'xcrun' && event.kind !== 'list'), [])
  assert.equal(calls(events, 'build-start').length, 0)
}

async function waitFor(check, description) {
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    if (await check())
      return
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  assert.fail(`Timed out waiting for ${description}`)
}

test('repeated runs reuse the same configured device without creating devices', { timeout: 10000 }, async (t) => {
  const unrelated = { ...device('iphone', 'Booted'), name: 'Cook iPhone', udid: unrelatedID }
  const f = await fixture(t, [unrelated, device('iphone')])
  for (let run = 0; run < 2; run++) {
    const result = await f.run().completed
    assert.equal(result.code, 0, result.stderr)
  }
  const events = await f.events()
  assert.equal(calls(events, 'build-start').length, 2)
  assert.deepEqual(calls(events, 'boot').map(event => event.args[2]), [f.phoneID, f.phoneID])
  assert.deepEqual(calls(events, 'shutdown').map(event => event.args[2]), [f.phoneID, f.phoneID])
  assert.equal(calls(events, 'create').length + calls(events, 'clone').length + calls(events, 'erase').length + calls(events, 'delete').length, 0)
  assert.equal((await f.state()).devices[runtime].find(item => item.udid === f.unrelatedID).state, 'Booted')
})

test('default iPhone/iPad run is serial and prevents parallel test clones', { timeout: 10000 }, async (t) => {
  const f = await fixture(t)
  const result = await f.run({ only: null, args: ['test', '-resultBundlePath', 'build/{family}.xcresult'] }).completed
  assert.equal(result.code, 0, result.stderr)
  const events = await f.events()
  const lifecycle = events.filter(event => ['boot', 'build-start', 'build-exit', 'shutdown'].includes(event.kind))
  assert.deepEqual(lifecycle.map(event => event.kind), ['boot', 'build-start', 'build-exit', 'shutdown', 'boot', 'build-start', 'build-exit', 'shutdown'])
  const builds = calls(events, 'build-start')
  assert.deepEqual(builds.map(event => event.destination), [`id=${f.phoneID}`, `id=${f.padID}`])
  for (const [index, build] of builds.entries()) {
    for (const [flag, value] of [
      ['-parallel-testing-enabled', 'NO'],
      ['-parallel-testing-worker-count', '1'],
      ['-maximum-concurrent-test-simulator-destinations', '1'],
    ])
      assert.equal(build.args[build.args.indexOf(flag) + 1], value)
    assert.equal(build.args[build.args.indexOf('-resultBundlePath') + 1], `build/${index === 0 ? 'iphone' : 'ipad'}.xcresult`)
  }
})

for (const initialState of ['Booted', 'Booting']) {
  test(`does not shut down a device already ${initialState} before the session`, { timeout: 10000 }, async (t) => {
    const f = await fixture(t, [device('iphone', initialState)])
    const result = await f.run().completed
    assert.equal(result.code, 0, result.stderr)
    const events = await f.events()
    assert.equal(calls(events, 'boot').length, 0)
    assert.equal(calls(events, 'shutdown').length, 0)
    assert.equal(calls(events, 'build-start').length, 1)
  })
}

test('test failure cleans up only the device this session booted', { timeout: 10000 }, async (t) => {
  const f = await fixture(t)
  const result = await f.run({ mode: 'fail' }).completed
  assert.notEqual(result.code, 0)
  const events = await f.events()
  assert.deepEqual(calls(events, 'shutdown').map(event => event.args[2]), [f.phoneID])
  assert.ok(events.findIndex(event => event.kind === 'build-exit') < events.findIndex(event => event.kind === 'shutdown'))
  const retry = await f.run().completed
  assert.equal(retry.code, 0, retry.stderr)
})

test('concurrent sessions cannot take over or shut down the same device', { timeout: 10000 }, async (t) => {
  const f = await fixture(t)
  const first = f.run({ mode: 'hold' })
  await waitFor(async () => calls(await f.events(), 'build-start').length === 1, 'first mock build')
  const second = await f.run().completed
  assert.notEqual(second.code, 0, second.stderr)
  const beforeRelease = await f.events()
  assert.equal(calls(beforeRelease, 'boot').length, 1)
  assert.equal(calls(beforeRelease, 'build-start').length, 1)
  assert.equal(calls(beforeRelease, 'shutdown').length, 0)
  await f.release()
  const firstResult = await first.completed
  assert.equal(firstResult.code, 0, firstResult.stderr)
  assert.equal(calls(await f.events(), 'shutdown').length, 1)
})

test('the same device stays locked when sessions have different TMPDIR values', { timeout: 10000 }, async (t) => {
  const f = await fixture(t)
  const firstTemporaryDirectory = path.join(f.directory, 'first-tmp')
  const secondTemporaryDirectory = path.join(f.directory, 'second-tmp')
  await mkdir(firstTemporaryDirectory)
  await mkdir(secondTemporaryDirectory)
  const first = f.run({ mode: 'hold', temporaryDirectory: firstTemporaryDirectory })
  await waitFor(async () => calls(await f.events(), 'build-start').length === 1, 'first mock build in its TMPDIR')
  const second = await f.run({ temporaryDirectory: secondTemporaryDirectory }).completed
  assert.notEqual(second.code, 0, second.stderr)
  const beforeRelease = await f.events()
  assert.equal(calls(beforeRelease, 'boot').length, 1)
  assert.equal(calls(beforeRelease, 'build-start').length, 1)
  assert.equal(calls(beforeRelease, 'shutdown').length, 0)
  await f.release()
  const firstResult = await first.completed
  assert.equal(firstResult.code, 0, firstResult.stderr)
  assert.deepEqual(calls(await f.events(), 'shutdown').map(event => event.args[2]), [f.phoneID])
})

test('SIGTERM waits for its mock build to exit before owned-device cleanup', { timeout: 10000 }, async (t) => {
  const f = await fixture(t)
  const child = f.run({ mode: 'hold' })
  await waitFor(async () => calls(await f.events(), 'build-start').length === 1, 'mock build to start')
  child.kill('SIGTERM') // Only this test's child process and fake tools are involved.
  const result = await child.completed
  assert.ok(result.code !== 0 || result.signal !== null)
  const events = await f.events()
  assert.equal(calls(events, 'build-signal').length, 1)
  assert.equal(calls(events, 'shutdown').length, 1)
  assert.ok(events.findIndex(event => event.kind === 'build-exit') < events.findIndex(event => event.kind === 'shutdown'))
  const retry = await f.run().completed
  assert.equal(retry.code, 0, retry.stderr)
})

test('missing, ambiguous, unavailable or wrong-tuple devices fail without booting', { timeout: 15000 }, async (t) => {
  const cases = [
    ['missing', []],
    ['ambiguous', [device('iphone'), { ...device('iphone'), udid: unrelatedID }]],
    ['wrong name', [{ ...device('iphone'), name: 'Cook iPhone' }]],
    ['wrong type', [{ ...device('iphone'), deviceTypeIdentifier: profile.devices.ipad.deviceTypeIdentifier }]],
    ['unavailable', [{ ...device('iphone'), isAvailable: false }]],
  ]
  for (const [name, devices] of cases) {
    await t.test(name, async (subtest) => {
      const f = await fixture(subtest, devices)
      const result = await f.run().completed
      assert.notEqual(result.code, 0, result.stderr)
      assertNoDeviceChanges(await f.events())
    })
  }
  await t.test('wrong runtime', async (subtest) => {
    const f = await fixture(subtest)
    await f.setState({ devices: { 'com.apple.CoreSimulator.SimRuntime.iOS-18-3': [device('iphone')] } })
    const result = await f.run().completed
    assert.notEqual(result.code, 0, result.stderr)
    assertNoDeviceChanges(await f.events())
  })
})

test('JSON primitive profiles never fall back to unpinned CI device selection', { timeout: 10000 }, async (t) => {
  for (const config of [null, false, 0, '']) {
    await t.test(JSON.stringify(config), async (subtest) => {
      const f = await fixture(subtest)
      await f.setConfig(config)
      const result = await f.run().completed
      assert.notEqual(result.code, 0, result.stderr)
      assertNoDeviceChanges(await f.events())
    })
  }
})

test('caller cannot override the selected destination or parallel-testing limits', { timeout: 15000 }, async (t) => {
  for (const args of [
    ['test', '-destination', `id=${unrelatedID}`],
    ['test', `-destination=id=${unrelatedID}`],
    ['test', '-parallel-testing-enabled', 'YES'],
    ['test', '-parallel-testing-worker-count', '2'],
    ['test', '-maximum-concurrent-test-simulator-destinations', '2'],
  ]) {
    await t.test(args[1], async (subtest) => {
      const f = await fixture(subtest)
      const result = await f.run({ args }).completed
      assert.notEqual(result.code, 0, result.stderr)
      assertNoDeviceChanges(await f.events())
    })
  }
})
