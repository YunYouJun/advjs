// @vitest-environment node

import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const set = require('lodash.set') as (object: object, path: string, value: unknown) => object

describe('patched dependency security', () => {
  it.each([
    '__proto__.advjsPolluted',
    'constructor.prototype.advjsPolluted',
    'prototype.advjsPolluted',
  ])('rejects the unsafe lodash.set path %s', (path) => {
    const target = {}
    expect(set(target, path, true)).toBe(target)
    expect((Object.prototype as Record<string, unknown>).advjsPolluted).toBeUndefined()
    expect((target as Record<string, unknown>).advjsPolluted).toBeUndefined()
  })

  it('preserves normal nested assignment', () => {
    const target = {}
    set(target, 'audio.bgm.volume', 0.8)
    expect(target).toEqual({ audio: { bgm: { volume: 0.8 } } })
  })
})
