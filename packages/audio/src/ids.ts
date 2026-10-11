/** Audio project IDs are prefixed UUIDv7, never derived from prose or position. */
export type AudioIdKind = 'line' | 'take' | 'audio' | 'job'

const UUID_V7 = '[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'
let lastTime = -1
let sequence = 0

export function isAudioId(value: unknown, kind: AudioIdKind): value is string {
  return typeof value === 'string' && new RegExp(`^${kind}_${UUID_V7}$`, 'u').test(value)
}

export function assertAudioId(value: unknown, kind: AudioIdKind): asserts value is string {
  if (!isAudioId(value, kind))
    throw new Error(`Invalid ${kind} ID: expected ${kind}_<uuidv7>`)
}

/** Monotonic within this process and millisecond; random payload across hosts. */
export function createAudioId(kind: AudioIdKind, now = Date.now()): string {
  if (!Number.isSafeInteger(now) || now < 0 || now > 0xFFFFFFFFFFFF)
    throw new Error('UUIDv7 timestamp must be an unsigned 48-bit millisecond value')
  const timestamp = Math.max(now, lastTime)
  if (timestamp === lastTime) {
    sequence += 1
    if (sequence > 0xFFF)
      throw new Error('UUIDv7 per-millisecond sequence exhausted; retry with a later clock')
  }
  else {
    sequence = 0
  }
  lastTime = timestamp
  const random = crypto.getRandomValues(new Uint8Array(8))
  random[0] = (random[0]! & 0x3F) | 0x80
  const tail = Array.from(random, byte => byte.toString(16).padStart(2, '0')).join('')
  const time = timestamp.toString(16).padStart(12, '0')
  const uuid = `${time.slice(0, 8)}-${time.slice(8)}-7${sequence.toString(16).padStart(3, '0')}-${tail.slice(0, 4)}-${tail.slice(4)}`
  return `${kind}_${uuid}`
}
