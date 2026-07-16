import type {
  JsonObject,
  RuntimeAddress,
  RuntimeChoiceRecord,
  RuntimeProgram,
  RuntimeState,
  RuntimeUpdate,
} from '@advjs/types'
import { RUNTIME_SCHEMA_VERSION } from '@advjs/types'
import { describe, expect, expectTypeOf, it } from 'vitest'

describe('runtime contracts', () => {
  it('exposes versioned JSON-only program and state shapes', () => {
    expect(RUNTIME_SCHEMA_VERSION).toBe(1)
    expectTypeOf<RuntimeProgram['schemaVersion']>().toEqualTypeOf<1>()
    expectTypeOf<RuntimeProgram['entry']>().toEqualTypeOf<RuntimeAddress>()
    expectTypeOf<RuntimeState['variables']>().toEqualTypeOf<JsonObject>()
    expectTypeOf<RuntimeState['choices']>().toEqualTypeOf<RuntimeChoiceRecord[]>()
    expectTypeOf<RuntimeUpdate['effects']>().toBeArray()
  })
})
