/**
 * Package the contest sample projects (`examples/ai-contest/<slug>`) as
 * `.advpkg.zip` files in the App bundle, using the shared package plan, so
 * the App installs samples through the same import path as any package.
 *
 * Usage: pnpm -C apps/studio-ios build:samples
 * Output: StudioApp/Samples/<slug>.advpkg.zip (not committed)
 */
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import JSZip from 'jszip'
import { readProjectSnapshot } from '../engine/golden/cases'
import { call } from '../engine/src/index'
import { engineRoot, repoRoot } from '../engine/workspace'

/** Display names match Web Studio's contest demo labels (zh-CN). */
const SAMPLES = [
  { slug: 'life-story', name: '奶奶的一生' },
  { slug: 'history-talk', name: '跨越时空的对谈' },
  { slug: 'murder-mystery', name: '雪夜庄园' },
]

async function buildOfflineFixture() {
  const source = resolve(engineRoot, '../spike/fixtures/offline-player')
  const output = resolve(engineRoot, '../StudioAppUITests/OfflineFixture.bundle')
  await cp(source, output, { recursive: true })
  const path = 'adv/chapters/start.adv.md'
  const original = await readFile(resolve(source, path), 'utf8')
  const settingsPath = 'adv/settings/game.json'
  const settings = JSON.parse(await readFile(resolve(source, settingsPath), 'utf8'))
  settings.requiredPlugins.civilization = '1.0.0'
  settings.colorScheme = 'light'
  const activity = [
    '',
    '```yaml',
    'type: activity',
    'use: civilization/initialize',
    'input:',
    '  suggestedName: Seed',
    '  principles: [memory, curiosity]',
    '  defaultLevel: 1',
    '```',
    '',
  ].join('\n')
  await writeFile(resolve(output, path), original.replace('## 结束 {#ending}', `${activity}\n## 结束 {#ending}`))
  await writeFile(resolve(output, settingsPath), JSON.stringify(settings, null, 2))
}

async function main() {
  await buildOfflineFixture()
  const output = resolve(engineRoot, '../StudioApp/Samples')
  await mkdir(output, { recursive: true })
  for (const sample of SAMPLES) {
    const root = `examples/ai-contest/${sample.slug}`
    const snapshot = await readProjectSnapshot(root)
    const response = JSON.parse(await call('package.plan', JSON.stringify({
      files: snapshot.files,
      paths: snapshot.paths,
      name: sample.name,
      // Fixed so rebuilt packages are byte-stable apart from archive timestamps.
      exportedAt: '2026-10-21T00:00:00.000Z',
    })))
    if (!response.ok)
      throw new Error(`${sample.slug}: ${response.error.code} ${response.error.message}`)
    const zip = new JSZip()
    for (const entry of response.result.entries as Array<{ path: string }>) {
      zip.file(entry.path, snapshot.files[entry.path] ?? await readFile(resolve(repoRoot, root, entry.path)), { date: new Date('2026-10-21T00:00:00Z') })
    }
    zip.file('manifest.json', response.result.manifestText, { date: new Date('2026-10-21T00:00:00Z') })
    const bytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
    await writeFile(resolve(output, `${sample.slug}.advpkg.zip`), bytes)
    process.stdout.write(`${sample.slug}.advpkg.zip: ${response.result.entries.length} files, ${(bytes.byteLength / 1024).toFixed(1)} KiB\n`)
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
})
