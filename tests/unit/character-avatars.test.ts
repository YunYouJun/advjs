import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import AdvAvatarImage from '../../packages/client/components/adv/AdvAvatarImage.vue'
import { compileFlowProgram, compileMarkdownProgram } from '../../packages/core/src/compiler'
import { compileProject } from '../../packages/core/src/project/compile'
import { applyProjectPatches } from '../../packages/core/src/project/serialize'
import { resolveCharacterAvatar } from '../../packages/core/src/utils/character-avatar'
import { exportCharacterForAI, parseCharacterMd, stringifyCharacterMd } from '../../packages/parser/src/character'

const card = `---
id: hero
name: Hero
avatar: art/default.webp
avatars:
  thoughtful:
    src: art/thoughtful.webp
    label: 凝神思索
---

## 背景

An existing character.
`

describe('character portrait expressions', () => {
  it('preserves character associations through parsing, source edits and serialization', () => {
    const original = parseCharacterMd(card)
    expect(parseCharacterMd(stringifyCharacterMd(original))).toEqual(original)
    const context = exportCharacterForAI(original)
    expect(context).toContain('**thoughtful**: 凝神思索')
    expect(context).not.toContain('art/thoughtful.webp')
    const path = 'adv/characters/hero.character.md'
    const updated = applyProjectPatches({ [path]: card }, [{ kind: 'frontmatter-set', path, key: 'avatars', value: {
      resolved: { src: 'art/resolved.webp', label: '坚定决断' },
    } }]).files[path]
    expect(parseCharacterMd(updated)).toMatchObject({
      id: 'hero',
      avatar: 'art/default.webp',
      avatars: { resolved: { src: 'art/resolved.webp' } },
      background: 'An existing character.',
    })
  })

  it('uses the authored dialogue state and falls back without leaking another character state', async () => {
    const character = parseCharacterMd(card)
    const result = await compileMarkdownProgram({ id: 'portraits', chapters: [{ id: 'one', content: '@Hero(thoughtful)\nThink.\n\n@Hero\nListen.' }] })
    const nodes = Object.values(result.program!.chapters.one.nodes).filter(node => node.kind === 'dialog')
    expect(resolveCharacterAvatar(character, String(nodes[0].data?.status))).toMatchObject({ src: 'art/thoughtful.webp', label: '凝神思索', status: 'thoughtful' })
    expect(resolveCharacterAvatar(character, String(nodes[1].data?.status))).toMatchObject({ src: 'art/default.webp', status: 'default' })
    expect(resolveCharacterAvatar(character, 'unknown').src).toBe('art/default.webp')
    expect(resolveCharacterAvatar(character, '__proto__').src).toBe('art/default.webp')
    expect(resolveCharacterAvatar({ id: 'no-portrait' }, 'thoughtful').src).toBeUndefined()
    expect(resolveCharacterAvatar({ id: 'variant-only', avatars: { default: { src: 'default.webp' } } }).src).toBe('default.webp')
  })

  it('recovers from image failures, avoids retry loops and resets on a new portrait', async () => {
    const wrapper = mount(AdvAvatarImage, { props: { src: 'alert.webp', fallbackSrc: 'default.webp', alt: 'Hero' } })
    await wrapper.get('img').trigger('error')
    expect(wrapper.get('img').attributes('src')).toBe('default.webp')
    expect(wrapper.get('img').attributes('data-avatar-fallback')).toBe('true')
    await wrapper.get('img').trigger('error')
    expect(wrapper.find('img').exists()).toBe(false)
    await wrapper.setProps({ src: 'thoughtful.webp' })
    expect(wrapper.get('img').attributes('src')).toBe('thoughtful.webp')
    expect(wrapper.get('img').attributes('alt')).toBe('Hero')
    wrapper.unmount()
  })

  it('rejects malformed portrait mappings before project playback', async () => {
    const path = 'adv/characters/hero.character.md'
    const files = {
      'adv.config.json': JSON.stringify({ format: 'adv-md', root: 'adv' }),
      'adv/chapters/start.adv.md': '@Hero(thoughtful)\nThink.\n',
      [path]: card,
    }
    const valid = await compileProject({ files })
    expect(valid.project.characters[0].avatars).toEqual(parseCharacterMd(card).avatars)
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const invalid = await compileProject({ files: { ...files, [path]: card.replace('src: art/thoughtful.webp', 'src: 123') } })
      expect(invalid.diagnostics).toContainEqual(expect.objectContaining({ code: 'ADV_PROJECT_INVALID_CHARACTER_AVATARS', severity: 'error', path }))
    }
    finally {
      warning.mockRestore()
    }
  })

  it('carries explicit expressions from flow dialogues without changing legacy nodes', async () => {
    const result = await compileFlowProgram({
      id: 'expressions',
      chapters: [{
        id: 'one',
        nodes: [{ id: 'greeting', type: 'dialogues', dialogues: [
          { speakerId: 'hero', status: 'thoughtful', text: 'Think.' },
          { speakerId: 'hero', text: 'Listen.' },
        ] }],
      }],
    })
    expect(result.program!.chapters.one.nodes.greeting.data).toEqual({ character: 'hero', status: 'thoughtful', text: 'Think.' })
    expect(result.program!.chapters.one.nodes['greeting.dialog-2'].data).toEqual({ character: 'hero', text: 'Listen.' })
  })
})
