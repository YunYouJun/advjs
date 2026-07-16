import type { RuntimeUpdate } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import { createAdvRuntime } from '../../src/runtime'
import { runtimeConformanceProgram } from '../fixtures/runtime-program'

function jsonRoundTrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

async function traceRuntime(): Promise<RuntimeUpdate[]> {
  const runtime = createAdvRuntime({ program: runtimeConformanceProgram })
  return [
    await runtime.start(),
    await runtime.next(),
    await runtime.choose('observe'),
  ]
}

describe('runtime conformance baseline', () => {
  it('produces identical JSON traces for independent runtime instances', async () => {
    const firstTrace = jsonRoundTrip(await traceRuntime())
    const secondTrace = jsonRoundTrip(await traceRuntime())

    expect(firstTrace).toEqual(secondTrace)
    expect(firstTrace.at(-1)?.state.status).toBe('ended')
  })
})
