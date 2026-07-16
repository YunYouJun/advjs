// @vitest-environment node

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineAdvPlugin } from '@advjs/core'
import { afterEach, describe, expect, it } from 'vitest'
import { runCheck } from '../../packages/advjs/node/commands/check'

const roots: string[] = []

function project(chapters: Record<string, string>): { cwd: string, root: string } {
  const cwd = mkdtempSync(join(tmpdir(), 'advjs-runtime-check-'))
  roots.push(cwd)
  const root = join(cwd, 'adv')
  for (const [path, content] of Object.entries(chapters)) {
    const file = join(root, 'chapters', path)
    mkdirSync(join(file, '..'), { recursive: true })
    writeFileSync(file, content, 'utf8')
  }
  return { cwd, root }
}

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('adv check runtime diagnostics', () => {
  it('reports compiler codes and source positions for the whole program', async () => {
    const { cwd, root } = project({
      '1/one.adv.md': [
        '```yaml',
        'type: when',
        'condition: window.alert(1)',
        '```',
        '',
        '这条内容不会通过编译。',
        '',
        '- [跳到缺失节点](chapter-2#missing)',
      ].join('\n'),
      '2/two.adv.md': '## 第二章 {#start}',
    })

    const result = await runCheck({ cwd, root })
    const runtimeIssues = result.issues.filter(issue => issue.category === 'runtime')

    expect(runtimeIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'ADV_RUNTIME_INVALID_CONDITION',
        type: 'error',
        line: 1,
      }),
      expect.objectContaining({
        code: 'ADV_RUNTIME_UNKNOWN_TARGET',
        type: 'error',
        line: 8,
      }),
    ]))
    expect(result.passed).toBe(false)
  })

  it('validates required plugins and registered node capabilities', async () => {
    const { cwd, root } = project({
      '1/plugin.adv.md': [
        '```yaml',
        'type: activity',
        'use: observer/missing',
        '```',
      ].join('\n'),
    })
    const observer = defineAdvPlugin({
      name: 'observer',
      version: '1.0.0',
      nodes: { compare() {} },
    })

    const missing = await runCheck({
      cwd,
      root,
      requiredPlugins: { observer: '1.0.0' },
      runtimePlugins: [],
    })
    expect(missing.issues).toContainEqual(expect.objectContaining({
      code: 'ADV_RUNTIME_MISSING_PLUGIN',
      category: 'runtime',
    }))

    const unknown = await runCheck({
      cwd,
      root,
      requiredPlugins: { observer: '1.0.0' },
      runtimePlugins: [observer],
    })
    expect(unknown.issues).toContainEqual(expect.objectContaining({
      code: 'ADV_RUNTIME_UNKNOWN_NODE',
      category: 'runtime',
    }))
  })
})
