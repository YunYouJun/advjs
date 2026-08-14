// @vitest-environment node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  prepareWorkspace,
  WORKSPACE_PREPARATION_PROFILES,
} from '../../scripts/prepare-workspace.mjs'
import { resolveNpxInvocation } from '../../scripts/release/run-command.mjs'

const root = resolve(import.meta.dirname, '../..')

describe('workspace preparation profiles', () => {
  it('keeps every clean-runner prerequisite in one explicit contract', () => {
    expect(WORKSPACE_PREPARATION_PROFILES).toEqual({
      editor: [
        ['pnpm', ['build']],
        ['pnpm', ['build:plugins']],
        ['pnpm', ['-C', 'editor/core', 'exec', 'nuxt', 'prepare']],
      ],
      launch: [
        ['pnpm', ['build']],
        ['pnpm', ['build:plugins']],
        ['pnpm', ['-C', 'editor/core', 'build']],
      ],
      lint: [
        ['pnpm', ['unocss:build']],
      ],
      studio: [
        ['pnpm', ['build']],
        ['pnpm', ['build:plugins']],
      ],
      unit: [
        ['pnpm', ['build']],
        ['pnpm', ['-C', 'editor/core', 'exec', 'nuxt', 'prepare']],
      ],
    })
  })

  it('executes a profile in order without enabling a shell', async () => {
    const calls: Array<{ args: string[], command: string, options: Record<string, unknown> }> = []

    await prepareWorkspace('unit', {
      root: '/workspace/advjs',
      runner: async (command: string, args: string[], options: Record<string, unknown>) => {
        calls.push({ args, command, options })
      },
    })

    expect(calls).toEqual([
      {
        args: ['build'],
        command: 'pnpm',
        options: { cwd: '/workspace/advjs', stderr: 'inherit', stdout: 'inherit' },
      },
      {
        args: ['-C', 'editor/core', 'exec', 'nuxt', 'prepare'],
        command: 'pnpm',
        options: { cwd: '/workspace/advjs', stderr: 'inherit', stdout: 'inherit' },
      },
    ])
    expect(calls.every(call => !('shell' in call.options))).toBe(true)
  })

  it('keeps deployment build entrypoints self-contained', () => {
    const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
    const parserPackageJson = JSON.parse(readFileSync(resolve(root, 'packages/parser/package.json'), 'utf8'))

    expect(packageJson.scripts).toMatchObject({
      'build:demo': 'pnpm build:advjs && pnpm -C demo/starter run build',
      'editor:build': 'pnpm prepare:workspace editor && pnpm -C editor/core build',
      'parser:play:build': 'pnpm types:build && pnpm assets:build && pnpm parser:build && pnpm core:build && pnpm -C packages/parser play:build',
      'studio:build': 'pnpm prepare:workspace studio && pnpm -C apps/studio run build',
    })
    expect(parserPackageJson.scripts['play:build']).toBe('pnpm run copy && pnpm -C playground run build')
  })

  it('rejects missing or unknown profiles', async () => {
    await expect(prepareWorkspace('unknown')).rejects.toThrow('Unknown workspace preparation profile')
  })

  it('bypasses the Windows npx command shim without enabling a shell', () => {
    expect(resolveNpxInvocation(['--yes', 'advjs@0.1.2', '--version'], {
      execPath: 'C:\\node\\node.exe',
      platform: 'win32',
    })).toEqual({
      args: ['C:\\node\\node_modules\\npm\\bin\\npx-cli.js', '--yes', 'advjs@0.1.2', '--version'],
      command: 'C:\\node\\node.exe',
    })
  })
})
