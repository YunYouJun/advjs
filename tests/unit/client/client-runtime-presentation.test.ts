import type { AdvGameConfig, RuntimeState } from '@advjs/types'
import type { AdvPresentationResources } from '../../../packages/client/runtime/effects'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { applyRuntimePresentationEffects } from '../../../packages/client/runtime/effects'

function resources(): AdvPresentationResources {
  return {
    charactersMap: new Map(),
    tachiesMapRef: ref(new Map()),
    backgroundCueRef: ref(),
    cgCueRef: ref(),
    transitionCueRef: ref(),
    tachieCueRef: ref(),
  }
}

const state: RuntimeState = {
  status: 'playing',
  cursor: { chapterId: 'one', nodeId: 'line' },
  variables: {},
  stage: {
    background: 'night',
    audio: { bgm: { assetId: 'theme' }, ambience: {} },
    cg: 'memory',
    tachies: { hero: { status: 'smile' } },
  },
  choices: [],
  visited: [],
}

describe('runtime presentation history synchronization', () => {
  it('restores final stage state without replaying authored cues', () => {
    const presentation = resources()
    const gallery = { unlock: vi.fn() }

    applyRuntimePresentationEffects(
      [{ type: 'runtime.back' }],
      state,
      presentation,
      { characters: [] } as unknown as AdvGameConfig,
      gallery as never,
    )

    expect(presentation.backgroundCueRef.value?.value).toEqual({ url: 'night', transition: 'cut' })
    expect(presentation.cgCueRef.value?.value).toEqual({
      id: 'memory',
      action: 'show',
      unlock: false,
      transition: 'cut',
    })
    expect(presentation.transitionCueRef.value?.value).toEqual({ name: 'cut', duration: 0 })
    expect(presentation.tachieCueRef.value?.value).toMatchObject({ instant: true })
    expect(gallery.unlock).not.toHaveBeenCalled()
  })
})
