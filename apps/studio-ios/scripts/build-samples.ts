/**
 * Package the contest sample projects (`examples/ai-contest/<slug>`) as
 * `.advpkg.zip` files in the App bundle, using the shared package plan, so
 * the App installs samples through the same import path as any package.
 *
 * Usage: pnpm -C apps/studio-ios build:samples
 * Output: StudioApp/Samples/<slug>.advpkg.zip (not committed)
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
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

async function main() {
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
