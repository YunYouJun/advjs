import { Buffer } from 'node:buffer'
import { mkdir, realpath } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'

export function inside(root: string, path: string): boolean {
  const name = relative(root, path)
  return name === '' || (!isAbsolute(name) && name !== '..' && !name.startsWith(`..${sep}`))
}

export async function projectFile(root: string, path: string): Promise<string> {
  const file = await realpath(resolve(root, path))
  if (!inside(root, file))
    throw new Error('Breeze voice input resolves outside the project')
  return file
}

export async function outputDirectory(root: string): Promise<string> {
  const target = resolve(root, '.advjs/voice/previews/breeze')
  let ancestor = target
  for (;;) {
    try {
      if (!inside(root, await realpath(ancestor)))
        throw new Error('Breeze voice output resolves outside the project')
      break
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw error
      ancestor = dirname(ancestor)
    }
  }
  await mkdir(target, { recursive: true })
  return projectFile(root, target)
}

/** Bound streamed responses before allocating or persisting untrusted audio. */
export async function responseBytes(response: Response, maximum: number): Promise<Buffer> {
  const length = Number(response.headers.get('content-length'))
  if (length > maximum) {
    await response.body?.cancel()
    throw new Error('Breeze response exceeds the size limit')
  }
  const reader = response.body?.getReader()
  if (!reader)
    throw new Error('Breeze returned an empty response')
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done)
        break
      total += value.byteLength
      if (total > maximum)
        throw new Error('Breeze response exceeds the size limit')
      chunks.push(value)
    }
    return Buffer.concat(chunks, total)
  }
  finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

/** Xinference's Breeze WAV contract is mono, 24 kHz, signed 16-bit PCM. */
export function inspectWave(bytes: Buffer): { sampleRate: number, durationSeconds: number } {
  const invalid = () => {
    throw new Error('Breeze returned invalid or unsupported WAV audio')
  }
  if (bytes.length < 44 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE' || bytes.readUInt32LE(4) + 8 !== bytes.length)
    return invalid()
  let format = false
  let dataSize = 0
  let offset = 12
  while (offset + 8 <= bytes.length) {
    const kind = bytes.toString('ascii', offset, offset + 4)
    const size = bytes.readUInt32LE(offset + 4)
    const start = offset + 8
    if (start + size > bytes.length)
      return invalid()
    if (kind === 'fmt ') {
      if (format || size < 16 || bytes.readUInt16LE(start) !== 1 || bytes.readUInt16LE(start + 2) !== 1 || bytes.readUInt32LE(start + 4) !== 24_000 || bytes.readUInt32LE(start + 8) !== 48_000 || bytes.readUInt16LE(start + 12) !== 2 || bytes.readUInt16LE(start + 14) !== 16)
        return invalid()
      format = true
    }
    if (kind === 'data') {
      if (dataSize || !size || size % 2)
        return invalid()
      dataSize = size
    }
    offset = start + size + size % 2
  }
  if (!format || !dataSize || offset !== bytes.length)
    return invalid()
  return { sampleRate: 24_000, durationSeconds: dataSize / 48_000 }
}
