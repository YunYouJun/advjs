import type { CreativeBlindLedger, CreativeBlindPacket } from '../src/evaluation/blind-review'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'

const exec = promisify(execFile)
const runner = fileURLToPath(new URL('../scripts/creative-blind-review.mjs', import.meta.url))
const fixtureRoot = new URL('./fixtures/creative-team/v2/', import.meta.url)
const versions = { model: 'fixture-model-private', prompts: 'fixture-prompts-private', tools: 'fixture-tools-private', runtime: 'fixture-runtime-private', project: 'fixture-project-private' }
const consumption = { inputTokens: 10, outputTokens: 5, totalTokens: 15, costMicroCny: 25, toolCalls: 3, latencyMs: 10, reworkRounds: 0 }
async function temporary(work: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), 'advjs-blind-review-cli-'))
  try {
    await work(root)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
}
async function save(root: string, name: string, value: unknown) {
  const path = join(root, name)
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
  return path
}
async function json(path: string) {
  return JSON.parse(await readFile(path, 'utf8'))
}
async function inputs(root: string) {
  const cases = JSON.parse(await readFile(new URL('cases.json', fixtureRoot), 'utf8'))
  const project = JSON.parse(await readFile(new URL('project.json', fixtureRoot), 'utf8'))
  const input = cases[0]
  const samples = []
  for (const mode of ['B', 'C'] as const) {
    // B's actual final format omits the identity repeated by C. Reverse the
    // source object's key order to check semantic, rather than textual, equality.
    const source = { ...project, files: Object.fromEntries(Object.entries({ ...project.files, ...input.overrides }).reverse()) }
    const inputPath = await save(root, `${mode}/input.json`, { input: { input, mode, seed: 1729, key: `${input.id}:1729:${mode}`, project: source }, versions })
    const files = { ...source.files, 'adv/chapters/station.adv.md': `# 车站 {#arrival}\n\n林舟：「请再等一会儿。」\n` }
    const finalPath = await save(root, `${mode}/final.json`, { outcome: 'completed', summary: '请核对雨夜的节奏。', project: { id: project.id, files }, consumption, ...(mode === 'C' ? { caseId: input.id, category: input.category, mode, seed: 1729, versions, run: { artifacts: [] } } : {}) })
    const budgetPath = await save(root, `${mode}/stage-started.json`, { stage: { id: `local-${mode}`, mode, maxTotalTokens: 12000, maxMicroCny: 130000, maxMicroPoints: 200000, deadlineMs: 180000 } })
    samples.push({ inputPath, finalPath, budgetPath })
  }
  const index = await save(root, 'index.json', { schemaVersion: 1, scope: 'fixture', samples })
  // Both wrapper and source subprocess inherit the same deny guard. Any HTTP
  // attempt would leave a marker and fail, even when unrelated local credentials exist.
  const marker = join(root, 'network-attempt')
  const guard = join(root, 'deny-network.mjs')
  await writeFile(guard, `import http from 'node:http'; import https from 'node:https'; import {syncBuiltinESMExports} from 'node:module'; import {writeFileSync} from 'node:fs'; const deny=()=>{writeFileSync(${JSON.stringify(marker)},'unexpected network'); throw new Error('OFFLINE_REVIEW_NETWORK_DENIED')}; globalThis.fetch=deny; http.request=deny; http.get=deny; https.request=deny; https.get=deny; syncBuiltinESMExports();\n`)
  const invoke = (args: string[]) => exec(process.execPath, [runner, ...args], { env: { ...process.env, NODE_OPTIONS: `--import=${guard}` } })
  return { index, samples, marker, invoke, output: join(root, 'packet') }
}

