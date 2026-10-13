// @vitest-environment node

import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import process from 'node:process'
import addFormats from 'ajv-formats'
import Ajv2020 from 'ajv/dist/2020.js'
import { join, resolve } from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runFlowCommand } from '../../../packages/advjs/node/cli/flow'
import { loadProject } from '../../../packages/advjs/node/project'
import cliOutputSchema from '../../launch/contracts/cli-output.schema.json'

vi.mock('@advjs/core', async importOriginal => ({
  ...await importOriginal<object>(),
  ...await import('../../../packages/core/src/project'),
}))

const root = resolve(import.meta.dirname, '../../..')
const path = 'adv/chapters/intro.chapter.json'
const lineId = 'line_019d137e-7abc-7000-8000-000000000001'
const content = `${JSON.stringify({ schemaVersion: 1, id: 'intro', title: 'Intro', nodes: [
  { id: 'hello', type: 'narration', lineId, text: 'Hello', next: 'end' },
  { id: 'end', type: 'end' },
] }, null, 2)}\n`
const ajv = new Ajv2020({ allErrors: true, strict: true })
addFormats(ajv)
ajv.addSchema(cliOutputSchema)

function runCli(args: string[], cwd: string) {
  return new Promise<{ code: number | null, stdout: string, stderr: string }>((resolveResult, reject) => {
    const child = spawn(process.execPath, ['--import', join(root, 'node_modules/tsx/dist/loader.mjs'), join(root, 'packages/advjs/node/cli/index.ts'), 'flow', ...args, '--json'], {
      cwd,
      env: { ...process.env, TSX_TSCONFIG_PATH: join(root, 'tsconfig.json'), NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => child.kill('SIGKILL'), 20000)
    child.stdout.on('data', chunk => stdout += chunk)
    child.stderr.on('data', chunk => stderr += chunk)
    child.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.once('close', (code) => {
      clearTimeout(timer)
      resolveResult({ code, stdout, stderr })
    })
  })
}

function envelope(output: { stdout: string, stderr: string }, definition: string) {
  expect(output.stdout.trim().split('\n'), output.stderr).toHaveLength(1)
  const value = JSON.parse(output.stdout)
  const validate = ajv.getSchema(`${cliOutputSchema.$id}#/$defs/${definition}`)!
  expect(validate(value), ajv.errorsText(validate.errors)).toBe(true)
  return value
}

describe('read-only native Flow CLI', () => {
  let directory: string

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'advjs-cli-flow-'))
    await mkdir(join(directory, 'adv/chapters'), { recursive: true })
    await writeFile(join(directory, 'adv.config.json'), JSON.stringify({ id: 'flow-cli', format: 'flow', root: 'adv' }))
    await writeFile(join(directory, path), content)
  })

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
  })

  async function requestFor(commands: unknown[]) {
    const snapshot = await runFlowCommand({ action: 'read', root: directory, path })
    return { schemaVersion: 1, path, expectedRevision: snapshot.revision, projectRevision: snapshot.projectRevision, commands }
  }

  it('uses the shared planner and keeps source and metadata unchanged', async () => {
    const before = (await loadProject({ root: directory })).files
    const request = await requestFor([{ type: 'update-node', nodeId: 'hello', patch: { text: 'Proposed' } }])
    const planned = await runFlowCommand({ action: 'plan', root: directory, request: JSON.stringify(request) })
    expect(planned).toMatchObject({ request, valid: true, changes: { lines: [{ nodeId: 'hello', lineId, kind: 'updated', fields: ['text'] }] } })
    expect((await loadProject({ root: directory })).files).toEqual(before)
  })

  it('rejects malformed, oversized, missing-revision and escaping-path inputs', async () => {
    await expect(runFlowCommand({ action: 'plan', root: directory, request: '{broken' })).rejects.toThrow('ADV_FLOW_PROPOSAL_INVALID')
    await expect(runFlowCommand({ action: 'plan', root: directory, request: ' '.repeat(256 * 1024 + 1) })).rejects.toThrow('ADV_FLOW_PROPOSAL_LIMIT')
    await expect(runFlowCommand({ action: 'plan', root: directory, request: JSON.stringify({ schemaVersion: 1, path, commands: [] }) })).rejects.toThrow('ADV_FLOW_PROPOSAL_INVALID')
    await expect(runFlowCommand({ action: 'read', root: directory, path: '../outside.chapter.json' })).rejects.toThrow('ADV_FLOW_INVALID_PATH')
    expect(await readFile(join(directory, path), 'utf8')).toBe(content)
  })

  it('prints one machine-readable snapshot and plan envelope through the actual CLI', async () => {
    const readResult = await runCli(['read', '--path', path], directory)
    expect(readResult.code, readResult.stderr).toBe(0)
    const snapshot = envelope(readResult, 'flowReadSuccess')
    const request = { schemaVersion: 1, path, expectedRevision: snapshot.data.revision, projectRevision: snapshot.data.projectRevision, commands: [{ type: 'set-title', title: 'Review me' }] }
    const planResult = await runCli(['plan', '--request', JSON.stringify(request)], directory)
    expect(planResult.code, planResult.stderr).toBe(0)
    const planned = envelope(planResult, 'flowPlanSuccess')
    expect(planned).toMatchObject({ command: 'flow.plan', ok: true, data: { request, valid: true, changes: { chapterFields: ['title'] } } })
    expect(await readFile(join(directory, path), 'utf8')).toBe(content)
  }, 45000)

  it('reports stale input as a structured failure with a nonzero exit', async () => {
    const request = await requestFor([{ type: 'set-title', title: 'Changed' }])
    await writeFile(join(directory, path), `${content} `)
    const result = await runCli(['plan', '--request', JSON.stringify(request)], directory)
    expect(result.code, result.stderr).toBe(1)
    expect(envelope(result, 'flowPlanFailure')).toMatchObject({ ok: false, errors: [{ code: 'ADV_VALIDATION', details: { code: 'ADV_FLOW_SOURCE_CONFLICT' } }] })
    expect(await readFile(join(directory, path), 'utf8')).toBe(`${content} `)
  }, 25000)

  it('retains invalid-plan diagnostics with a nonzero exit and no writes', async () => {
    const request = await requestFor([{ type: 'connect', nodeId: 'hello', target: 'missing' }])
    const result = await runCli(['plan', '--request', JSON.stringify(request)], directory)
    expect(result.code, result.stderr).toBe(1)
    expect(envelope(result, 'flowPlanSuccess')).toMatchObject({ ok: true, data: { valid: false, diagnostics: expect.arrayContaining([expect.objectContaining({ severity: 'error' })]) } })
    expect(await readFile(join(directory, path), 'utf8')).toBe(content)
  }, 25000)
})
