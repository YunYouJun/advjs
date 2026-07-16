// @vitest-environment node

import type { RuntimeEffect, RuntimeSnapshot } from '@advjs/types'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RuntimeCliPlayer } from '../../packages/advjs/node/runtime/player'
import { createAdvRuntimeHost } from '../../packages/client/composables/useAdvRuntime'
import { compileMarkdownProgram, createAdvRuntime } from '../../packages/core/src'

interface HostAdapter {
  start: () => Promise<unknown>
  next: () => Promise<unknown>
  chooseFirst: () => Promise<unknown>
  back: () => unknown
  snapshot: () => RuntimeSnapshot
  restore: (snapshot: RuntimeSnapshot) => unknown
  effects: string[]
}

function clock(): () => number {
  let value = 100
  return () => value++
}

function normalized(snapshot: RuntimeSnapshot): RuntimeSnapshot {
  const cloned = JSON.parse(JSON.stringify(snapshot)) as RuntimeSnapshot
  cloned.createdAt = 0
  return cloned
}

async function exercise(host: HostAdapter) {
  await host.start()
  await host.next()
  await host.chooseFirst()
  await host.next()
  const local = normalized(host.snapshot())
  await host.chooseFirst()
  const crossed = normalized(host.snapshot())
  host.back()
  const backed = normalized(host.snapshot())
  host.restore(local)
  const restored = normalized(host.snapshot())
  return { local, crossed, backed, restored, effects: host.effects }
}

describe('runtime host conformance', () => {
  it('keeps core, Vue, and CLI semantics identical for navigation and saves', async () => {
    const fixtureRoot = join(import.meta.dirname, '../fixtures/runtime')
    const compiled = await compileMarkdownProgram({
      id: 'host-conformance',
      chapters: [
        {
          id: 'chapter-1',
          sourcePath: join(fixtureRoot, 'navigation.adv.md'),
          content: readFileSync(join(fixtureRoot, 'navigation.adv.md'), 'utf8'),
        },
        {
          id: 'chapter-2',
          sourcePath: join(fixtureRoot, 'navigation-result.adv.md'),
          content: readFileSync(join(fixtureRoot, 'navigation-result.adv.md'), 'utf8'),
        },
      ],
    })
    expect(compiled.diagnostics).toEqual([])
    const program = compiled.program!

    const coreEffects: string[] = []
    const core = createAdvRuntime({ program, now: clock() })
    core.subscribe((_state, effects) => coreEffects.push(...effects.map(effect => effect.type)))
    const coreResult = await exercise({
      start: core.start,
      next: core.next,
      chooseFirst: () => core.choose('choice-1'),
      back: core.back,
      snapshot: core.snapshot,
      restore: core.restore,
      effects: coreEffects,
    })

    const vueEffects: string[] = []
    const vue = createAdvRuntimeHost({
      program,
      now: clock(),
      onEffects: effects => vueEffects.push(...effects.map(effect => effect.type)),
    })
    const vueResult = await exercise({
      start: vue.start,
      next: vue.next,
      chooseFirst: () => vue.choose('choice-1'),
      back: vue.back,
      snapshot: vue.snapshot,
      restore: vue.restore,
      effects: vueEffects,
    })

    const cliEffects: string[] = []
    const cli = new RuntimeCliPlayer({
      program,
      now: clock(),
      trace: trace => cliEffects.push(...trace.effects.map((effect: RuntimeEffect) => effect.type)),
    })
    const cliResult = await exercise({
      start: () => cli.start(),
      next: () => cli.next(),
      chooseFirst: () => cli.choose(1),
      back: () => cli.back(),
      snapshot: () => cli.snapshot(),
      restore: snapshot => cli.restore(snapshot),
      effects: cliEffects,
    })

    expect(vueResult).toEqual(coreResult)
    expect(cliResult).toEqual(coreResult)
    expect(coreResult.crossed.state.cursor).toEqual({
      chapterId: 'chapter-2',
      nodeId: 'node-1',
    })
    expect(coreResult.backed.state).toEqual(coreResult.local.state)
    expect(coreResult.restored).toEqual(coreResult.local)
  })
})
