#!/usr/bin/env node
/**
 * Print `xcodebuild -destination` arguments for one iPhone and one iPad on the
 * newest installed iOS simulator runtime. CI images change device names
 * between Xcode releases, so tests pick devices instead of hard-coding them.
 *
 * Usage:
 *   xcodebuild test $(node apps/studio-ios/scripts/simulator-destinations.mjs) ...
 *   node apps/studio-ios/scripts/simulator-destinations.mjs --only iphone   # or ipad
 *   node apps/studio-ios/scripts/simulator-destinations.mjs --boot          # start booting both, return at once
 */
import { execFileSync, spawn } from 'node:child_process'
import process from 'node:process'

const args = process.argv.slice(2)
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : undefined
if (only !== undefined && only !== 'iphone' && only !== 'ipad') {
  process.stderr.write('--only takes iphone or ipad\n')
  process.exit(2)
}

const { devices } = JSON.parse(execFileSync('xcrun', ['simctl', 'list', 'devices', 'available', '-j'], { encoding: 'utf8' }))
const runtimes = Object.keys(devices)
  .map(runtime => ({ runtime, version: /iOS-(\d+)-(\d+)/u.exec(runtime) }))
  .filter(item => item.version)
  .sort((left, right) => Number(right.version[1]) - Number(left.version[1]) || Number(right.version[2]) - Number(left.version[2]))

for (const { runtime } of runtimes) {
  const available = devices[runtime]
  const iPhone = available.find(device => device.deviceTypeIdentifier.includes('.iPhone-'))
  const iPad = available.find(device => device.deviceTypeIdentifier.includes('.iPad-'))
  if (!iPhone || !iPad)
    continue
  const chosen = only === 'iphone' ? [iPhone] : only === 'ipad' ? [iPad] : [iPhone, iPad]
  process.stderr.write(`Using ${chosen.map(device => device.name).join(' and ')} (${runtime})\n`)
  if (args.includes('--boot')) {
    // Booting takes minutes on CI; let it overlap with dependency installation.
    // xcodebuild waits for a device that is still booting.
    for (const device of chosen)
      spawn('xcrun', ['simctl', 'bootstatus', device.udid, '-b'], { detached: true, stdio: 'ignore' }).unref()
  }
  else {
    process.stdout.write(chosen.map(device => `-destination id=${device.udid}`).join(' '))
  }
  process.exit(0)
}
process.stderr.write('No iOS runtime has both an iPhone and an iPad simulator\n')
process.exit(1)
