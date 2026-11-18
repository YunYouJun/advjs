// @vitest-environment node

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getWatchPolicy, matchesWatchPath, shouldBuild, syncWatchPolicies, watchConfig } from '../../../scripts/cloudflare-pages-watch.mjs'

const root = resolve(import.meta.dirname, '../../..')
const keys = ['studio', 'editor', 'vrm']

function builds(paths: string[]) {
  return keys.filter(key => shouldBuild(key, paths))
}

describe('cloudflare Pages build watch paths', () => {
  it.each([
    ['apps/studio/src/views/HomePage.vue', ['studio']],
    ['apps/studio/public/pwa-192x192.png', ['studio']],
    ['apps/studio/vite.config.ts', ['studio']],
    ['apps/studio/.browserslistrc', ['studio']],
    ['editor/core/app/pages/index.vue', ['editor']],
    ['editor/core/nuxt.config.ts', ['editor']],
    ['editor/vrm/src/pages/about.md', ['vrm']],
    ['editor/vrm/unocss.config.ts', ['vrm']],
    ['examples/ai-contest/life-story/adv/chapters/intro.adv.md', ['studio']],
    ['examples/editor-plugin-diagnostics/src/index.ts', ['editor']],
    ['demo/starter/public/md/chapters/hello.adv.md', ['editor']],
    ['apps/desktop/src/project-names.ts', ['editor']],
    ['packages/agent/src/index.ts', ['studio', 'editor']],
    ['packages/shared/adv-monaco.ts', keys],
    ['packages/shared/json-highlight.ts', ['editor', 'vrm']],
    ['plugins/plugin-interactions/client/StarMapActivity.vue', ['studio']],
    ['plugins/plugin-pominis/src/index.ts', ['editor']],
    ['packages/advjs/template/adv/chapters/README.md', ['editor', 'vrm']],
    ['packages/core/src/runtime/create.ts', keys],
    ['packages/client/components/game/AdvGame.vue', keys],
    ['themes/theme-default/components/start/StartMenu.vue', keys],
    ['pnpm-lock.yaml', keys],
    ['pnpm-workspace.yaml', keys],
    ['package.json', keys],
    ['patches/lodash.set@4.3.2.patch', keys],
    ['tsconfig.json', keys],
    ['docs/guide/studio/index.md', []],
    ['tests/unit/runtime/core-runtime-entry.test.ts', []],
    ['apps/studio/cloudbase/functions/marketStats/index.js', []],
    ['apps/studio/ios/App/App/Info.plist', []],
    ['apps/desktop/src/main.ts', []],
    ['demo/hamster/adv.config.ts', []],
    ['demo/starter/src/App.vue', []],
    ['examples/three-map/src/App.vue', []],
    ['plugins/plugin-openai/src/index.ts', []],
    ['editor/core/README.md', []],
    ['editor/vrm/README.md', []],
    ['README.md', []],
    ['config/cloudflare-pages-build-watch.json', []],
    ['scripts/cloudflare-pages-watch.mjs', []],
    ['.github/workflows/ci.yml', []],
  ])('routes %s to only its affected projects', (path, expected) => {
    expect(builds([path])).toEqual(expected)
  })

  it('keeps source changes in mixed documentation pushes', () => {
    expect(builds(['docs/guide/vrm.md', 'editor/vrm/src/main.ts'])).toEqual(['vrm'])
    expect(builds(['editor/core/README.md', 'editor/core/nuxt.config.ts'])).toEqual(['editor'])
  })

  it('watches the new audio workspace and Studio shared audio contracts', () => {
    expect(builds(['packages/audio/src/runtime-projection.ts'])).toEqual(['studio', 'editor', 'vrm'])
    expect(builds(['packages/advjs/shared/hosted-audio.ts'])).toEqual(['studio', 'editor', 'vrm'])
  })

  it.each([
    'packages/agent/package.json',
    'packages/agent/src/proposals/index.ts',
    'packages/agent/src/proposals/flow.ts',
    'packages/agent/src/proposals/review.ts',
    'packages/agent/src/core/contracts.ts',
  ])('watches shared Agent proposal dependencies in Studio and Editor: %s', (path) => {
    expect(builds([path])).toEqual(['studio', 'editor'])
  })

  it('matches nested paths and literal punctuation using Pages wildcard semantics', () => {
    expect(matchesWatchPath('examples/ai-contest/story/adv/chapter.md', 'examples/ai-contest/*')).toBe(true)
    expect(matchesWatchPath('tsconfig.node.json', 'tsconfig*.json')).toBe(true)
    expect(matchesWatchPath('tsconfigXjson', 'tsconfig.json')).toBe(false)
    expect(matchesWatchPath('other/apps/studio/src/main.ts', 'apps/studio/*')).toBe(false)
  })

  it('mirrors the documented empty and large push bypasses', () => {
    for (const key of keys) {
      expect(shouldBuild(key, [])).toBe(true)
      expect(shouldBuild(key, ['README.md'], { commitCount: 20 })).toBe(true)
      expect(shouldBuild(key, Array.from({ length: 3000 }).fill('README.md'))).toBe(true)
      expect(shouldBuild(key, ['README.md'], { commitCount: 19 })).toBe(false)
    }
  })

  it('covers every app workspace dependency, including future transitive dependencies', () => {
    const manifests = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '*package.json'], { cwd: root, encoding: 'utf8' })
      .trim()
      .split('\n')
      .map(path => ({ path, ...JSON.parse(readFileSync(resolve(root, path), 'utf8')) }))
    const byName = new Map(manifests.map(manifest => [manifest.name, manifest]))
    for (const key of keys) {
      const app = JSON.parse(readFileSync(resolve(root, getWatchPolicy(key).workspace, 'package.json'), 'utf8'))
      const pending = [app.name]
      const seen = new Set()
      while (pending.length) {
        const name = pending.pop()!
        if (seen.has(name))
          continue
        seen.add(name)
        const manifest = byName.get(name)!
        expect(shouldBuild(key, [manifest.path]), `${key}: ${manifest.path}`).toBe(true)
        const sourcePath = `${dirname(manifest.path)}/src/pages-dependency-probe.ts`
        expect(shouldBuild(key, [sourcePath]), `${key}: ${sourcePath}`).toBe(true)
        for (const [dependency, version] of Object.entries({ ...manifest.dependencies, ...manifest.devDependencies, ...manifest.optionalDependencies })) {
          if (typeof version === 'string' && version.startsWith('workspace:'))
            pending.push(dependency)
        }
      }
    }
  })

  it('covers app relative imports outside its own directory, including raw template Markdown', () => {
    const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).trim().split('\n')
    for (const key of keys) {
      const workspace = getWatchPolicy(key).workspace
      for (const file of files.filter(path => path.startsWith(`${workspace}/`) && /\.(?:ts|vue|scss)$/.test(path) && !/\/__tests__\/|\/tests\/|\.test\.|\.spec\./.test(path))) {
        const source = readFileSync(resolve(root, file), 'utf8')
        for (const match of source.matchAll(/(?:from\s*|import\s*\(|@use\s*)['"](\.[^'"]+)['"]/g)) {
          const imported = resolve(root, dirname(file), match[1].split('?')[0]).slice(root.length + 1)
          if (!imported.startsWith(`${workspace}/`)) {
            const path = /\.[a-z]+$/i.test(imported) ? imported : `${imported}.ts`
            expect(shouldBuild(key, [path]), `${key}: ${file} imports ${path}`).toBe(true)
          }
        }
      }
    }
  })

  it('patches only watch paths and preserves branch, build, cache, and environment settings', async () => {
    const projects = new Map(Object.values(watchConfig.projects).map((policy: any) => [policy.project, {
      source: { type: 'github', config: { owner: 'YunYouJun', repo_name: 'advjs', production_branch: 'main', preview_deployment_setting: 'all', path_includes: ['*'], path_excludes: [] } },
      build_config: { build_command: policy.buildCommand, destination_dir: policy.destinationDir, build_caching: true },
      production_branch: 'main',
      deployment_configs: { production: { env_vars: { TEST: { value: 'preserved' } } } },
    }]))
    const patches: any[] = []
    const request = async (url: string, options: any) => {
      const name = url.split('/').at(-1)!
      const project = projects.get(name)!
      if (options.method === 'PATCH') {
        const body = JSON.parse(options.body)
        patches.push(body)
        project.source = body.source
      }
      return { ok: true, status: 200, json: async () => ({ success: true, result: structuredClone(project) }) }
    }
    const result = await syncWatchPolicies({ accountId: 'test', token: 'test', apply: true, request })
    expect(result.every((project: any) => project.verified)).toBe(true)
    expect(patches).toHaveLength(3)
    expect(patches.every(body => Object.keys(body).join() === 'source')).toBe(true)
    expect([...projects.values()].every(project => project.source.config.production_branch === 'main')).toBe(true)
  })
})
