// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { assertPublicLockfile } from '../../../scripts/release/public-lockfile.mjs'

describe('public consumer lockfile', () => {
  it('accepts pnpm 12 lockfiles containing multiple YAML documents', () => {
    expect(() => assertPublicLockfile(`
lockfileVersion: '9.0'
tools: {}
---
lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      advjs:
        version: 0.1.4
`)).not.toThrow()
  })

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

  it.each(['file:../package', 'link:../package', 'workspace:*'])('rejects a local dependency in a later document: %s', (version) => {
    expect(() => assertPublicLockfile(`
lockfileVersion: '9.0'
---
importers:
  .:
    dependencies:
      advjs:
        version: ${version}
`)).toThrow('Consumer has a local dependency override')
  })

  it('rejects a directory resolution in a later document', () => {
    expect(() => assertPublicLockfile(`
lockfileVersion: '9.0'
---
packages:
  advjs:
    resolution:
      directory: ../package
      type: directory
`)).toThrow('Consumer has a local dependency resolution')
  })

  it('rejects malformed YAML in a later document', () => {
    expect(() => assertPublicLockfile('lockfileVersion: \'9.0\'\n---\npackages: [')).toThrow()
  })
})