describe('offline paired author review command', () => {
  it('exports source data and blank forms, then unblinds explicitly synthetic scores through the source-only CLI', async () => temporary(async (root) => {
    const paths = await inputs(root)
    const prepared = await paths.invoke(['prepare', `--index=${paths.index}`, `--output=${paths.output}`])
    expect(JSON.parse(prepared.stdout)).toMatchObject({ status: 'materials-prepared', pairs: 1, scope: 'fixture', actualAuthorJudgments: 0, modelRequests: 0, walletOperations: 0 })
    const packet: CreativeBlindPacket = await json(join(paths.output, 'reviewer/materials.json'))
    const key: CreativeBlindLedger = await json(join(paths.output, 'organizer/key.json'))
    const blank = await json(join(paths.output, 'reviewer/review-form.json'))
    expect(blank.authorId).toBe('')
    expect(blank.reviews[0].preferred).toBeNull()
    expect(blank.declaration).toEqual({ human: false, independent: false, modeUndisclosed: false })
    const readme = await readFile(join(paths.output, 'reviewer/README.md'), 'utf8')
    for (const hidden of [...Object.values(versions), 'maxMicroPoints', 'chargedMicroPoints', 'local-01:1729:B', paths.samples[0].finalPath]) {
      expect(JSON.stringify(packet)).not.toContain(hidden)
      expect(readme).not.toContain(hidden)
    }
    const exported = join(paths.output, 'reviewer/projects', packet.pairs[0].id, 'sample-1/adv/chapters/station.adv.md')
    expect(await readFile(exported, 'utf8')).toContain('请再等一会儿')
    expect(await readdir(join(paths.output, 'reviewer'))).not.toContain('key.json')
    const reviewers = await Promise.all(['fixture-author-a', 'fixture-author-b'].map((authorId, index) => save(root, `${authorId}.json`, { ...blank, authorId, declaration: { human: true, independent: true, modeUndisclosed: true }, reviews: blank.reviews.map((item: { pairId: string }) => ({ pairId: item.pairId, preferred: 'sample-2', scores: { 'sample-1': { narrative: 2, characters: 3, style: 3, playability: 4 }, 'sample-2': { narrative: 4, characters: 5, style: 4, playability: 4 } }, notes: `synthetic-only ${index}` })) })))
    const reviews = await save(root, 'reviews.json', reviewers)
    const output = join(root, 'collected')
    const result = await paths.invoke(['collect', `--materials=${join(paths.output, 'reviewer/materials.json')}`, `--key=${join(paths.output, 'organizer/key.json')}`, `--reviews=${reviews}`, `--output=${output}`, '--blinding-reviewed-by=fixture-organizer'])
    expect(JSON.parse(result.stdout)).toMatchObject({ judgments: 2, scope: 'fixture', incompletePairs: 0, routingDecision: 'unchanged' })
    const collected = await json(join(output, 'summary.json'))
    expect(collected.judgments[0]).toMatchObject({ preferred: key.pairs[0].modes['sample-2'], scores: { [key.pairs[0].modes['sample-2']]: { narrative: 4 } } })
    expect(collected.humanEvidence).toContain('fixture-only')
    expect(collected.blinding.readyForInterpretation).toBe(false)
    expect(collected.byCategory.local).toMatchObject({ inputs: 0, evidenceSufficient: false })
    const provenance = await json(join(output, 'review-file-provenance.json'))
    expect(provenance[0].sha256).toBe(createHash('sha256').update(await readFile(reviewers[0])).digest('hex'))
    await expect(readFile(paths.marker)).rejects.toMatchObject({ code: 'ENOENT' })
  }))

  it('rejects changed source/budgets and preserves an existing output instead of replacing it', async () => temporary(async (root) => {
    const paths = await inputs(root)
    const value = await json(paths.samples[1].budgetPath)
    value.stage.maxTotalTokens++
    await writeFile(paths.samples[1].budgetPath, JSON.stringify(value))
    await expect(paths.invoke(['prepare', `--index=${paths.index}`, `--output=${paths.output}`])).rejects.toThrow('Command failed')
    await expect(readdir(paths.output)).rejects.toMatchObject({ code: 'ENOENT' })
    value.stage.maxTotalTokens--
    await writeFile(paths.samples[1].budgetPath, JSON.stringify(value))
    const originalSource = await readFile(paths.samples[1].inputPath, 'utf8')
    const changed = JSON.parse(originalSource)
    changed.input.project.files['adv/world.md'] = 'not the frozen world'
    await writeFile(paths.samples[1].inputPath, JSON.stringify(changed))
    await expect(paths.invoke(['prepare', `--index=${paths.index}`, `--output=${paths.output}`])).rejects.toThrow('Command failed')
    await expect(readdir(paths.output)).rejects.toMatchObject({ code: 'ENOENT' })
    await writeFile(paths.samples[1].inputPath, originalSource)
    await mkdir(paths.output)
    await writeFile(join(paths.output, 'unique-user-file'), 'preserve')
    await expect(paths.invoke(['prepare', `--index=${paths.index}`, `--output=${paths.output}`])).rejects.toThrow('Command failed')
    expect(await readdir(paths.output)).toEqual(['unique-user-file'])
    expect(await readFile(join(paths.output, 'unique-user-file'), 'utf8')).toBe('preserve')
    await expect(readFile(paths.marker)).rejects.toMatchObject({ code: 'ENOENT' })
  }))

  it('honors separate provider invalidation and reports an unpaired sample without inventing judgments', async () => temporary(async (root) => {
    const paths = await inputs(root)
    await save(root, 'B/provider-check.json', { executionOutcome: 'completed', result: { outcome: 'system', consumption } })
    const result = await paths.invoke(['prepare', `--index=${paths.index}`, `--output=${paths.output}`])
    expect(JSON.parse(result.stdout)).toMatchObject({ status: 'no-paired-results', pairs: 0, excluded: 1, actualAuthorJudgments: 0 })
    expect((await json(join(paths.output, 'organizer/key.json'))).excluded).toMatchObject([{ reason: 'system' }])
    const index = await json(paths.index)
    index.samples.pop()
    await writeFile(paths.index, JSON.stringify(index))
    const missing = join(root, 'missing-pair')
    await paths.invoke(['prepare', `--index=${paths.index}`, `--output=${missing}`])
    expect((await json(join(missing, 'organizer/key.json'))).excluded).toMatchObject([{ reason: 'missing-paired-result' }])
    expect((await json(join(missing, 'reviewer/review-form.json'))).reviews).toEqual([])
    await expect(readFile(paths.marker)).rejects.toMatchObject({ code: 'ENOENT' })
  }))

  it('refuses blank declarations and altered assignments before creating a collection directory', async () => temporary(async (root) => {
    const paths = await inputs(root)
    await paths.invoke(['prepare', `--index=${paths.index}`, `--output=${paths.output}`])
    const materials = join(paths.output, 'reviewer/materials.json')
    const key = join(paths.output, 'organizer/key.json')
    const reviews = await save(root, 'reviews.json', [join(paths.output, 'reviewer/review-form.json')])
    const output = join(root, 'invalid-collection')
    const args = ['collect', `--materials=${materials}`, `--key=${key}`, `--reviews=${reviews}`, `--output=${output}`]
    await expect(paths.invoke(args)).rejects.toThrow('Command failed')
    const ledger = await json(key)
    ledger.pairs[0].modes['sample-1'] = ledger.pairs[0].modes['sample-2']
    await writeFile(key, JSON.stringify(ledger))
    await expect(paths.invoke(args)).rejects.toThrow('Command failed')
    await expect(readdir(output)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(readFile(paths.marker)).rejects.toMatchObject({ code: 'ENOENT' })
  }))
})
