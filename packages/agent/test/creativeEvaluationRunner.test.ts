import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'
import { createCreativeEvaluationFileSink } from '../src/evaluation/node'

const exec = promisify(execFile)
const runner = fileURLToPath(new URL('../scripts/run-creative-evaluation.mjs', import.meta.url))
const versions = { model: 'fixture', prompts: 'fixture', tools: 'fixture', runtime: 'fixture', project: 'fixture' }
async function temporary(work: (root: string) => Promise<void>) {
  const root = await mkdtemp(`${tmpdir()}/advjs-evaluation-runner-`)
  try {
    await work(root)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
}
async function fixture(root: string, result: string, ready = true) {
  const adapter = `${root}/adapter.mjs`
  const config = `${root}/versions.json`
  const marker = `${root}/calls.jsonl`
  await writeFile(config, JSON.stringify(versions))
  await writeFile(adapter, `import { appendFile } from 'node:fs/promises'\nexport async function preflight({ versions, modes }) { return { ready: ${ready}, noDispatch: true, modes, versions } }\nexport async function run() { await appendFile(${JSON.stringify(marker)}, 'fixture-call\\n'); ${result} }\n`)
  return { adapter, marker, config, output: `${root}/output` }
}
const completed = `return { outcome: 'completed', consumption: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costMicroCny: 1, toolCalls: 2, latencyMs: 1, reworkRounds: 0 }, evidence: ['explicit-local-fixture-only'] }`
async function invoke(paths: Awaited<ReturnType<typeof fixture>>, extra: string[] = [], execute = true) {
  return exec(process.execPath, [runner, '--cases=local-01', '--modes=B', '--seeds=1729', `--adapter=${paths.adapter}`, `--versions=${paths.config}`, `--output=${paths.output}`, ...(execute ? ['--execute', '--authorized-max-micro-cny=1000000'] : ['--preflight']), ...extra])
}

describe('evaluation runner readiness and immutable evidence', () => {
  it('preflights without dispatch, writing a journal, or requiring spending authorization', async () => temporary(async (root) => {
    const paths = await fixture(root, completed)
    const result = await invoke(paths, [], false)
    expect(result.stdout).toContain('adapter-preflight')
    expect(result.stdout).toContain('"executionAuthorized":false')
    await expect(readFile(paths.marker)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(readFile(`${paths.output}/runs.jsonl`)).rejects.toMatchObject({ code: 'ENOENT' })
  }))

  it('rejects unavailable adapters before any fixture dispatch', async () => temporary(async (root) => {
    const paths = await fixture(root, completed, false)
    await expect(invoke(paths)).rejects.toThrow('Adapter is not ready')
    await expect(readFile(paths.marker)).rejects.toMatchObject({ code: 'ENOENT' })
  }))

  it('skips a finished fixture and stops an unknown outcome without silently repeating it', async () => temporary(async (root) => {
    const paths = await fixture(root, completed)
    await invoke(paths)
    await invoke(paths)
    expect((await readFile(paths.marker, 'utf8')).trim().split('\n')).toHaveLength(1)
  }))

  it('does not repeat a dispatched fixture with an unknown outcome', async () => temporary(async (root) => {
    const paths = await fixture(root, `throw new Error('fixture outcome unknown')`)
    await expect(invoke(paths)).rejects.toThrow('fixture outcome unknown')
    await expect(invoke(paths)).rejects.toThrow('earlier paid outcome is unknown')
    expect((await readFile(paths.marker, 'utf8')).trim().split('\n')).toHaveLength(1)
  }))

  it('checks actual totalTokens and freezes an over-cap journal until reconciliation', async () => temporary(async (root) => {
    const paths = await fixture(root, completed.replace('totalTokens: 2', 'totalTokens: 12001'))
    await expect(invoke(paths)).rejects.toThrow('cap exceeded')
    const events = (await readFile(`${paths.output}/runs.jsonl`, 'utf8')).trim().split('\n').map(line => JSON.parse(line))
    expect(events[1].withinCap).toBe(false)
    await expect(invoke(paths)).rejects.toThrow('Earlier cap violation')
    expect((await readFile(paths.marker, 'utf8')).trim().split('\n')).toHaveLength(1)
  }))

  it('does not accept missing or incomplete usage as a completed result', async () => temporary(async (root) => {
    const paths = await fixture(root, completed.replace('totalTokens: 2', 'totalTokens: 1'))
    await expect(invoke(paths)).rejects.toThrow('Incomplete total token accounting')
    const events = (await readFile(`${paths.output}/runs.jsonl`, 'utf8')).trim().split('\n').map(line => JSON.parse(line))
    expect(events.map(event => event.type)).toEqual(['started'])
  }))

  it('rejects a second execution while an exclusive run lock exists', async () => temporary(async (root) => {
    const paths = await fixture(root, completed)
    await mkdir(paths.output)
    await writeFile(`${paths.output}/.evaluation.lock`, JSON.stringify({ pid: process.pid }))
    await expect(invoke(paths)).rejects.toThrow('EEXIST')
    await expect(readFile(paths.marker)).rejects.toMatchObject({ code: 'ENOENT' })
  }))

  it('uses exclusive evidence creation and rejects traversal instead of overwriting prior outcomes', async () => temporary(async (root) => {
    const sink = createCreativeEvaluationFileSink(root)
    const file = await sink.write('local-01:1729:B/input.json', { fixture: true })
    await expect(sink.write('local-01:1729:B/input.json', { replaced: true })).rejects.toMatchObject({ code: 'EEXIST' })
    await expect(sink.write('../escape/input.json', {})).rejects.toThrow('name')
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ fixture: true })
  }))

  it('persists a provider invalidation independently without replacing known usage evidence', async () => temporary(async (root) => {
    const sink = createCreativeEvaluationFileSink(root)
    const final = await sink.write('local-01:1729:B/final.json', { consumption: { costMicroCny: 25 } })
    const check = await sink.write('local-01:1729:B/provider-check.json', { executionOutcome: 'completed', result: { outcome: 'system', consumption: { costMicroCny: 25 } } })
    await expect(sink.write('local-01:1729:B/provider-check.json', {})).rejects.toMatchObject({ code: 'EEXIST' })
    expect(JSON.parse(await readFile(final, 'utf8')).consumption.costMicroCny).toBe(25)
    expect(JSON.parse(await readFile(check, 'utf8')).result.outcome).toBe('system')
  }))
})
