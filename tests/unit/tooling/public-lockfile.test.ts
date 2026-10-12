// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { assertPublicLockfile } from '../../../scripts/release/public-lockfile.mjs'

describe('public consumer lockfile', () => {
  it('accepts registry package names ending in file', () => {
    expect(() => assertPublicLockfile(`
snapshots:
  yargs@17.7.2:
    dependencies:
      get-caller-file: 2.0.5
`)).not.toThrow()
  })

  it.each(['file:../package', 'link:../package', 'workspace:*'])('rejects a local dependency: %s', (version) => {
    expect(() => assertPublicLockfile(`
importers:
  .:
    dependencies:
      advjs:
        version: ${version}
`)).toThrow('Consumer has a local dependency override')
  })

  it('rejects a directory resolution', () => {
    expect(() => assertPublicLockfile(`
packages:
  advjs:
    resolution:
      directory: ../package
      type: directory
`)).toThrow('Consumer has a local dependency resolution')
  })
})
