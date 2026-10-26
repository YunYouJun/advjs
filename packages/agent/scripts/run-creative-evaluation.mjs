import { createHash } from 'node:crypto'
import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

// This runner has no provider integration. Execution requires a trusted adapter
// and a separately approved aggregate ceiling; default invocation is free audit.
const args = new Map(process.argv.slice(2).map((argument) => {
  const index = argument.indexOf('=')
  return index < 0 ? [argument, true] : [argument.slice(0, index), argument.slice(index + 1)]
}))
await import('./audit-creative-baseline.mjs')
const root = new URL('../test/fixtures/creative-team/v2/', import.meta.url)
const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'))
const allCases = JSON.parse(await readFile(new URL('cases.json', root), 'utf8'))
const project = JSON.parse(await readFile(new URL('project.json', root), 'utf8'))
const caseIds = args.has('--cases') ? String(args.get('--cases')).split(',') : allCases.map(item => item.id)
if (!caseIds.length || caseIds.some(id => !allCases.some(item => item.id === id)))
  throw new Error('Unknown evaluation case')
const cases = allCases.filter(item => caseIds.includes(item.id))
const modes = args.has('--modes') ? String(args.get('--modes')).split(',') : ['B', 'C']
const seeds = args.has('--seeds') ? String(args.get('--seeds')).split(',').map(Number) : manifest.seeds
if (!modes.length || !seeds.length || new Set(modes).size !== modes.length || new Set(seeds).size !== seeds.length
  || modes.some(mode => !['A', 'B', 'C'].includes(mode)) || seeds.some(seed => !manifest.seeds.includes(seed))) {
  throw new Error('Unknown mode or non-frozen seed')
}
const runs = cases.flatMap(input => seeds.flatMap(seed => modes.map(mode => ({ input, seed, mode, key: `${input.id}:${seed}:${mode}`, budget: manifest.budgets[input.category] }))))
const ceiling = runs.reduce((sum, run) => sum + run.budget.maxMicroCny, 0)
process.stdout.write(`${JSON.stringify({ status: 'execution-plan', suite: manifest.suiteId, runs: runs.length, proposedCeilingMicroCny: ceiling, executionAuthorized: args.has('--execute') })}\n`)
if (!args.has('--execute'))
  process.exit(0)
const approved = Number(args.get('--authorized-max-micro-cny'))
if (!Number.isSafeInteger(approved) || approved < ceiling)
  throw new Error('Explicit aggregate authorization must cover every selected run ceiling')
for (const key of ['--adapter', '--versions', '--output']) {
  if (typeof args.get(key) !== 'string' || !isAbsolute(args.get(key)))
    throw new Error(`${key} must be an absolute path`)
}
const versions = JSON.parse(await readFile(args.get('--versions'), 'utf8'))
for (const key of ['model', 'prompts', 'tools', 'runtime', 'project']) {
  if (typeof versions[key] !== 'string' || !versions[key] || /required-at-execution|unknown|pending/.test(versions[key]))
    throw new Error(`Effective ${key} version is required before execution`)
}
const adapter = await import(pathToFileURL(args.get('--adapter')).href)
if (typeof adapter.run !== 'function')
  throw new Error('Trusted adapter must export async run(input, { signal, budget, versions })')
const output = resolve(args.get('--output'))
await mkdir(output, { recursive: true })
const journal = resolve(output, 'runs.jsonl')
let previous = []
try {
  previous = (await readFile(journal, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
}
catch (error) {
  if (error.code !== 'ENOENT')
    throw error
}
const inputFingerprint = createHash('sha256').update(JSON.stringify({ manifest, cases: allCases, project, versions })).digest('hex')
if (previous.some(event => event.inputFingerprint !== inputFingerprint))
  throw new Error('Existing results use another input or tool/model version; use another output directory')
const started = new Set(previous.filter(event => event.type === 'started').map(event => event.key))
const finished = new Set(previous.filter(event => event.type === 'finished').map(event => event.key))
if ([...started].some(key => !finished.has(key)))
  throw new Error('An earlier paid outcome is unknown. Reconcile the journal before resuming; no automatic retry')
const log = async event => appendFile(journal, `${JSON.stringify({ ...event, inputFingerprint, suiteId: manifest.suiteId, at: new Date().toISOString() })}\n`)
for (const run of runs) {
  if (finished.has(run.key))
    continue
  await log({ type: 'started', key: run.key, versions, budget: run.budget })
  const startedAt = Date.now()
  const result = await adapter.run({ ...run, project: { ...project, files: { ...project.files, ...run.input.overrides } } }, { signal: AbortSignal.timeout(run.budget.deadlineMs), budget: run.budget, versions })
  if (!result || !['completed', 'generation-quality', 'system', 'provider', 'billing', 'cancelled'].includes(result.outcome))
    throw new Error('Adapter result must separate generation quality from system/provider/billing failure')
  for (const key of ['inputTokens', 'outputTokens', 'costMicroCny', 'toolCalls', 'latencyMs', 'reworkRounds']) {
    if (!Number.isSafeInteger(result.consumption?.[key]) || result.consumption[key] < 0)
      throw new Error(`Missing verified accounting: ${key}; reconcile before resuming`)
  }
  if (!Array.isArray(result.evidence) || !result.evidence.length)
    throw new Error('Result evidence is required')
  const withinCap = result.consumption.costMicroCny <= run.budget.maxMicroCny
    && result.consumption.inputTokens + result.consumption.outputTokens <= run.budget.maxTotalTokens
    && Date.now() - startedAt <= run.budget.deadlineMs
  await log({ type: 'finished', key: run.key, result, withinCap, versions, elapsedMs: Date.now() - startedAt })
  if (!withinCap)
    throw new Error('Evaluation budget/latency cap exceeded; stop rather than concealing an overrun')
}
