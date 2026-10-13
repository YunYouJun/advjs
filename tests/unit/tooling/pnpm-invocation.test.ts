// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { resolvePnpmInvocation } from '../../../scripts/release/run-command.mjs'

describe('pnpm process invocation', () => {
  it.each([
    '/home/runner/setup-pnpm/node_modules/.bin/bin/pnpm',
    'C:\\tools\\pnpm.cmd',
  ])('executes a command shim through pnpm: %s', (npmExecPath) => {
    const args = ['run', 'preview', '--host', '127.0.0.1', '--port', '0']
    expect(resolvePnpmInvocation(args, { execPath: '/node', npmExecPath })).toEqual({
      command: 'pnpm',
      args,
    })
  })

  it('runs a JavaScript CLI with the current Node executable', () => {
    expect(resolvePnpmInvocation(['--version'], {
      execPath: '/node',
      npmExecPath: '/tools/pnpm/bin/pnpm.cjs',
    })).toEqual({
      command: '/node',
      args: ['/tools/pnpm/bin/pnpm.cjs', '--version'],
    })
  })
})
