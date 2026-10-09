import { readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { compileMarkdownProgram } from '@advjs/core/compiler'

async function main() {
  const files = [
    { id: 'street', path: 'entry.adv.md' },
    { id: 'keeper', path: 'quest.adv.md' },
  ]
  const chapters = await Promise.all(files.map(async ({ id, path }) => ({
    id,
    sourcePath: path,
    content: await readFile(new URL(path, import.meta.url), 'utf8'),
  })))
  const compiled = await compileMarkdownProgram({
    id: 'web-game-town',
    chapters,
    requiredPlugins: { 'game-bridge': '1.0.0' },
    staticAnalysis: { variables: { game: { hasQuest: false }, requestOk: false } },
  })
  for (const diagnostic of compiled.diagnostics)
    console.error(`${diagnostic.severity} ${diagnostic.code}: ${diagnostic.message}`)
  if (!compiled.program || compiled.diagnostics.some(item => item.severity === 'error'))
    throw new Error('Story compilation failed')

  const output = process.argv[2] ?? new URL('./town.program.json', import.meta.url)
  await writeFile(output, `${JSON.stringify(compiled.program, null, 2)}\n`)
  console.warn(`Compiled ${compiled.program.id}: ${compiled.program.hash}`)
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
