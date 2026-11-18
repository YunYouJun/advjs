import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import process from 'node:process'

const root = new URL('../test/fixtures/creative-team/v2/', import.meta.url)
const freeze = JSON.parse(await readFile(new URL('freeze.json', root), 'utf8'))
for (const [file, expected] of Object.entries(freeze.files)) {
  const actual = createHash('sha256').update(await readFile(new URL(file, root))).digest('hex')
  if (actual !== expected)
    throw new Error(`Frozen evaluation input changed: ${file}; create a new suite version instead`)
}
const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'))
const cases = JSON.parse(await readFile(new URL('cases.json', root), 'utf8'))
if (new Set(cases.map(item => item.id)).size !== 24
  || ['local', 'chapter', 'short-story'].some(category => cases.filter(item => item.category === category).length !== 8)
  || manifest.seeds.length < 3) {
  throw new Error('Expected 24 inputs, 8 per category, at least 3 seeds')
}
// This command never invokes a model. The explicit adapter owns authorized execution.
process.stdout.write(`${JSON.stringify({ suiteId: manifest.suiteId, status: manifest.status, cases: cases.length, primaryRuns: cases.length * manifest.seeds.length * 2, referenceRuns: cases.length * manifest.seeds.length, paidCalls: 0, defaultMode: 'single-role', result: 'input audit only; no quality evidence' }, null, 2)}\n`)
