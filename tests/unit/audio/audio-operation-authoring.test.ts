import type { AdvAssetManifest } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import { compileMarkdownProgram } from '../../../packages/core/src/compiler/markdown'
import { patchMarkdownAudioOperations, readMarkdownAudioAtCursor, readMarkdownAudioTarget } from '../../../packages/core/src/project/audio-operations'

const lineId = 'line_019d137e-7abc-7000-8000-000000000001'
const catalog: AdvAssetManifest = { schemaVersion: 2, id: 'fixture', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public' } }, assets: ['bgm', 'ambience', 'sfx', 'voice', 'reference'].map(kind => ({ id: `audio-${kind}`, type: 'audio', kind: kind as 'bgm', path: `${kind}.wav` })) }
const prose = `# 夜色\n\n@Hero\n故事继续。 {#${lineId}}\n\n- [ ] 继续\n- [ ] 回家\n`

describe('canonical scene audio authoring', () => {
  it('inserts before a real dialogue block and preserves prose, choices, and stable voice identity', async () => {
    const target = await readMarkdownAudioAtCursor(prose, 4)
    expect(target.line).toBe(3)
    const content = await patchMarkdownAudioOperations(prose, target, [
      { type: 'bgm', action: 'set', asset: 'audio-bgm', gain: 0.6, fade: { in: 500, out: 300 } },
      { type: 'ambience', action: 'set', slot: 'weather', asset: 'audio-ambience', loop: true },
      { type: 'sfx', action: 'play', asset: 'audio-sfx', group: 'door', priority: 2 },
    ], catalog)
    expect(content.slice(content.indexOf('@Hero'))).toBe(prose.slice(prose.indexOf('@Hero')))
    const compiled = await compileMarkdownProgram({ id: 'scene-audio', chapters: [{ id: 'intro', content }] })
    expect(compiled.diagnostics.filter(value => value.severity === 'error')).toEqual([])
    const nodes = Object.values(compiled.program!.chapters.intro!.nodes)
    expect(nodes.find(node => node.kind === 'effects')?.data?.operations).toEqual([
      { type: 'bgm', action: 'set', asset: 'audio-bgm', gain: 0.6, fade: { in: 500, out: 300 } },
      { type: 'ambience', action: 'set', slot: 'weather', asset: 'audio-ambience', loop: true },
      { type: 'sfx', action: 'play', asset: 'audio-sfx', group: 'door', priority: 2 },
    ])
    expect(nodes.find(node => node.data?.lineId === lineId)?.data?.text).toBe('故事继续。')
  })

  it('updates audio inside a mixed YAML block without removing non-audio operations or adjacent source', async () => {
    const content = `# Intro\n\n\`\`\`yaml\n- type: background\n  url: room.png\n- type: bgm\n  action: set\n  asset: audio-bgm\n- type: transition\n  name: crossfade\n\`\`\`\n\n${prose}`
    const target = await readMarkdownAudioTarget(content, 3)
    const updated = await patchMarkdownAudioOperations(content, target, [{ type: 'bgm', action: 'clear', fade: { out: 400 } }, { type: 'sfx', action: 'play', asset: 'audio-sfx' }], catalog)
    const compiled = await compileMarkdownProgram({ id: 'scene-audio', chapters: [{ id: 'intro', content: updated }] })
    expect(compiled.diagnostics.filter(value => value.severity === 'error')).toEqual([])
    expect(Object.values(compiled.program!.chapters.intro!.nodes).find(node => node.kind === 'effects')?.data?.operations).toEqual([
      { type: 'background', url: 'room.png' },
      { type: 'bgm', action: 'clear', fade: { out: 400 } },
      { type: 'transition', name: 'crossfade' },
      { type: 'sfx', action: 'play', asset: 'audio-sfx' },
    ])
    expect(updated.endsWith(prose)).toBe(true)
    const removed = await patchMarkdownAudioOperations(updated, await readMarkdownAudioTarget(updated, 3), [], catalog)
    expect(removed).toContain('"type": "background"')
    expect(removed).toContain('"type": "transition"')
    expect(removed).not.toContain('"type": "bgm"')
  })

  it('blocks source conflict, guessed/synthetic targets and the wrong catalog purpose', async () => {
    const target = await readMarkdownAudioTarget(prose, 3)
    await expect(patchMarkdownAudioOperations(prose.replace('故事继续', '故事改变'), target, [{ type: 'sfx', action: 'play', asset: 'audio-sfx' }], catalog)).rejects.toThrow('SOURCE_CONFLICT')
    await expect(readMarkdownAudioTarget(prose, 4)).rejects.toThrow('TARGET_CHANGED')
    await expect(readMarkdownAudioAtCursor(prose, 2)).rejects.toThrow('TARGET_CHANGED')
    for (const asset of ['audio-voice', 'audio-reference', 'missing'])
      await expect(patchMarkdownAudioOperations(prose, target, [{ type: 'bgm', action: 'set', asset }], catalog)).rejects.toThrow('ASSET_KIND')
    await expect(patchMarkdownAudioOperations(prose, target, [{ type: 'bgm', action: 'clear', asset: 'audio-bgm' }], catalog)).rejects.toThrow('INVALID_ASSET')
  })

  it('preserves CRLF and replaces a pure audio block with empty content only on explicit removal', async () => {
    const content = prose.replaceAll('\n', '\r\n')
    const inserted = await patchMarkdownAudioOperations(content, await readMarkdownAudioTarget(content, 3), [{ type: 'sfx', action: 'play', asset: 'audio-sfx' }], catalog)
    expect(inserted.replaceAll('\r\n', '')).not.toContain('\n')
    const target = await readMarkdownAudioTarget(inserted, 3)
    expect(target.existing).toBe(true)
    const removed = await patchMarkdownAudioOperations(inserted, target, [], catalog)
    expect(removed).toContain(`@Hero\r\n故事继续。 {#${lineId}}`)
    expect(removed).not.toContain('advnode')
  })
})
