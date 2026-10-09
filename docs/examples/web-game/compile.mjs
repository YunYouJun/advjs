import { readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { compileMarkdownProgram } from '@advjs/core/compiler'

async function main() {
  const content = await readFile(new URL('./quest.adv.md', import.meta.url), 'utf8')
  const compiled = await compileMarkdownProgram({
    id: 'web-game-keeper',
    chapters: [{ id: 'keeper', content, sourcePath: 'quest.adv.md' }],
    requiredPlugins: { 'game-bridge': '1.0.0' },
    staticAnalysis: { variables: { game: { hasQuest: false }, requestOk: false } },
  })
  for (const diagnostic of compiled.diagnostics)
    console.error(`${diagnostic.severity} ${diagnostic.code}: ${diagnostic.message}`)
  if (!compiled.program || compiled.diagnostics.some(item => item.severity === 'error'))
    throw new Error('Story compilation failed')

  const output = process.argv[2] ?? new URL('./quest.program.json', import.meta.url)
  await writeFile(output, `${JSON.stringify(compiled.program, null, 2)}\n`)
  console.warn(`Compiled ${compiled.program.id}: ${compiled.program.hash}`)
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
