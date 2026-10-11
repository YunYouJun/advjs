import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CharacterAvatarPanel from '../../../editor/core/app/components/character/CharacterAvatarPanel.vue'
import CharacterVisualPanel from '../../../editor/core/app/components/character/CharacterVisualPanel.vue'

vi.mock('@advjs/gui', () => ({ Toast: vi.fn() }))
afterEach(() => vi.unstubAllGlobals())

const character = {
  id: 'hero',
  name: 'Hero',
  visual: { version: 'v1', references: [{ path: 'art/ref.webp', description: 'Front view' }], fixedTraits: ['Blue eyes'], allowedChanges: ['Pose'] },
  avatars: { thoughtful: { src: 'art/thoughtful.webp', label: 'Thinking' } },
}

describe('character authoring panels', () => {
  it('shows visual constraints and portrait states through the current workspace', async () => {
    let sequence = 0
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => `blob:preview-${++sequence}`), revokeObjectURL: vi.fn() }))
    vi.stubGlobal('useProjectStore', () => ({ resourceRevision: 0, workspace: { readAsset: vi.fn(async () => new Blob(['image'])) } }))
    vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }))
    const global = { mocks: { $t: (key: string) => key }, stubs: { AGUIButton: { template: '<button><slot /></button>' }, AGUIDetails: { template: '<details><slot /></details>' } } }
    const visual = mount(CharacterVisualPanel, { props: { character }, global })
    const avatars = mount(CharacterAvatarPanel, { props: { character }, global })
    await flushPromises()
    expect(visual.text()).toContain('Blue eyes')
    expect(visual.text()).toContain('Pose')
    expect(visual.get('img').attributes('alt')).toBe('Front view')
    expect(avatars.text()).toContain('thoughtful')
    expect(avatars.get('img').attributes('alt')).toBe('Hero · Thinking')
    visual.unmount()
    avatars.unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
  })
})
