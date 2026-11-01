#!/usr/bin/env node
/**
 * Read-only destination diagnostics: local profile, or deterministic existing
 * devices on the newest runtime when CI=true. Tests use simulator-session.mjs.
 *
 * Usage:
 *   node apps/studio-ios/scripts/simulator-destinations.mjs
 *   node apps/studio-ios/scripts/simulator-destinations.mjs --only iphone   # or ipad
 * This selector is read-only. Use simulator-session.mjs for managed tests.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

export function selectDevices(devices, only = 'both', profile) {
  const families = only === 'both' ? ['iphone', 'ipad'] : [only]
  if (!['both', 'iphone', 'ipad'].includes(only))
    throw new Error('--only takes iphone, ipad or both')

  if (profile !== undefined) {
    if (!profile || typeof profile !== 'object' || Array.isArray(profile))
      throw new Error('A local profile must be an object; refusing unpinned device selection')
    if (!/^com\.apple\.CoreSimulator\.SimRuntime\.iOS-\d+-\d+(?:-\d+)?$/u.test(profile.runtime))
      throw new Error('The profile must pin an iOS runtime identifier')
    return families.map((family) => {
      const spec = profile.devices?.[family]
      if (!spec?.name || !spec.deviceTypeIdentifier?.includes(family === 'iphone' ? '.iPhone-' : '.iPad-'))
        throw new Error(`The profile must pin the ${family} name and device type`)
      const matches = (devices[profile.runtime] || []).filter(device => device.isAvailable !== false
        && device.name === spec.name && device.deviceTypeIdentifier === spec.deviceTypeIdentifier)
      if (matches.length !== 1)
        throw new Error(`Expected exactly one ${spec.name} on ${profile.runtime} (${spec.deviceTypeIdentifier}); found ${matches.length}. No device was created. Review the profile and existing devices.`)
      return { ...matches[0], family, runtime: profile.runtime }
    })
  }

  const runtimes = Object.keys(devices)
    .map(runtime => ({ runtime, version: /iOS-(\d+)-(\d+)(?:-(\d+))?$/u.exec(runtime) }))
    .filter(item => item.version)
    .sort((a, b) => Number(b.version[1]) - Number(a.version[1]) || Number(b.version[2]) - Number(a.version[2]) || Number(b.version[3] || 0) - Number(a.version[3] || 0))
  for (const { runtime } of runtimes) {
    const available = devices[runtime].filter(device => device.isAvailable !== false)
      .sort((a, b) => a.name.localeCompare(b.name) || a.udid.localeCompare(b.udid))
    const chosen = families.map((family) => {
      const prefix = family === 'iphone' ? '.iPhone-' : '.iPad-'
      const device = available.find(device => device.deviceTypeIdentifier?.includes(prefix))
      return device && { ...device, family, runtime }
    })
    if (chosen.every(Boolean))
      return chosen
  }
  throw new Error('No available iOS runtime has the requested existing devices')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2)
    if (args.includes('--boot'))
      throw new Error('--boot was removed: use simulator-session.mjs to lock, run and clean up owned boots')
    const only = args.length === 0 ? 'both' : args.length === 2 && args[0] === '--only' ? args[1] : undefined
    if (!only)
      throw new Error('Usage: simulator-destinations.mjs [--only iphone|ipad|both]')
    const { devices } = JSON.parse(execFileSync('xcrun', ['simctl', 'list', 'devices', 'available', '-j'], { encoding: 'utf8' }))
    const profile = process.env.CI === 'true' ? undefined : JSON.parse(readFileSync(new URL('./simulator-profile.json', import.meta.url), 'utf8'))
    const chosen = selectDevices(devices, only, profile)
    process.stderr.write(`Using ${chosen.map(device => device.name).join(' and ')} (${chosen[0].runtime}); selection only, no lifecycle management\n`)
    process.stdout.write(chosen.map(device => `-destination id=${device.udid}`).join(' '))
  }
  catch (error) {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  }
}
