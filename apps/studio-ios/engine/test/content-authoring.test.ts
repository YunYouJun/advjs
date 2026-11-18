import { createProjectTemplateFiles, indexProjectContent } from '@advjs/core/project'
import { parseCharacterMd, parseLocationMd, parseSceneMd } from '@advjs/parser'
import { describe, expect, it } from 'vitest'
import { call } from '../src/index'

async function result(operation: string, input: object) {
  const response = JSON.parse(await call(operation, JSON.stringify(input)))
  expect(response.ok).toBe(true)
  return response.result
}

describe('native authoring and shared readers', () => {
  it('updates a display name over the existing source and leaves stable references intact', async () => {
    const source = '---\nid: lin\nname: 林\nfuture: { flags: [2, 3] }\n---\n\n## 外貌\n\n蓝衣。\n\n## 其他笔记\n\n手写正文 🌙\n'
    const path = 'adv/characters/import-origin.character.md'
    const { text } = await result('authoring.update', { kind: 'character', path, source, data: { name: '林夕' } })
    expect(parseCharacterMd(text)).toMatchObject({ id: 'lin', name: '林夕', appearance: '蓝衣。' })
    expect(text).toMatch(/future:\n {2}flags:/u)
    expect(text.slice(text.indexOf('\n\n## 外貌'))).toBe(source.slice(source.indexOf('\n\n## 外貌')))
  })

  it('round trips the independent location and scene fields', async () => {
    const location = '---\nid: quay\nname: 码头\nlinkedCharacters: [lin]\nlinkedScenes: [sunset]\ndefaultImagePrompt: 雾港\nfutureIndex: 2\n---\n\n地理资料\n'
    const { text: updated } = await result('authoring.update', { kind: 'location', path: 'adv/locations/quay.md', source: location, data: { name: '东码头' } })
    const parsed = parseLocationMd(updated)
    expect(parsed).toMatchObject({ name: '东码头', linkedCharacters: ['lin'], linkedScenes: ['sunset'], description: '地理资料' })
    expect(updated).toContain('futureIndex: 2')
    const scene = '---\nid: sunset\nname: 傍晚\n---\n'
    const { text } = await result('authoring.update', { kind: 'scene', path: 'adv/scenes/sunset.md', source: scene, data: { linkedLocation: parsed.id, imagePrompt: parsed.defaultImagePrompt } })
    expect(parseSceneMd(text)).toMatchObject({ linkedLocation: 'quay', imagePrompt: '雾港' })
  })

  it('indexes every speaker in the shared school-romance template', () => {
    const files = Object.fromEntries(createProjectTemplateFiles('school-romance', '校园恋爱').map(({ path, content }) => [path, content]))
    const names = new Set(indexProjectContent({ files }).characters.map(character => character.name))
    const speakers = [...files['adv/chapters/01.adv.md'].matchAll(/^@(\S+)$/gmu)].map(match => match[1])
    expect(new Set(speakers)).toEqual(names)
  })
})
