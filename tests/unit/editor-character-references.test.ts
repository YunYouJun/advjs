import type { ProjectWorkspace } from '../../editor/core/app/workspaces/project'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef } from 'vue'
import { useCharacterVisualReferences } from '../../editor/core/app/composables/useCharacterVisualReferences'

afterEach(() => vi.unstubAllGlobals())

describe('character reference previews', () => {
  it('discards late images after a project switch and releases URLs on disposal', async () => {
    const createObjectURL = vi.fn(() => 'blob:current')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    let resolveOld!: (blob: Blob) => void
    const oldImage = new Promise<Blob>((resolve) => {
      resolveOld = resolve
    })
    const workspace = shallowRef({ readAsset: () => oldImage } as ProjectWorkspace)
    const scope = effectScope()
    const state = scope.run(() => useCharacterVisualReferences(() => [{ path: 'art/hero.png' }], () => workspace.value))!
    workspace.value = { readAsset: async () => new Blob(['new']) } as ProjectWorkspace
    await nextTick()
    await vi.waitFor(() => expect(state.previews.value[0]?.src).toBe('blob:current'))
    resolveOld(new Blob(['old']))
    await nextTick()
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    scope.stop()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:current')
  })

  it('keeps the reference description when an image is missing', async () => {
    const scope = effectScope()
    const workspace = {
      readAsset: async () => {
        throw new Error('Image missing')
      },
    } as unknown as ProjectWorkspace
    const state = scope.run(() => useCharacterVisualReferences(() => [{ path: 'missing.png', description: 'Right figure' }], () => workspace))!
    await vi.waitFor(() => expect(state.previews.value[0]?.error).toBe('Image missing'))
    expect(state.previews.value[0]?.description).toBe('Right figure')
    scope.stop()
  })
})
