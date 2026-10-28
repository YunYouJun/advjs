import { resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

// Jobs that run only for relevant changes, and the studio-changes output that decides.
const conditional = {
  'studio-unit': 'studio',
  'studio-ios': 'native',
}

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
  for (const [name, job] of Object.entries(needs)) {
    let expected = 'success'
    if (Object.hasOwn(conditional, name)) {
      const flag = changes.outputs?.[conditional[name]]
      if (flag !== 'true' && flag !== 'false')
        throw new Error(`studio-changes must report ${conditional[name]}=true|false`)
      expected = flag === 'true' ? 'success' : 'skipped'
    }
    if (job?.result !== expected)
      failed.push(`${name}=${job?.result} (expected ${expected})`)
  }
  for (const name of Object.keys(conditional)) {
    if (!Object.hasOwn(needs, name))
      failed.push(`${name}=missing`)
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
