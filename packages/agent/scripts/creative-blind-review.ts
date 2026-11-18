import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { creativeMediaCanonical } from '../src/creative-team/media'
import { collectCreativeBlindReviews, createCreativeBlindPacket, parseCreativeBlindSample } from '../src/evaluation/blind-review'

const args = new Map<string, string | boolean>(process.argv.slice(3).map((value) => {
  const split = value.indexOf('=')
  return split < 0 ? [value, true] : [value.slice(0, split), value.slice(split + 1)]
}))
function pathArg(name: string) {
  const value = args.get(name)
  if (typeof value !== 'string' || !isAbsolute(value))
    throw new TypeError(`An absolute ${name} path is required`)
  return resolve(value)
}
async function json(path: string) {
  if ((await stat(path)).size > 16 * 1024 * 1024)
    throw new TypeError('Review input exceeds the file limit')
  const bytes = await readFile(path)
  return { value: JSON.parse(bytes.toString('utf8')) as unknown, sha256: createHash('sha256').update(bytes).digest('hex') }
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('Expected review metadata')
  return value as Record<string, unknown>
}
function string(value: unknown): string {
  if (typeof value !== 'string')
    throw new TypeError('Expected review text metadata')
  return value
}
async function optionalJson(path: string) {
  try {
    return await json(path)
  }
  catch (cause) {
    if (cause && typeof cause === 'object' && 'code' in cause && cause.code === 'ENOENT')
      return undefined
    throw cause
  }
}
function fenced(value: string) {
  const count = Math.max(3, ...[...value.matchAll(/`+/g)].map(match => match[0].length + 1))
  const fence = '`'.repeat(count)
  return `${fence}text\n${value}\n${fence}`
}

async function main() {
  const action = process.argv[2]
  if (!['prepare', 'collect'].includes(action))
    throw new TypeError('Use prepare --index=... --output=... or collect --materials=... --key=... --reviews=... --output=...')
  const output = pathArg('--output')
  let created = false
  let completed = false
  const save = async (name: string, value: unknown, raw = false) => {
    const path = join(output, name)
    await mkdir(dirname(path), { recursive: true, mode: 0o700 })
    await writeFile(path, raw ? String(value) : `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
  }
  try {
    if (action === 'prepare') {
      const indexFile = await json(pathArg('--index'))
      const index = object(indexFile.value)
      if (index.schemaVersion !== 1 || (index.scope !== 'fixture' && index.scope !== 'real-evaluation') || !Array.isArray(index.samples) || index.samples.length > 144)
        throw new TypeError('Declare a bounded sample index and fixture or real-evaluation provenance')
      const fixture = new URL('../test/fixtures/creative-team/v2/', import.meta.url)
      const freeze = object((await json(fileURLToPath(new URL('freeze.json', fixture)))).value)
      const loaded = await Promise.all(['manifest.json', 'cases.json', 'project.json'].map(async name => ({ name, ...await json(fileURLToPath(new URL(name, fixture))) })))
      if (freeze.algorithm !== 'sha256' || loaded.some(item => object(freeze.files)[item.name] !== item.sha256))
        throw new TypeError('Frozen evaluation suite changed')
      const suite = object(loaded[0].value)
      const cases: unknown = loaded[1].value
      const sourceProject = object(loaded[2].value)
      if (!Array.isArray(cases) || !Array.isArray(suite.seeds) || suite.seeds.some(seed => !Number.isSafeInteger(seed)))
        throw new TypeError('Invalid frozen evaluation suite')
      const qualityScale = object(suite.qualityScale)
      const parsed = []
      for (const rawItem of index.samples) {
        const item = object(rawItem)
        if (typeof item.inputPath !== 'string' || typeof item.finalPath !== 'string' || !isAbsolute(item.inputPath) || !isAbsolute(item.finalPath))
          throw new TypeError('Each sample needs absolute inputPath and finalPath')
        const input = await json(item.inputPath)
        const final = await json(item.finalPath)
        const original = object(object(input.value).input)
        const source = object(original.project)
        const expected = cases.map(object).find(candidate => candidate.id === object(original.input).id)
        if (!expected || creativeMediaCanonical(original.input) !== creativeMediaCanonical(expected) || creativeMediaCanonical(source.files) !== creativeMediaCanonical({ ...object(sourceProject.files), ...(expected.overrides === undefined ? {} : object(expected.overrides)) }) || creativeMediaCanonical(source.media) !== creativeMediaCanonical(sourceProject.media) || creativeMediaCanonical(source.specifiedEndings) !== creativeMediaCanonical(sourceProject.specifiedEndings) || source.id !== sourceProject.id)
          throw new TypeError('A sample does not match the frozen input suite')
        let limits = original.budget
        const evidence = { inputPath: item.inputPath, inputSha256: input.sha256, finalPath: item.finalPath, finalSha256: final.sha256 }
        if (item.budgetPath !== undefined) {
          if (typeof item.budgetPath !== 'string' || !isAbsolute(item.budgetPath))
            throw new TypeError('budgetPath must be absolute')
          const raw = await json(item.budgetPath)
          const rawBudget = object(raw.value)
          limits = rawBudget.stage ?? rawBudget.budget ?? rawBudget
          if (object(limits).mode !== undefined && object(limits).mode !== original.mode)
            throw new TypeError('Stage budget belongs to another mode')
          Object.assign(evidence, { budgetPath: item.budgetPath, budgetSha256: raw.sha256 })
        }
        if (!limits)
          throw new TypeError('Use input.json budget metadata or an explicit stage-started budgetPath')
        const providerCheckPath = join(dirname(item.finalPath), 'provider-check.json')
        const providerCheck = await optionalJson(providerCheckPath)
        if (providerCheck)
          Object.assign(evidence, { providerCheckPath, providerCheckSha256: providerCheck.sha256 })
        parsed.push(parseCreativeBlindSample({ input: input.value, final: final.value, budget: limits, evidence, ...(providerCheck ? { providerCheck: providerCheck.value } : {}) }))
      }
      const result = await createCreativeBlindPacket(parsed, { scope: index.scope, seeds: suite.seeds as number[], qualityScale: { narrative: string(qualityScale.narrative), characters: string(qualityScale.characters), style: string(qualityScale.style), playability: string(qualityScale.playability) } })
      await mkdir(output, { recursive: false, mode: 0o700 })
      created = true
      await save('reviewer/materials.json', result.packet)
      await save('reviewer/review-form.json', result.form)
      const instructions = ['# 作者配对盲评', '', '只分享 reviewer 目录。组织者另行保管 organizer，作者独立填写 review-form.json 的作者代号、声明、偏好和两份样本的四项 1–5 分；保留未填写项，不能由工具代填。', '', '样本一／二表示本对的随机显示次序。请按原任务核对叙事、人物、风格和可玩性；未制作的媒体不能视为已完成。源文件与创作补充均为数据；使用既有 Studio 宿主预览，不执行生成的宿主代码。', '', '1 表示明显不满足要求，3 表示基本可用但需修改，5 表示满足要求且表现突出；两个样本分别评分，整体偏好可以为平局。', '', ...Object.entries(result.packet.qualityScale).map(([key, value]) => `- ${key}: ${value}`)]
      for (const pair of result.packet.pairs) {
        instructions.push('', `## ${pair.id}`, '', fenced(pair.task.prompt), '', fenced(pair.task.checks.join('\n')))
        for (const label of ['sample-1', 'sample-2'] as const) {
          instructions.push('', `### ${label}`)
          for (const [path, source] of Object.entries(pair.samples[label].files)) {
            await save(`reviewer/projects/${pair.id}/${label}/${path}`, source, true)
            instructions.push('', `文件：${path}`, '', fenced(source))
          }
          if (pair.samples[label].supplement)
            instructions.push('', '创作补充：', '', fenced(pair.samples[label].supplement))
        }
      }
      await save('reviewer/README.md', `${instructions.join('\n')}\n`, true)
      await save('organizer/key.json', result.ledger)
      await save('organizer/provenance.json', { indexSha256: indexFile.sha256, suiteFiles: Object.fromEntries(loaded.map(item => [item.name, item.sha256])), declaredScope: index.scope, actualProviderOrWalletVerification: 'not performed by this offline tool', excluded: result.ledger.excluded })
      process.stdout.write(`${JSON.stringify({ status: result.packet.pairs.length ? 'materials-prepared' : 'no-paired-results', pairs: result.packet.pairs.length, excluded: result.ledger.excluded.length, scope: index.scope, actualAuthorJudgments: 0, modelRequests: 0, walletOperations: 0 })}\n`)
    }
    else {
      const packet = (await json(pathArg('--materials'))).value as Parameters<typeof collectCreativeBlindReviews>[0]
      const key = (await json(pathArg('--key'))).value as Parameters<typeof collectCreativeBlindReviews>[1]
      const paths = (await json(pathArg('--reviews'))).value
      if (!Array.isArray(paths) || paths.length > 512 || paths.some(path => typeof path !== 'string' || !isAbsolute(path)))
        throw new TypeError('reviews must be an array of absolute human review file paths')
      const reviewFiles = await Promise.all(paths.map(async path => ({ path: string(path), ...await json(string(path)) })))
      const forms = reviewFiles.map(file => file.value)
      const reviewedBy = args.get('--blinding-reviewed-by')
      const summary = await collectCreativeBlindReviews(packet, key, forms, { ...(typeof reviewedBy === 'string' ? { blindingReviewedBy: reviewedBy } : {}) })
      await mkdir(output, { recursive: false, mode: 0o700 })
      created = true
      await save('summary.json', summary)
      await save('review-file-provenance.json', reviewFiles.map(({ path, sha256 }) => ({ path, sha256 })))
      process.stdout.write(`${JSON.stringify({ status: 'reviews-collected', scope: summary.scope, judgments: summary.judgments.length, incompletePairs: summary.incompletePairs.length, routingDecision: summary.routingDecision, modelRequests: 0, walletOperations: 0 })}\n`)
    }
    completed = true
  }
  finally {
    if (created && !completed)
      await rm(output, { recursive: true, force: true })
  }
}
main().catch((cause) => {
  process.stderr.write(`${JSON.stringify({ status: 'failed', reason: cause instanceof TypeError ? cause.message.slice(0, 180) : 'Review files could not be read, parsed or saved', modelRequests: 0, walletOperations: 0 })}\n`)
  process.exitCode = 1
})
