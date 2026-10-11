import type { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { readFile, realpath, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import JSZip from 'jszip'
import { buildStudioNativeHandoff } from '../design-flow/handoff'

/** Read-only model-free recovery of the two already exported native projects. */
export async function startStudioRealQwenReplayFixture() {
  if (process.env.ADVJS_REAL_QWEN !== '1' || !process.env.ADVJS_REAL_QWEN_STUDIO_REPLAY)
    throw new Error('REAL_QWEN_REPLAY_PROOF_REQUIRED')
  const directory = await realpath(process.env.ADVJS_REAL_QWEN_STUDIO_REPLAY)
  const metadata = JSON.parse(await readFile(join(directory, 'metadata.json'), 'utf8'))
  if (await realpath(metadata.directory) !== directory)
    throw new Error('REAL_QWEN_REPLAY_SCOPE_CHANGED')
  const calls = JSON.parse(await readFile(join(directory, 'provider-calls.json'), 'utf8'))
  if (calls.length !== 4 || calls.some((call: any, index: number) => call.sequence !== index + 1 || call.offline !== true || call.character !== metadata.actorId))
    throw new Error('REAL_QWEN_REPLAY_CALLS_CHANGED')
  const exports: Array<Awaited<ReturnType<typeof buildStudioNativeHandoff>> & Record<string, any>> = []
  for (let index = 1; index <= 2; index++) {
    const original = JSON.parse(await readFile(join(directory, `handoff-${index}.json`), 'utf8'))
    if (original.lineId !== metadata.lineId || original.take.sha256 !== calls[index === 1 ? 1 : 3].candidates[0].sha256)
      throw new Error('REAL_QWEN_REPLAY_IDENTITY_CHANGED')
    // Older acceptance runs retained the exact extracted ZIP entries. Preserve
    // those bytes without claiming that reconstructed ZIP container is original.
    const zip = new JSZip()
    const entries = []
    for (const path of original.files) {
      const bytes = await readFile(join(original.root, path))
      zip.file(path, bytes)
      entries.push({ path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
    }
    try {
      await readFile(join(directory, `handoff-${index}.zip`))
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw error
      const bytes = await zip.generateAsync({ type: 'nodebuffer' })
      await writeFile(join(directory, `handoff-${index}.zip`), bytes)
      await writeFile(join(directory, `handoff-${index}.zip-proof.json`), JSON.stringify({ origin: 'reassembled-original-native-export-entries', sha256: createHash('sha256').update(bytes).digest('hex'), entries }, null, 2))
    }
    const player = await buildStudioNativeHandoff(original.root)
    exports.push({ ...original, ...player })
    const { close: _, ...proof } = exports.at(-1)!
    await writeFile(join(directory, `replay-handoff-${index}.json`), JSON.stringify(proof, null, 2))
  }
  return {
    metadata,
    files: {},
    media: [],
    async mediaBytes(_assetId: string): Promise<never> { throw new Error('REAL_QWEN_REPLAY_MEDIA_ROUTE_UNAVAILABLE') },
    async handoff(_buffer: Buffer): Promise<never> { throw new Error('REAL_QWEN_REPLAY_NO_AUTHOR_WRITES') },
    async status() { return { calls, exports: exports.map(({ close: _, ...proof }) => proof) } },
    async close() { await Promise.all(exports.map(item => item.close())) },
  }
}
