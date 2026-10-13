// @vitest-environment node
import type { AdvProjectFileMap } from '@advjs/types'
import type { BrowserProjectDirectory, BrowserProjectFile } from '../../../editor/core/app/adapters/browser/project'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readBrowserProjectFiles } from '../../../editor/core/app/adapters/browser/project'
import { loadProject } from '../../../packages/advjs/node/project'
import { flowProjectRevision, planFlowProposal, readFlowProposalSnapshot } from '../../../packages/core/src/project'

vi.mock('@advjs/core', () => import('../../../packages/core/src/project'))

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

function browserDirectory(files: AdvProjectFileMap, prefix = ''): BrowserProjectDirectory {
  return {
    kind: 'directory',
    name: prefix.split('/').filter(Boolean).at(-1) ?? 'project',
    async* values() {
      const children = new Set(Object.keys(files).filter(path => path.startsWith(prefix)).map(path => path.slice(prefix.length).split('/')[0]!))
      for (const name of children) {
        const path = `${prefix}${name}`
        if (Object.hasOwn(files, path)) {
          yield { kind: 'file', name, getFile: async () => ({ size: files[path]!.length, text: async () => files[path]! }) } satisfies BrowserProjectFile
        }
        else {
          yield browserDirectory(files, `${path}/`)
        }
      }
    },
  }
}

describe('portable Flow proposal revisions across real host readers', () => {
  it('imports a Node-authored proposal in browser despite incidental files, and fences native metadata/rights changes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'advjs-flow-proposal-hosts-'))
    roots.push(root)
    const path = 'story/chapters/intro.chapter.json'
    const consentPath = 'authoring/consent/hero.txt'
    const rights = { license: 'Synthetic fixture permission', subject: 'Fictional actor', consentRecord: consentPath }
    const profile = { intent: { speakingStyle: 'Calm' }, locales: { 'zh-CN': { providers: { fixture: { voiceId: 'voice', model: 'fixture', source: 'cloned', rights } } } } }
    const source: AdvProjectFileMap = {
      'adv.config.json': JSON.stringify({ id: 'portable', format: 'flow', root: './story' }),
      'story/settings/game.json': JSON.stringify({ title: 'Story', characters: [{ id: 'hero', name: 'Hero', voiceProfile: profile }] }),
      [path]: JSON.stringify({ schemaVersion: 1, id: 'intro', title: 'Intro', nodes: [{ id: 'end', type: 'end' }] }),
      'story/audio/voice-profiles.json': '{"schemaVersion":1,"revision":0}',
      'story/assets.json': JSON.stringify({ schemaVersion: 2, id: 'portable-assets', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public' } }, assets: [] }),
      'story/characters/guide.character.md': '---\nid: guide\nname: Guide\n---\nOriginal guide context\n',
      'story/scenes/room.md': '---\nid: room\nname: Room\ntype: image\nsrc: /room.png\n---\n',
      [consentPath]: 'Explicit synthetic fixture permission',
      'package.json': '{"name":"portable","private":true}',
      'README.md': '# Incidental project notes',
      'README': 'Other incidental notes',
      'unrelated.json': '{"private":"incidental"}',
      'story/notes.txt': 'Browser reads this; Node omits it',
      'story/image.svg': '<svg/>',
      'story/image.png': 'binary placeholder only in browser map',
      'story/.nuxt/generated.json': '{"generated":true}',
      'story/coverage/generated.md': 'Generated coverage',
      'public/scene.svg': '<svg/>',
      'components/App.vue': '<template>Unrelated UI code</template>',
    }
    for (const [path, content] of Object.entries(source)) {
      await mkdir(dirname(join(root, path)), { recursive: true })
      await writeFile(join(root, path), content)
    }
    const node = await loadProject({ root, allowEmptyAssetManifest: true })
    const browser = await readBrowserProjectFiles(browserDirectory(source))
    expect(node.files['package.json']).toBeUndefined()
    expect(browser['package.json']).toBe(source['package.json'])
    expect(node.files['story/image.png']).toBeUndefined()
    expect(browser['story/image.png']).toBe('')
    expect(node.files[consentPath]).toBe(source[consentPath])
    expect(browser['story/.nuxt/generated.json']).toBeDefined()
    expect(node.files['story/.nuxt/generated.json']).toBeUndefined()
    const snapshot = await readFlowProposalSnapshot({ files: node.files, path })
    expect(snapshot.projectRevision).toBe(await flowProjectRevision(browser))
    const request = { schemaVersion: 1, path, expectedRevision: snapshot.revision, projectRevision: snapshot.projectRevision, commands: [{ type: 'set-title', title: 'Proposed' }] }
    const plan = await planFlowProposal({ files: browser, request })
    expect(plan.valid, JSON.stringify(plan.diagnostics)).toBe(true)
    expect(plan.proposed.title).toBe('Proposed')
    for (const dependency of ['story/settings/game.json', 'story/characters/guide.character.md', 'story/scenes/room.md', 'story/assets.json', 'story/audio/voice-profiles.json', consentPath]) {
      await expect(planFlowProposal({ files: { ...browser, [dependency]: `${browser[dependency]} ` }, request })).rejects.toThrow('ADV_FLOW_SOURCE_CONFLICT')
    }
    const withoutConsent = { ...browser }
    delete withoutConsent[consentPath]
    expect(await flowProjectRevision(withoutConsent)).not.toBe(snapshot.projectRevision)
    expect(await flowProjectRevision({ ...browser, 'README.md': 'Changed incidental notes', 'unrelated.json': '{}' })).toBe(snapshot.projectRevision)
    expect(await flowProjectRevision({ ...browser, 'story/chapters/new.chapter.json': '{}' })).not.toBe(snapshot.projectRevision)
  })

  it('includes explicit sources outside the content root and root asset fallback when provided', async () => {
    const files = { 'adv.config.json': '{"format":"flow","root":"adv"}', 'adv/settings/game.json': '{"chapters":[{"id":"intro","sources":["public/intro.chapter.json"]}]}', 'public/intro.chapter.json': '{}', 'assets.json': '{"includes":["public/catalog.json"]}', 'public/catalog.json': '{}' }
    const revision = await flowProjectRevision(files)
    expect(await flowProjectRevision({ ...files, 'public/intro.chapter.json': '{ }' })).not.toBe(revision)
    expect(await flowProjectRevision({ ...files, 'assets.json': '{ }' })).not.toBe(revision)
    expect(await flowProjectRevision({ ...files, 'public/catalog.json': '{ }' })).not.toBe(revision)
  })
})
