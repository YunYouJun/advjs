import assert from 'node:assert/strict'
import { parse } from 'yaml'

export function assertPublicLockfile(source) {
  function visit(value) {
    if (typeof value === 'string') {
      assert(!/^(?:file|link|workspace):/u.test(value), 'Consumer has a local dependency override')
    }
    else if (value && typeof value === 'object') {
      assert(!value.resolution?.directory && value.resolution?.type !== 'directory', 'Consumer has a local dependency resolution')
      for (const child of Object.values(value))
        visit(child)
    }
  }
  visit(parse(source))
}
