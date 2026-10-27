/**
 * Web platform APIs the shared engine modules assume, installed only when the
 * host lacks them. JavaScriptCore provides ECMAScript and Intl but no
 * TextEncoder, crypto, structuredClone or (outside an inspector) console.
 *
 * The build prepends this file as a banner so it runs before any bundled
 * module, whatever the import order. Hosts may inject secure randomness as
 * `globalThis.__advHost.randomBytes(length)` and log lines as
 * `globalThis.__advHost.log(level, message)`; everything else is pure JS so
 * results stay byte-identical with Node.
 */

interface AdvHost {
  randomBytes?: (length: number) => ArrayLike<number>
  log?: (level: string, message: string) => void
}

const scope = globalThis as any

function encodeUtf8(input: string): Uint8Array {
  const bytes: number[] = []
  for (let index = 0; index < input.length; index++) {
    let code = input.charCodeAt(index)
    if (code >= 0xD800 && code <= 0xDBFF && index + 1 < input.length) {
      const next = input.charCodeAt(index + 1)
      if (next >= 0xDC00 && next <= 0xDFFF) {
        code = 0x10000 + ((code - 0xD800) << 10) + (next - 0xDC00)
        index++
      }
      else {
        code = 0xFFFD
      }
    }
    else if (code >= 0xD800 && code <= 0xDFFF) {
      code = 0xFFFD
    }
    if (code < 0x80) {
      bytes.push(code)
    }
    else if (code < 0x800) {
      bytes.push(0xC0 | (code >> 6), 0x80 | (code & 0x3F))
    }
    else if (code < 0x10000) {
      bytes.push(0xE0 | (code >> 12), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F))
    }
    else {
      bytes.push(0xF0 | (code >> 18), 0x80 | ((code >> 12) & 0x3F), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F))
    }
  }
  return new Uint8Array(bytes)
}

function decodeUtf8(input: ArrayBuffer | ArrayBufferView): string {
  const bytes = input instanceof ArrayBuffer
    ? new Uint8Array(input)
    : new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
  let output = ''
  for (let index = 0; index < bytes.length;) {
    const byte = bytes[index++]
    let code = 0xFFFD
    if (byte < 0x80) {
      code = byte
    }
    else if (byte >= 0xC2 && byte < 0xE0 && index < bytes.length) {
      code = ((byte & 0x1F) << 6) | (bytes[index++] & 0x3F)
    }
    else if (byte >= 0xE0 && byte < 0xF0 && index + 1 < bytes.length) {
      code = ((byte & 0x0F) << 12) | ((bytes[index++] & 0x3F) << 6) | (bytes[index++] & 0x3F)
    }
    else if (byte >= 0xF0 && byte < 0xF5 && index + 2 < bytes.length) {
      code = ((byte & 0x07) << 18) | ((bytes[index++] & 0x3F) << 12) | ((bytes[index++] & 0x3F) << 6) | (bytes[index++] & 0x3F)
    }
    output += String.fromCodePoint(code)
  }
  return output
}

const K = new Uint32Array([
  0x428A2F98,
  0x71374491,
  0xB5C0FBCF,
  0xE9B5DBA5,
  0x3956C25B,
  0x59F111F1,
  0x923F82A4,
  0xAB1C5ED5,
  0xD807AA98,
  0x12835B01,
  0x243185BE,
  0x550C7DC3,
  0x72BE5D74,
  0x80DEB1FE,
  0x9BDC06A7,
  0xC19BF174,
  0xE49B69C1,
  0xEFBE4786,
  0x0FC19DC6,
  0x240CA1CC,
  0x2DE92C6F,
  0x4A7484AA,
  0x5CB0A9DC,
  0x76F988DA,
  0x983E5152,
  0xA831C66D,
  0xB00327C8,
  0xBF597FC7,
  0xC6E00BF3,
  0xD5A79147,
  0x06CA6351,
  0x14292967,
  0x27B70A85,
  0x2E1B2138,
  0x4D2C6DFC,
  0x53380D13,
  0x650A7354,
  0x766A0ABB,
  0x81C2C92E,
  0x92722C85,
  0xA2BFE8A1,
  0xA81A664B,
  0xC24B8B70,
  0xC76C51A3,
  0xD192E819,
  0xD6990624,
  0xF40E3585,
  0x106AA070,
  0x19A4C116,
  0x1E376C08,
  0x2748774C,
  0x34B0BCB5,
  0x391C0CB3,
  0x4ED8AA4A,
  0x5B9CCA4F,
  0x682E6FF3,
  0x748F82EE,
  0x78A5636F,
  0x84C87814,
  0x8CC70208,
  0x90BEFFFA,
  0xA4506CEB,
  0xBEF9A3F7,
  0xC67178F2,
])

