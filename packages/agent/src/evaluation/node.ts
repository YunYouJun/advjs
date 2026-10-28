import type { CreativeEvaluationSink } from './execution'
import { mkdir, open } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

/** Exclusive immutable JSON evidence. Unknown/partial outcomes cannot be silently overwritten. */
export function createCreativeEvaluationFileSink(directory: string): CreativeEvaluationSink {
  const root = pathToFileURL(`${directory.replace(/[\\/]$/, '')}/`)
  return {
    async write(name, value) {
      const match = /^([\w:-]{1,160})\/(input|final|call-[1-9]\d*-(?:intent|result)|tool-[1-9]\d*)\.json$/.exec(name)
      if (!match)
        throw new TypeError('Invalid evaluation evidence name')
      const folder = new URL(`${encodeURIComponent(match[1])}/`, root)
      await mkdir(folder, { recursive: true, mode: 0o700 })
      const file = new URL(`${match[2]}.json`, folder)
      const serialized = `${JSON.stringify(value, null, 2)}\n`
      if (new TextEncoder().encode(serialized).length > 2 * 1024 * 1024)
        throw new TypeError('Evaluation evidence exceeds its limit')
      const handle = await open(file, 'wx', 0o600)
      try {
        await handle.writeFile(serialized, 'utf8')
        await handle.sync()
      }
      finally {
        await handle.close()
      }
      return fileURLToPath(file)
    },
  }
}
