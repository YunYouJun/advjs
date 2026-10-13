import { resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

export function assertDesktopChecks({ event, needs }) {
  if (!['pull_request', 'push', 'workflow_dispatch'].includes(event))
    throw new Error(`Unsupported desktop CI event: ${event}`)

  const jobs = ['build', 'linux-package', 'full-matrix']
  if (!needs || typeof needs !== 'object' || Array.isArray(needs)
    || Object.keys(needs).length !== jobs.length
    || jobs.some(name => !Object.hasOwn(needs, name)))
    throw new Error(`Desktop CI requires results for exactly: ${jobs.join(', ')}`)

  if (needs.build?.result !== 'success')
    throw new Error(`build=${needs.build?.result}; expected success`)
  const packageChanged = needs.build.outputs?.package
  if (packageChanged !== 'true' && packageChanged !== 'false')
    throw new Error('Desktop CI requires a true/false build.outputs.package value')

  // Dispatch always requires the full matrix, independently of the change flag.
  // A skipped job is valid only when its existing workflow condition excludes it.
  const expected = {
    'linux-package': event !== 'workflow_dispatch' && packageChanged === 'true' ? 'success' : 'skipped',
    'full-matrix': event === 'workflow_dispatch' ? 'success' : 'skipped',
  }
  for (const [name, result] of Object.entries(expected)) {
    if (needs[name]?.result !== result)
      throw new Error(`${name}=${needs[name]?.result}; expected ${result}`)
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    assertDesktopChecks({ event: process.env.DESKTOP_EVENT, needs: JSON.parse(process.env.NEEDS_JSON || '') })
    process.stdout.write('All required desktop checks passed\n')
  }
  catch (error) {
    process.stderr.write(`Required desktop checks failed: ${error.message}\n`)
    process.exitCode = 1
  }
}
