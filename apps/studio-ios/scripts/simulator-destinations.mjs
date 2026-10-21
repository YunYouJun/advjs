#!/usr/bin/env node
/**
 * Print `xcodebuild -destination` arguments for one iPhone and one iPad on the
 * newest installed iOS simulator runtime. CI images change device names
 * between Xcode releases, so tests pick devices instead of hard-coding them.
 *
 * Usage: xcodebuild test $(node apps/studio-ios/scripts/simulator-destinations.mjs) ...
 */
import { execFileSync } from 'node:child_process'
import process from 'node:process'

const { devices } = JSON.parse(execFileSync('xcrun', ['simctl', 'list', 'devices', 'available', '-j'], { encoding: 'utf8' }))
const runtimes = Object.keys(devices)
  .map(runtime => ({ runtime, version: /iOS-(\d+)-(\d+)/u.exec(runtime) }))
  .filter(item => item.version)
  .sort((left, right) => Number(right.version[1]) - Number(left.version[1]) || Number(right.version[2]) - Number(left.version[2]))

for (const { runtime } of runtimes) {
  const available = devices[runtime]
  const iPhone = available.find(device => device.deviceTypeIdentifier.includes('.iPhone-'))
  const iPad = available.find(device => device.deviceTypeIdentifier.includes('.iPad-'))
  if (iPhone && iPad) {
    process.stderr.write(`Using ${iPhone.name} and ${iPad.name} (${runtime})\n`)
    process.stdout.write(`-destination id=${iPhone.udid} -destination id=${iPad.udid}`)
    process.exit(0)
  }
}
process.stderr.write('No iOS runtime has both an iPhone and an iPad simulator\n')
process.exit(1)
