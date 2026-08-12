import { Buffer } from 'node:buffer'
import { gunzipSync, gzipSync } from 'node:zlib'

export interface DeterministicArchiveEntry {
  content: Uint8Array
  path: string
}

export interface ParsedArchiveEntry {
  content: Buffer
  path: string
}

function writeOctal(header: Buffer, offset: number, length: number, value: number) {
  const encoded = value.toString(8).padStart(length - 1, '0')
  header.write(encoded, offset, length - 1, 'ascii')
  header[offset + length - 1] = 0
}

function splitTarPath(path: string) {
  if (Buffer.byteLength(path) <= 100)
    return { name: path, prefix: '' }
  for (let index = path.lastIndexOf('/'); index > 0; index = path.lastIndexOf('/', index - 1)) {
    const prefix = path.slice(0, index)
    const name = path.slice(index + 1)
    if (Buffer.byteLength(name) <= 100 && Buffer.byteLength(prefix) <= 155)
      return { name, prefix }
  }
  throw new Error(`Archive path exceeds the ustar limit: ${path}`)
}

function tarHeader(path: string, size: number) {
  const header = Buffer.alloc(512)
  const { name, prefix } = splitTarPath(path)
  header.write(name, 0, 100, 'utf8')
  writeOctal(header, 100, 8, 0o644)
  writeOctal(header, 108, 8, 0)
  writeOctal(header, 116, 8, 0)
  writeOctal(header, 124, 12, size)
  writeOctal(header, 136, 12, 0)
  header.fill(0x20, 148, 156)
  header[156] = '0'.charCodeAt(0)
  header.write('ustar\0', 257, 6, 'ascii')
  header.write('00', 263, 2, 'ascii')
  header.write('advjs', 265, 5, 'ascii')
  header.write('advjs', 297, 5, 'ascii')
  header.write(prefix, 345, 155, 'utf8')
  const checksum = header.reduce((sum, byte) => sum + byte, 0)
  const checksumText = checksum.toString(8).padStart(6, '0')
  header.write(checksumText, 148, 6, 'ascii')
  header[154] = 0
  header[155] = 0x20
  return header
}

export function createDeterministicTarGzip(entries: DeterministicArchiveEntry[]) {
  const chunks: Buffer[] = []
  for (const entry of [...entries].sort((left, right) => left.path.localeCompare(right.path))) {
    const content = Buffer.from(entry.content)
    chunks.push(tarHeader(entry.path, content.byteLength), content)
    const padding = (512 - content.byteLength % 512) % 512
    if (padding)
      chunks.push(Buffer.alloc(padding))
  }
  chunks.push(Buffer.alloc(1024))
  return gzipSync(Buffer.concat(chunks), { level: 9 })
}

function readString(buffer: Buffer, offset: number, length: number) {
  const end = buffer.indexOf(0, offset)
  return buffer.toString('utf8', offset, end >= offset && end < offset + length ? end : offset + length)
}

function parseOctal(buffer: Buffer, offset: number, length: number) {
  const value = buffer.toString('ascii', offset, offset + length).replaceAll('\0', '').trim()
  if (!/^[0-7]*$/u.test(value))
    throw new Error('Archive contains an invalid tar number')
  return value ? Number.parseInt(value, 8) : 0
}

function validateArchivePath(path: string) {
  if (!path || path.startsWith('/') || path.includes('\\'))
    throw new Error(`Archive contains an unsafe path: ${path}`)
  const segments = path.split('/')
  if (segments.some(segment => !segment || segment === '.' || segment === '..'))
    throw new Error(`Archive contains an unsafe path: ${path}`)
}

export function readTarGzip(content: Uint8Array): ParsedArchiveEntry[] {
  const tar = gunzipSync(content)
  const entries: ParsedArchiveEntry[] = []
  const paths = new Set<string>()
  let offset = 0

  while (offset + 512 <= tar.byteLength) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every(byte => byte === 0))
      break
    const expectedChecksum = parseOctal(header, 148, 8)
    const checksumHeader = Buffer.from(header)
    checksumHeader.fill(0x20, 148, 156)
    const actualChecksum = checksumHeader.reduce((sum, byte) => sum + byte, 0)
    if (actualChecksum !== expectedChecksum)
      throw new Error('Archive contains an invalid tar checksum')
    const type = header[156]
    if (type !== 0 && type !== '0'.charCodeAt(0))
      throw new Error('Archive contains an unsupported non-file entry')
    const name = readString(header, 0, 100)
    const prefix = readString(header, 345, 155)
    const path = prefix ? `${prefix}/${name}` : name
    validateArchivePath(path)
    if (paths.has(path))
      throw new Error(`Archive contains a duplicate path: ${path}`)
    paths.add(path)
    const size = parseOctal(header, 124, 12)
    const contentStart = offset + 512
    const contentEnd = contentStart + size
    if (contentEnd > tar.byteLength)
      throw new Error(`Archive entry is truncated: ${path}`)
    entries.push({ content: Buffer.from(tar.subarray(contentStart, contentEnd)), path })
    offset = contentStart + Math.ceil(size / 512) * 512
  }

  if (entries.length === 0)
    throw new Error('Archive contains no files')
  return entries
}
