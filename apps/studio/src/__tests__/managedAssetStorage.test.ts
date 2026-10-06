import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { useManagedAssetStorage } from '../composables/useManagedAssetStorage'

vi.mock('../stores/useAuthStore', () => ({ useAuthStore: () => ({ isLoggedIn: true }) }))
vi.mock('../stores/useStudioStore', () => ({ useStudioStore: () => ({ currentProjectId: 'local' }) }))
vi.mock('../composables/useProjectContent', () => ({ useProjectContent: () => ({ getFs: () => null }) }))

// Local resource browsing must not require a configured cloud publishing service.
describe('optional managed asset publishing', () => {
  it('mounts offline and reports unavailable cloud publishing only when requested', async () => {
    let storage!: ReturnType<typeof useManagedAssetStorage>
    const wrapper = mount(defineComponent({
      setup() {
        storage = useManagedAssetStorage()
        return () => h('div', 'Local assets')
      },
    }))
    try {
      expect(wrapper.text()).toBe('Local assets')
      expect(storage.isPublishing('audio/local')).toBe(false)
      await expect(storage.publish('audio/local')).rejects.toThrow('Cloud publishing is not configured')
      expect(storage.publishing.value.size).toBe(0)
    }
    finally {
      wrapper.unmount()
    }
  })
})
