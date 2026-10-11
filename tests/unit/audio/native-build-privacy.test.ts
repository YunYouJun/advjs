// @vitest-environment node
import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { advBuild } from '../../../packages/advjs/node/commands/build'
import { prepareProjectGame } from '../../../packages/advjs/node/commands/build/project'
import { loadProject } from '../../../packages/advjs/node/project'
import { createEditorVoiceDesignFixture } from '../../fixtures/audio/editor-voice-design'

it('ordinary native builds copy declared resources while excluding unselected samples, references and unrelated public files', async () => {
  const fixture = await createEditorVoiceDesignFixture()
  try {
    await writeFile(join(fixture.root, 'adv.config.json'), JSON.stringify({ id: 'native-private-assets', format: 'flow', root: 'adv' }))
    await rm(join(fixture.root, 'adv/chapters/intro.adv.md'))
    await writeFile(join(fixture.root, 'adv/chapters/intro.chapter.json'), JSON.stringify({ schemaVersion: 1, id: 'intro', title: 'Native privacy', nodes: [{ id: 'hello', type: 'narration', text: 'Native public story' }, { id: 'end', type: 'end' }] }))
    const game = JSON.parse(await readFile(join(fixture.root, 'adv/settings/game.json'), 'utf8'))
    game.favicon = '/brand.svg'
    await writeFile(join(fixture.root, 'adv/settings/game.json'), JSON.stringify(game))
    const icon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="10"/></svg>'
    await writeFile(join(fixture.root, 'public/brand.svg'), icon)
    await writeFile(join(fixture.root, 'public/PRIVATE-UNRELATED.json'), '{"private":"UNDECLARED-PUBLIC-MARKER"}')
    await writeFile(join(fixture.root, 'public/media/PRIVATE-SAMPLE.wav'), fixture.bytes)
    const catalog = JSON.parse(await readFile(join(fixture.root, 'adv/assets.json'), 'utf8'))
    catalog.assets.push({ id: 'audio_019d137e-7abc-7000-8000-000000000015', type: 'audio', kind: 'voice', path: 'PRIVATE-SAMPLE.wav', sha256: fixture.sha256, bytes: fixture.bytes.length, mimeType: 'audio/wav', duration: 1, characterId: 'hero' })
    await writeFile(join(fixture.root, 'adv/assets.json'), JSON.stringify(catalog))
    const loaded = await loadProject({ root: fixture.root })
    expect(loaded.result.diagnostics.filter(issue => issue.severity === 'error')).toEqual([])
    const prepared = await prepareProjectGame(loaded)
    expect(prepared.game.favicon).toMatch(/^data:image\/svg\+xml;base64,/u)
    expect(prepared.resources.size).toBe(1)
    const result = await advBuild({ userRoot: fixture.root, vite: { logLevel: 'silent', build: { minify: false, copyPublicDir: true } } })
    expect(result.assets.some(asset => asset.path.endsWith('.svg'))).toBe(true)
    expect(result.assets.some(asset => /\.(?:wav|json)$/u.test(asset.path))).toBe(false)
    const scripts = await Promise.all(result.assets.filter(asset => asset.path.endsWith('.js')).map(asset => readFile(join(result.outDir, asset.path), 'utf8')))
    expect(scripts.join('\n')).toContain('Native public story')
    for (const privateValue of ['PRIVATE-SAMPLE', 'reference/original', 'reference.wav', 'UNDECLARED-PUBLIC-MARKER', 'authoring/rights/original'])
      expect(scripts.join('\n')).not.toContain(privateValue)
    const html = await readFile(join(result.outDir, 'index.html'), 'utf8')
    expect(html).toContain(`href="${prepared.game.favicon}"`)
    expect(html).not.toContain('href="/favicon.svg"')
    expect(await readFile(join(fixture.root, 'public/media/PRIVATE-SAMPLE.wav'))).toEqual(fixture.bytes)
  }
  finally { await rm(fixture.directory, { recursive: true, force: true }) }
}, 120_000)
