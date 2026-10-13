import assert from 'node:assert/strict'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

/**
 * Validate desktop checks, allowing skips only for intentionally unused packaging jobs.
 * @param needs - GitHub Actions dependency results and build outputs.
 * @param event - GitHub Actions event name.
 */
export function assertDesktopChecks(needs, event) {
  assert.equal(needs.build?.result, 'success', 'Desktop build must succeed')
  assert.ok(['true', 'false'].includes(needs.build.outputs?.package), 'Desktop packaging decision must be explicit')
  const manual = event === 'workflow_dispatch'
  const packageRequired = !manual && needs.build.outputs?.package === 'true'
  assert.equal(needs['linux-package']?.result, packageRequired ? 'success' : 'skipped', 'Unexpected Linux package result')
  assert.equal(needs['full-matrix']?.result, manual ? 'success' : 'skipped', 'Unexpected desktop matrix result')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assertDesktopChecks(JSON.parse(process.env.NEEDS_JSON), process.env.DESKTOP_EVENT)
  console.log('All required desktop checks passed')
}
