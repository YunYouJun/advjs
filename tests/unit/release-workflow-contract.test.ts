// @vitest-environment node

import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const root = resolve(import.meta.dirname, '../..')
const workflows = [
  '.github/workflows/release-candidate.yml',
  '.github/workflows/release.yml',
]
const actionWorkflows = [
  ...workflows,
  '.github/workflows/release-core.yml',
]

function collectRunCommands(value: unknown): string[] {
  if (Array.isArray(value))
    return value.flatMap(collectRunCommands)
  if (!value || typeof value !== 'object')
    return []
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => key === 'run' && typeof child === 'string' ? [child] : collectRunCommands(child))
}

describe('release workflow contracts', () => {
  it('uses current Node 24-based GitHub Actions', async () => {
    for (const workflowPath of actionWorkflows) {
      const source = await readFile(resolve(root, workflowPath), 'utf8')
      expect(source).toContain('uses: actions/checkout@v7')
      expect(source).toContain('uses: pnpm/action-setup@v6')
      expect(source).toContain('uses: actions/setup-node@v7')
      if (source.includes('actions/upload-artifact@'))
        expect(source).toContain('uses: actions/upload-artifact@v7')
    }
  })

  it('references only existing repository scripts and never calls the removed ci:publish command', async () => {
    const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
    for (const workflowPath of workflows) {
      const source = await readFile(resolve(root, workflowPath), 'utf8')
      expect(source).not.toContain('ci:publish')
      expect(source).toContain('version: 11.20.0')
      expect(source).toContain('node-version: \'lts/*\'')
      const commands = collectRunCommands(parse(source))
      expect(commands.some(command => /\bnpm(?:\s|$)/u.test(command))).toBe(false)
      for (const command of commands) {
        for (const match of command.matchAll(/\bnode\s+(scripts\/[\w./-]+)/gu))
          await expect(access(resolve(root, match[1]))).resolves.toBeUndefined()
        for (const match of command.matchAll(/\b(?:npm|pnpm)\s+run\s+([\w:-]+)/gu))
          expect(packageJson.scripts, `${workflowPath}: ${match[1]}`).toHaveProperty(match[1])
      }
    }
  })

  it('pins a single release lock, exact source checkout, dry-run, and local registry inputs', async () => {
    const workflow = await readFile(resolve(root, '.github/workflows/release-candidate.yml'), 'utf8')

    expect(workflow).toContain('group: advjs-release')
    expect(workflow).toContain(`ref: $${'{'}{ inputs.source_sha }}`)
    expect(workflow).toContain('dry_run:')
    expect(workflow).toContain('registry_url:')
    expect(workflow).toContain('--dry-run')
    expect(workflow).toContain(`release-candidate-$${'{'}{ inputs.version }}`)
  })
})
