import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import process from 'node:process'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { affectsDesktopPackage } from '../../../scripts/ci/desktop-changes.mjs'
import { assertDesktopChecks } from '../../../scripts/ci/desktop-required.mjs'

function results(event, packageChanged = 'true') {
  return {
    build: { result: 'success', outputs: { package: packageChanged } },
    'linux-package': { result: event !== 'workflow_dispatch' && packageChanged === 'true' ? 'success' : 'skipped' },
    'full-matrix': { result: event === 'workflow_dispatch' ? 'success' : 'skipped' },
  }
}

for (const event of ['pull_request', 'push', 'workflow_dispatch']) {
  for (const packageChanged of ['true', 'false']) {
    test(`${event}, package=${packageChanged}: requires exactly the applicable jobs`, () => {
      const needs = results(event, packageChanged)
      assert.doesNotThrow(() => assertDesktopChecks({ event, needs }))
      for (const name of Object.keys(needs)) {
        for (const result of ['success', 'skipped', 'failure', 'cancelled', 'neutral', 'timed_out', '', undefined]) {
          if (result === needs[name].result)
            continue
          assert.throws(() => assertDesktopChecks({ event, needs: { ...needs, [name]: { ...needs[name], result } } }), /expected/)
        }
      }
    })
  }
}

test('missing or malformed dependency results fail closed', () => {
  const event = 'pull_request'
  const needs = results(event)
  for (const invalid of [undefined, null, [], {}, 'success'])
    assert.throws(() => assertDesktopChecks({ event, needs: invalid }), /requires results/)
  for (const name of Object.keys(needs)) {
    const missing = { ...needs }
    delete missing[name]
    assert.throws(() => assertDesktopChecks({ event, needs: missing }), /requires results/)
    for (const invalid of [undefined, null, {}, 'success'])
      assert.throws(() => assertDesktopChecks({ event, needs: { ...needs, [name]: invalid } }), /expected/)
  }
  assert.throws(() => assertDesktopChecks({ event, needs: { ...needs, unverified: { result: 'failure' } } }), /requires results/)
})

test('missing or non-boolean-string package outputs fail for every event', () => {
  for (const event of ['pull_request', 'push', 'workflow_dispatch']) {
    for (const output of [undefined, null, '', true, false, 'TRUE', ' false', 'false\n', 0, '0']) {
      const needs = results(event)
      needs.build.outputs.package = output
      assert.throws(() => assertDesktopChecks({ event, needs }), /true\/false/)
    }
    const needs = results(event)
    delete needs.build.outputs
    assert.throws(() => assertDesktopChecks({ event, needs }), /true\/false/)
  }
})

test('unknown and missing events fail even when all jobs succeed', () => {
  for (const event of [undefined, null, '', 'workflow_call', 'pull_request_target', 'merge_group'])
    assert.throws(() => assertDesktopChecks({ event, needs: results('pull_request') }), /Unsupported desktop CI event/)
})

test('gate CLI returns nonzero without a misleading success message on invalid inputs', () => {
  const script = fileURLToPath(new URL('../../../scripts/ci/desktop-required.mjs', import.meta.url))
  const valid = JSON.stringify(results('pull_request'))
  const failed = results('pull_request')
  failed['linux-package'].result = 'failure'
  for (const [event, json, status] of [
    ['pull_request', valid, 0],
    ['push', JSON.stringify(results('push', 'false')), 0],
    ['workflow_dispatch', JSON.stringify(results('workflow_dispatch')), 0],
    ['pull_request', JSON.stringify(failed), 1],
    ['pull_request', '{}', 1],
    ['pull_request', 'null', 1],
    ['pull_request', '{', 1],
    ['pull_request', '', 1],
    ['', valid, 1],
  ]) {
    const child = spawnSync(process.execPath, [script], {
      env: { ...process.env, DESKTOP_EVENT: event, NEEDS_JSON: json },
      encoding: 'utf8',
      timeout: 10000,
    })
    assert.ifError(child.error)
    assert.equal(child.status, status, child.stderr)
    assert.equal(child.stdout.includes('All required desktop checks passed'), status === 0)
    assert.equal(child.stderr.includes('Required desktop checks failed'), status !== 0)
  }
})

test('changes to the gate and its tests require package validation', () => {
  for (const path of ['scripts/ci/desktop-required.mjs', 'apps/desktop/scripts/desktop-required.test.mjs', 'tests/unit/desktop/desktop-ci.test.ts'])
    assert.equal(affectsDesktopPackage(path), true)
})
