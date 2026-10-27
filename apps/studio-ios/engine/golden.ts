/**
 * Generate golden cases and Node's expected responses for the JavaScriptCore
 * parity tests, after checking the bundle against them in a Node sandbox.
 *
 * Usage: pnpm -C apps/studio-ios golden   (run build:engine first)
 * Output: engine/dist/golden/{cases,expected,summary}.json, copied into the
 * StudioKit test bundle
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { createGoldenCases, runGoldenCases } from './golden/cases'
import { loadEngineSandbox } from './golden/sandbox'
import { call } from './src/index'
import { engineDist, engineRoot } from './workspace'

async function main() {
  const cases = await createGoldenCases(call)
  const expected = await runGoldenCases(call, cases)

  const bundle = await readFile(resolve(engineDist, 'engine.js'), 'utf8')
  const sandbox = loadEngineSandbox(bundle)
  const bundled = await runGoldenCases(sandbox.call, cases)
  const mismatches = cases.filter(item => bundled[item.name] !== expected[item.name]).map(item => item.name)

  const sha = (value: string) => createHash('sha256').update(value).digest('hex')
  const casesJson = JSON.stringify(cases)
  const expectedJson = JSON.stringify(expected)
  const errors = Object.entries(expected).filter(([, value]) => !JSON.parse(value).ok).map(([name]) => name)
  const summary = {
    cases: cases.length,
    casesSha256: sha(casesJson),
    expectedSha256: sha(expectedJson),
    engineSha256: sha(bundle),
    sandboxMismatches: mismatches,
    errorResponses: errors,
    sandboxGlobals: sandbox.globals,
  }

  // One copy for inspection, one inside the Swift test bundle for JavaScriptCore.
  for (const out of [resolve(engineDist, 'golden'), resolve(engineRoot, '../Packages/StudioKit/Tests/StudioKitTests/Golden')]) {
    await mkdir(out, { recursive: true })
    await writeFile(resolve(out, 'cases.json'), casesJson)
    await writeFile(resolve(out, 'expected.json'), expectedJson)
    await writeFile(resolve(out, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
  if (mismatches.length > 0)
    throw new Error(`Bundled engine differs from sources in ${mismatches.length} case(s)`)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
})
