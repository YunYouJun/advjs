import { describe, expect, it } from 'vitest'
import { exportCharacterForAI, parseCharacterMd, stringifyCharacterMd } from '../src'

describe('character structured attributes', () => {
  it('parses and stringifies mystery attributes', () => {
    const content = `---
id: detective
name: Detective
attributes:
  template: mystery
  mystery:
    publicIdentity: Consultant
    secret: Knows the victim
    clues:
      - broken watch
    suspicionInitial: 25
  ai:
    visibility: gm-only
---

## 性格

冷静。
`

    const character = parseCharacterMd(content)
    expect(character.attributes?.template).toBe('mystery')
    expect(character.attributes?.mystery?.secret).toBe('Knows the victim')
    expect(character.attributes?.ai?.visibility).toBe('gm-only')

    const serialized = stringifyCharacterMd(character)
    expect(serialized).toContain('template: mystery')
    expect(serialized).toContain('visibility: gm-only')
    expect(serialized).toContain('suspicionInitial: 25')
  })

  it('exports attributes for AI and honors excludeFields', () => {
    const character = parseCharacterMd(`---
id: suspect
name: Suspect
attributes:
  template: mystery
  profile:
    age: 32
    personalityTags:
      - calm
  mystery:
    publicIdentity: Butler
    secret: Staged the alibi
    clues:
      - muddy shoes
  custom:
    catchphrase:
      label: Catchphrase
      value: "Not my concern"
  ai:
    visibility: gm-only
    excludeFields:
      - mystery.secret
---
`)

    const exported = exportCharacterForAI(character)
    expect(exported).toContain('## 结构化属性')
    expect(exported).toContain('**模板**: 悬疑')
    expect(exported).toContain('**公开身份**: Butler')
    expect(exported).not.toContain('Staged the alibi')
    expect(exported).toContain('**Catchphrase**: Not my concern')
  })

  it('skips attributes when promptInject is false', () => {
    const character = parseCharacterMd(`---
id: hidden
name: Hidden
attributes:
  profile:
    age: 20
  ai:
    promptInject: false
---
`)

    const exported = exportCharacterForAI(character)
    expect(exported).not.toContain('结构化属性')
    expect(exported).not.toContain('年龄')
  })
})
