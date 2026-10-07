import { writeFileSync } from 'node:fs'
import process from 'node:process'
import { consola } from 'consola'
import { resolve } from 'pathe'
import { runCheck } from '../packages/advjs/node/commands/check'

const repository = resolve(import.meta.dirname, '..')
const examples = [
  ['demo/starter'],
  ['demo/hamster'],
  ['demo/love'],
  ['demo/md'],
  ['demo/ai'],
  ['demo/flow'],
  ['examples/ai-contest/history-talk'],
  ['examples/ai-contest/life-story'],
  ['examples/ai-contest/murder-mystery'],
  ['examples/singlefile'],
  ['examples/singlefile-script', '.'],
  ['examples/adv-format', '.'],
  ['packages/advjs/template'],
  ['packages/advjs/template-galgame'],
] as const

const reports = []
for (const [example, root] of examples) {
  try {
    const result = await runCheck({ cwd: resolve(repository, example), root })
    const errors = result.issues.filter(issue => issue.type === 'error').length
    const uncertain = result.issues.filter(issue => issue.certainty === 'uncertain').length
    reports.push({ example, scriptCount: result.scriptCount, passed: result.passed, errors, warnings: result.issues.length - errors, uncertain, issues: result.issues })
    consola.log(`${example}: ${result.scriptCount} scripts, ${errors} errors, ${result.issues.length - errors} warnings (${uncertain} uncertain)`)
  }
  catch (error) {
    reports.push({ example, failure: String(error) })
    consola.error(`${example}: ${String(error)}`)
  }
}
const output = process.argv[2]
if (output)
  writeFileSync(resolve(output), `${JSON.stringify(reports, null, 2)}\n`)
// Existing examples intentionally include legacy/invalid syntax; report it, but
// reserve an unsuccessful audit exit for checker crashes, not authored defects.
if (reports.some(report => 'failure' in report))
  process.exitCode = 1
