import { resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

// null means unconditional; other values name a studio-changes output.
export const LAUNCH_CHECKS = Object.freeze({
  'quality': null,
  'studio-changes': null,
  'studio-pages-build': 'studio',
  'studio-unit': 'studio',
  'studio-ios': 'native',
  'vrm-pages-build': null,
  'platform-smoke': null,
  'browser': null,
  'agent-install-smoke': null,
})

/**
 * Every launch check must succeed. A conditional job may be skipped only when
 * studio-changes succeeded and reported that the change does not need it.
 */
export function assertLaunchChecks(needs) {
  if (!needs || typeof needs !== 'object' || Array.isArray(needs))
    throw new Error('Launch checks require the needs context')
  const changes = needs['studio-changes']
  if (changes?.result !== 'success')
    throw new Error(`studio-changes=${changes?.result}; expected success`)
  const failed = []
  for (const [name, scope] of Object.entries(LAUNCH_CHECKS)) {
    if (!Object.hasOwn(needs, name)) {
      failed.push(`${name}=missing`)
      continue
    }
    let expected = 'success'
    if (scope) {
      const flag = changes.outputs?.[scope]
      if (flag !== 'true' && flag !== 'false')
        throw new Error(`studio-changes must report ${scope}=true|false`)
      expected = flag === 'true' ? 'success' : 'skipped'
    }
    const job = needs[name]
    if (job?.result !== expected)
      failed.push(`${name}=${job?.result} (expected ${expected})`)
  }
  for (const name of Object.keys(needs)) {
    if (!Object.hasOwn(LAUNCH_CHECKS, name))
      failed.push(`${name}=unknown`)
  }
  if (failed.length > 0)
    throw new Error(failed.join(', '))
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    assertLaunchChecks(JSON.parse(process.env.NEEDS_JSON || ''))
    process.stdout.write('All required launch checks passed\n')
  }
  catch (error) {
    process.stderr.write(`Required launch checks failed: ${error.message}\n`)
    process.exitCode = 1
  }
}
