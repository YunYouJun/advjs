import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSound as useClientSound } from '../../packages/client/composables/sound'
import { useSound as useCoreSound } from '../../packages/core/src/composables/sound'

describe('useSound', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('can initialize in a store without requiring a component lifecycle', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})

    useClientSound('')
    useCoreSound('')

    expect(warning).not.toHaveBeenCalled()
  })
})
