// @vitest-environment node

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const root = resolve(import.meta.dirname, '../../..')
const expression = (value: string) => `$${'{'}{ ${value} }}`
const load = async (file: string) => parse(await readFile(resolve(root, '.github/workflows', file), 'utf8'))

describe('shared release notes integration', () => {
  it('delegates to a fixed ai workflow without forwarding secrets', async () => {
    const caller = await load('release-notes-zh.lock.yml')
    const job = caller.jobs['release-notes']
    expect(job.uses).toMatch(/^YunYouJun\/ai\/\.github\/workflows\/release-notes\.lock\.yml@(?:[0-9a-f]{40}|release-notes-v1)$/u)
    expect(job).not.toHaveProperty('secrets')
    expect(job).not.toHaveProperty('steps')
    expect(job.permissions).toEqual({ 'actions': 'read', 'contents': 'write', 'pull-requests': 'read', 'copilot-requests': 'write' })
    expect(caller.permissions).toEqual({})
  })

  it('keeps release automation and manual patch backfills on the same interface', async () => {
    const caller = await load('release-notes-zh.lock.yml')
    expect(caller.on.release.types).toEqual(['published'])
    expect(caller.on.workflow_dispatch.inputs.automatic.default).toBe(false)
    expect(caller.on.workflow_call.inputs.automatic.default).toBe(true)
    expect(caller.on.workflow_dispatch.inputs.language.options).toEqual(['both', 'zh-CN', 'en'])
    expect(caller.jobs['release-notes'].with).toEqual({
      tag: expression('inputs.tag || github.event.release.tag_name'),
      from_tag: expression('inputs.from_tag || \'\''),
      language: expression('inputs.language || \'both\''),
      force: expression('inputs.force || false'),
      dry_run: expression('inputs.dry_run || false'),
      automatic: expression('github.event_name == \'release\' || inputs.automatic || false'),
    })
  })

  it('runs after successful promotion and desktop assets with sufficient caller permissions', async () => {
    const release = await load('release.yml')
    const caller = await load('release-notes-zh.lock.yml')
    const job = release.jobs['release-notes']
    expect(job).toMatchObject({
      needs: ['transaction', 'desktop'],
      if: 'inputs.operation == \'promote\' && !inputs.dry_run',
      uses: './.github/workflows/release-notes-zh.lock.yml',
      with: { tag: expression('needs.transaction.outputs.desktop_tag'), automatic: true },
    })
    expect(job.permissions).toEqual(caller.jobs['release-notes'].permissions)
    expect(release.jobs.transaction.steps.some((step: { run?: string }) => step.run?.includes('scripts/release/promote.mjs'))).toBe(true)
  })
})