function sha256(data: Uint8Array): ArrayBuffer {
  const bitLength = data.length * 8
  const padded = new Uint8Array(((data.length + 9 + 63) >> 6) << 6)
  padded.set(data)
  padded[data.length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(padded.length - 8, Math.floor(bitLength / 0x100000000))
  view.setUint32(padded.length - 4, bitLength >>> 0)
  const hash = new Uint32Array([0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A, 0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19])
  const words = new Uint32Array(64)
  const rotate = (value: number, bits: number) => (value >>> bits) | (value << (32 - bits))
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index++)
      words[index] = view.getUint32(offset + index * 4)
    for (let index = 16; index < 64; index++) {
      const s0 = rotate(words[index - 15], 7) ^ rotate(words[index - 15], 18) ^ (words[index - 15] >>> 3)
      const s1 = rotate(words[index - 2], 17) ^ rotate(words[index - 2], 19) ^ (words[index - 2] >>> 10)
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, h] = hash
    for (let index = 0; index < 64; index++) {
      const s1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)
      const choice = (e & f) ^ (~e & g)
      const t1 = (h + s1 + choice + K[index] + words[index]) >>> 0
      const s0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)
      const majority = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (s0 + majority) >>> 0
      h = g
      g = f
      f = e
      e = (d + t1) >>> 0
      d = c
      c = b
      b = a
      a = (t1 + t2) >>> 0
    }
    hash[0] += a
    hash[1] += b
    hash[2] += c
    hash[3] += d
    hash[4] += e
    hash[5] += f
    hash[6] += g
    hash[7] += h
  }
  const output = new DataView(new ArrayBuffer(32))
  hash.forEach((value, index) => output.setUint32(index * 4, value))
  return output.buffer
}

function cloneValue(value: unknown, seen: Map<object, unknown>): unknown {
  if (value === null || typeof value !== 'object')
    return value
  if (seen.has(value))
    return seen.get(value)
  if (value instanceof Date)
    return new Date(value.getTime())
  if (ArrayBuffer.isView(value))
    return (value as any).slice()
  if (value instanceof Map) {
    const map = new Map()
    seen.set(value, map)
    value.forEach((child, key) => map.set(cloneValue(key, seen), cloneValue(child, seen)))
    return map
  }
  if (value instanceof Set) {
    const set = new Set()
    seen.set(value, set)
    value.forEach(child => set.add(cloneValue(child, seen)))
    return set
  }
  if (Array.isArray(value)) {
    const array: unknown[] = []
    seen.set(value, array)
    value.forEach((child, index) => array[index] = cloneValue(child, seen))
    return array
  }
  const object: Record<string, unknown> = {}
  seen.set(value, object)
  for (const key of Object.keys(value))
    object[key] = cloneValue((value as Record<string, unknown>)[key], seen)
  return object
}

if (typeof scope.TextEncoder === 'undefined') {
  scope.TextEncoder = class TextEncoder {
    readonly encoding = 'utf-8'
    encode(input = '') {
      return encodeUtf8(String(input))
    }
  }
}
if (typeof scope.TextDecoder === 'undefined') {
  scope.TextDecoder = class TextDecoder {
    readonly encoding = 'utf-8'
    decode(input?: ArrayBuffer | ArrayBufferView) {
      return input ? decodeUtf8(input) : ''
    }
  }
}
if (typeof scope.structuredClone === 'undefined')
  scope.structuredClone = (value: unknown) => cloneValue(value, new Map())
if (typeof scope.crypto === 'undefined') {
  scope.crypto = {
    subtle: {
      async digest(algorithm: string | { name: string }, data: ArrayBuffer | ArrayBufferView) {
        const name = typeof algorithm === 'string' ? algorithm : algorithm.name
        if (name.toUpperCase() !== 'SHA-256')
          throw new Error(`Unsupported digest: ${name}`)
        const bytes = data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
        return sha256(bytes)
      },
    },
    getRandomValues<T extends ArrayBufferView>(array: T): T {
      const host = scope.__advHost as AdvHost | undefined
      if (!host?.randomBytes)
        throw new Error('Secure randomness requires the native host')
      const target = new Uint8Array(array.buffer, array.byteOffset, array.byteLength)
      target.set(host.randomBytes(target.length))
      return array
    },
  }
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

// Forgiving-base64 as in the HTML standard; js-yaml uses these for `!!binary`.
if (typeof scope.btoa === 'undefined') {
  scope.btoa = (input: string) => {
    const text = String(input)
    let output = ''
    for (let index = 0; index < text.length; index += 3) {
      const codes = [text.charCodeAt(index), text.charCodeAt(index + 1), text.charCodeAt(index + 2)]
      if (codes.some(code => code > 0xFF))
        throw new Error('InvalidCharacterError: btoa input must be Latin-1')
      const [a, b, c] = codes
      output += BASE64[a >> 2]
      output += BASE64[((a & 3) << 4) | (Number.isNaN(b) ? 0 : b >> 4)]
      output += Number.isNaN(b) ? '=' : BASE64[((b & 15) << 2) | (Number.isNaN(c) ? 0 : c >> 6)]
      output += Number.isNaN(c) ? '=' : BASE64[c & 63]
    }
    return output
  }
}
if (typeof scope.atob === 'undefined') {
  scope.atob = (input: string) => {
    let text = String(input).replace(/[\t\n\f\r ]/gu, '')
    if (text.length % 4 === 0)
      text = text.replace(/={1,2}$/u, '')
    if (text.length % 4 === 1 || /[^+/\dA-Z]/iu.test(text))
      throw new Error('InvalidCharacterError: atob input is not valid base64')
    let output = ''
    let buffer = 0
    let bits = 0
    for (const character of text) {
      buffer = (buffer << 6) | BASE64.indexOf(character)
      bits += 6
      if (bits >= 8) {
        bits -= 8
        output += String.fromCharCode((buffer >> bits) & 0xFF)
      }
    }
    return output
  }
}

if (typeof scope.console === 'undefined') {
  const forward = (level: string) => (...values: unknown[]) => {
    const host = scope.__advHost as AdvHost | undefined
    host?.log?.(level, values.map(value => typeof value === 'string' ? value : JSON.stringify(value)).join(' '))
  }
  scope.console = {
    debug: forward('debug'),
    error: forward('error'),
    info: forward('info'),
    log: forward('log'),
    warn: forward('warn'),
  }
}

export {}
