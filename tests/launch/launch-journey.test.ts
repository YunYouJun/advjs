// @vitest-environment node

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createLaunchJourney } from './helpers'

const root = resolve(import.meta.dirname, '../..')
const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { force: true, recursive: true })))
})

async function createTarball() {
  const directory = await mkdtemp(join(tmpdir(), 'advjs-launch-source-'))
  temporaryDirectories.push(directory)
  const tarball = join(directory, 'advjs-0.0.0-launch.tgz')
  await writeFile(tarball, 'packed fixture', 'utf8')
  return tarball
}

describe('launch journey', () => {
  it('accepts only packed or registry sources and creates an external temporary workspace', async () => {
    await expect(createLaunchJourney({
      packageSource: { kind: 'workspace', value: 'workspace:*' } as never,
    })).rejects.toThrow('packed tarball or registry package')

    const journey = await createLaunchJourney({
      packageSource: { kind: 'tarball', value: await createTarball() },
    })
    temporaryDirectories.push(journey.workspaceRoot)

    expect(isAbsolute(journey.workspaceRoot)).toBe(true)
    expect(relative(tmpdir(), journey.workspaceRoot)).not.toMatch(/^\.\./u)
    expect(relative(root, journey.workspaceRoot)).toMatch(/^\.\./u)

    const registryJourney = await createLaunchJourney({
      packageSource: { kind: 'registry', value: 'advjs@0.2.0-rc.1' },
    })
    temporaryDirectories.push(registryJourney.workspaceRoot)
    expect(relative(tmpdir(), registryJourney.workspaceRoot)).not.toMatch(/^\.\./u)
  })

  it('fails closed when a required launch capability has no executor', async () => {
    const journey = await createLaunchJourney({
      packageSource: { kind: 'tarball', value: await createTarball() },
    })
    temporaryDirectories.push(journey.workspaceRoot)

    const report = await journey.run({})

    expect(report.status).toBe('failed')
    expect(report.stages).toEqual([
      { id: 'install', status: 'failed', error: 'Missing required launch executor: install' },
      { id: 'agent-mcp', status: 'blocked', reason: 'An earlier launch stage failed' },
      { id: 'check', status: 'blocked', reason: 'An earlier launch stage failed' },
      { id: 'editor', status: 'blocked', reason: 'An earlier launch stage failed' },
      { id: 'build', status: 'blocked', reason: 'An earlier launch stage failed' },
      { id: 'deploy', status: 'blocked', reason: 'An earlier launch stage failed' },
      { id: 'verify-url', status: 'blocked', reason: 'An earlier launch stage failed' },
    ])
  })

  it('preserves failure evidence and a machine-readable report for CI upload', async () => {
    const artifactsDirectory = await mkdtemp(join(tmpdir(), 'advjs-launch-artifacts-'))
    temporaryDirectories.push(artifactsDirectory)
    const journey = await createLaunchJourney({
      packageSource: { kind: 'tarball', value: await createTarball() },
      artifactsDirectory,
    })
    temporaryDirectories.push(journey.workspaceRoot)

    const report = await journey.run({
      install: async (context) => {
        await Promise.all([
          writeFile(context.artifacts.commandLog, 'pnpm install failed\n', 'utf8'),
          writeFile(context.artifacts.editorLog, 'editor not started\n', 'utf8'),
          writeFile(context.artifacts.projectDiff, 'no project changes\n', 'utf8'),
          writeFile(context.artifacts.buildSummary, '{"status":"not-started"}\n', 'utf8'),
          writeFile(context.artifacts.browserTrace, 'trace not started\n', 'utf8'),
        ])
        throw new Error('install exploded')
      },
    })

    expect(report.status).toBe('failed')
    expect(report.stages[0]).toEqual({ id: 'install', status: 'failed', error: 'install exploded' })
    expect(report.stages.slice(1).every(stage => stage.status === 'blocked')).toBe(true)
    expect(await readFile(journey.artifacts.commandLog, 'utf8')).toBe('pnpm install failed\n')
    expect(await readFile(journey.artifacts.editorLog, 'utf8')).toBe('editor not started\n')
    expect(await readFile(journey.artifacts.projectDiff, 'utf8')).toBe('no project changes\n')
    expect(await readFile(journey.artifacts.buildSummary, 'utf8')).toBe('{"status":"not-started"}\n')
    expect(await readFile(journey.artifacts.browserTrace, 'utf8')).toBe('trace not started\n')
    expect(JSON.parse(await readFile(journey.artifacts.report, 'utf8'))).toEqual(report)
  })
})
