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
    expect(job.uses).toMatch(/^YunYouJun\/ai\/\.github\/workflows\/release-notes\.yml@(?:[0-9a-f]{40}|release-notes-v1)$/u)
    expect(job).not.toHaveProperty('secrets')
    expect(job).not.toHaveProperty('steps')
    expect(job.permissions).toEqual({ 'actions': 'read', 'contents': 'write', 'pull-requests': 'read', 'copilot-requests': 'write' })
    expect(caller.permissions).toEqual({})
  })

  it('keeps release automation and manual patch backfills on the same interface', async () => {
    const caller = await load('release-notes-zh.lock.yml')
    expect(caller.on.release.types).toEqual(['published'])
    expect(Object.keys(caller.on.workflow_dispatch.inputs)).toEqual(['tag', 'options'])
    expect(caller.on.workflow_dispatch.inputs.tag).toMatchObject({ type: 'string', required: true })
    expect(caller.on.workflow_dispatch.inputs.options.type).toBe('string')
    expect(caller.on).not.toHaveProperty('workflow_call')
    expect(caller.jobs['release-notes']).not.toHaveProperty('with')
  })

  it('runs after successful promotion and desktop assets with sufficient caller permissions', async () => {
    const release = await load('release.yml')
    const caller = await load('release-notes-zh.lock.yml')
    const job = release.jobs['release-notes']
    expect(job).toMatchObject({
      needs: ['transaction', 'desktop'],
      if: 'inputs.operation == \'promote\' && !inputs.dry_run',
      uses: caller.jobs['release-notes'].uses.replace('release-notes.yml@', 'release-notes.lock.yml@'),
      with: { tag: expression('needs.transaction.outputs.desktop_tag'), automatic: true },
    })
    expect(job.permissions).toEqual(caller.jobs['release-notes'].permissions)
    expect(release.jobs.transaction.steps.some((step: { run?: string }) => step.run?.includes('scripts/release/promote.mjs'))).toBe(true)
  })
})
