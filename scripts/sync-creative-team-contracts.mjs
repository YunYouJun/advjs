import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

// The runtime repo consumes a generated copy until a shared package is released.
const source = new URL('../packages/agent/src/creative-team/', import.meta.url)
const targetArg = process.argv.find(argument => argument.startsWith('--runtime='))?.slice('--runtime='.length)
if (!targetArg)
  throw new Error('Pass --runtime=/absolute/path/to/YunLeFun/api; --write updates the generated copy')
const target = resolve(targetArg, 'packages/ai-runtime-advjs/src/creative-team/shared')
const files = ['contracts.ts', 'validation.ts', 'candidates.ts', 'orchestration.ts', 'outputs.ts', 'wire.ts', 'edits.ts', 'media.ts', 'milestones.ts', 'merges.ts', 'voice-direction.ts', 'voice-lines.ts', 'playtest-contracts.ts', 'playtest-snapshot.ts', 'playtest-repair.ts']
const hashes = {}
for (const file of files) {
  const original = await readFile(new URL(file, source), 'utf8')
  hashes[file] = createHash('sha256').update(original).digest('hex')
  const generated = `// Generated from ADV.JS packages/agent/src/creative-team/${file}. Do not edit.\n${original
    .replaceAll('\'../core/contracts\'', '\'../../contracts/v1.js\'')
    .replace(/from '(\.\/[^']+)'/g, 'from \'$1.js\'')}`
  const path = resolve(target, file)
  if (process.argv.includes('--write')) {
    await mkdir(target, { recursive: true })
    await writeFile(path, generated)
  }
  else if (await readFile(path, 'utf8') !== generated) {
    throw new Error(`Runtime contract drift: ${path}`)
  }
}
const fixtureName = 'creative-media-author-host.json'
const fixture = await readFile(new URL(`../packages/agent/test/fixtures/${fixtureName}`, import.meta.url), 'utf8')
const fixtureTarget = resolve(targetArg, 'packages/ai-runtime-advjs/test', fixtureName)
if (process.argv.includes('--write')) {
  await mkdir(dirname(fixtureTarget), { recursive: true })
  await writeFile(fixtureTarget, fixture)
}
else if (await readFile(fixtureTarget, 'utf8') !== fixture) {
  throw new Error('Runtime media fixture drift')
}
const fixtures = { [fixtureName]: createHash('sha256').update(fixture).digest('hex') }
const metadata = `${JSON.stringify({ source: 'YunYouJun/advjs:packages/agent/src/creative-team', files: hashes, fixtures }, null, 2)}\n`
if (process.argv.includes('--write'))
  await writeFile(resolve(target, 'source.json'), metadata)
else if (await readFile(resolve(target, 'source.json'), 'utf8') !== metadata)
  throw new Error('Runtime source manifest drift')
process.stdout.write(`Creative team contracts ${process.argv.includes('--write') ? 'synced' : 'verified'}: ${files.length} files from ${fileURLToPath(source)}\n`)
