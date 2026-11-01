/** sRGB channels 0–255 with alpha 0–1. */
export interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

const namedColors: Record<string, string> = {
  transparent: '#0000',
  black: '#000',
  white: '#fff',
  gray: '#808080',
  grey: '#808080',
  silver: '#c0c0c0',
  red: '#f00',
  maroon: '#800000',
  orange: '#ffa500',
  gold: '#ffd700',
  yellow: '#ff0',
  olive: '#808000',
  lime: '#0f0',
  green: '#008000',
  teal: '#008080',
  cyan: '#0ff',
  aqua: '#0ff',
  blue: '#00f',
  navy: '#000080',
  indigo: '#4b0082',
  purple: '#800080',
  fuchsia: '#f0f',
  magenta: '#f0f',
  pink: '#ffc0cb',
  crimson: '#dc143c',
  brown: '#a52a2a',
  beige: '#f5f5dc',
  ivory: '#fffff0',
  khaki: '#f0e68c',
  coral: '#ff7f50',
  salmon: '#fa8072',
  tomato: '#ff6347',
  violet: '#ee82ee',
  plum: '#dda0dd',
  tan: '#d2b48c',
  wheat: '#f5deb3',
  snow: '#fffafa',
  linen: '#faf0e6',
}

/** Split on a separator that is not nested inside parentheses or quotes. */
export function splitTopLevel(value: string, separator: ',' | ' ' | '/'): string[] {
  const parts: string[] = []
  let depth = 0
  let quote = ''
  let current = ''
  for (const char of value) {
    if (quote) {
      if (char === quote)
        quote = ''
    }
    else if (char === '"' || char === '\'') {
      quote = char
    }
    else if (char === '(') {
      depth++
    }
    else if (char === ')') {
      depth--
    }
    if (!quote && depth === 0 && (separator === ' ' ? /\s/u.test(char) : char === separator)) {
      if (current.trim())
        parts.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  if (current.trim())
    parts.push(current.trim())
  return parts
}

/** Index of the parenthesis that closes the one at `open`. */
function closingParen(value: string, open: number): number {
  let depth = 0
  for (let index = open; index < value.length; index++) {
    if (value[index] === '(')
      depth++
    else if (value[index] === ')' && --depth === 0)
      return index
  }
  return -1
}

/**
 * Substitute `var(--name, fallback)` references. Unknown names without a
 * fallback stay in place, so callers can report them as unverifiable.
 */
export function resolveCssVars(value: string, lookup: (name: string) => string | undefined, depth = 0): string {
  if (depth > 8)
    return value
  let result = ''
  let index = 0
  while (index < value.length) {
    const start = value.indexOf('var(', index)
    if (start < 0) {
      result += value.slice(index)
      break
    }
    const end = closingParen(value, start + 3)
    if (end < 0) {
      result += value.slice(index)
      break
    }
    result += value.slice(index, start)
    // A custom property name cannot contain a comma, so the first one ends it.
    const inner = value.slice(start + 4, end)
    const comma = inner.indexOf(',')
    const name = (comma < 0 ? inner : inner.slice(0, comma)).trim()
    const fallback = comma < 0 ? undefined : inner.slice(comma + 1).trim()
    const resolved = lookup(name) ?? fallback
    result += resolved === undefined ? value.slice(start, end + 1) : resolveCssVars(resolved, lookup, depth + 1)
    index = end + 1
  }
  return result
}

function parseHex(value: string): Rgba | undefined {
  const hex = value.slice(1)
  if (!/^(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/iu.test(hex))
    return undefined
  const full = hex.length <= 4 ? [...hex].map(char => char + char).join('') : hex
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
    a: full.length === 8 ? Number.parseInt(full.slice(6, 8), 16) / 255 : 1,
  }
}

function channel(value: string, scale: number): number | undefined {
  if (value === 'none')
    return 0
  const number = Number.parseFloat(value)
  if (!Number.isFinite(number))
    return undefined
  return value.endsWith('%') ? number / 100 * scale : number
}

function hueToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}

function parseFunction(name: string, body: string): Rgba | undefined {
  const [channels, alphaPart] = body.includes('/')
    ? splitTopLevel(body, '/')
    : [body, undefined]
  const parts = channels.includes(',') ? splitTopLevel(channels, ',') : splitTopLevel(channels, ' ')
  const alphaSource = alphaPart ?? parts[3]
  const alpha = alphaSource === undefined ? 1 : channel(alphaSource, 1)
  if (parts.length < 3 || alpha === undefined)
    return undefined
  if (name === 'rgb' || name === 'rgba') {
    const [r, g, b] = parts.slice(0, 3).map(part => channel(part, 255))
    if (r === undefined || g === undefined || b === undefined)
      return undefined
    return { r, g, b, a: alpha }
  }
  const hue = Number.parseFloat(parts[0])
  const saturation = channel(parts[1], 1)
  const lightness = channel(parts[2], 1)
  if (!Number.isFinite(hue) || saturation === undefined || lightness === undefined)
    return undefined
  const [r, g, b] = hueToRgb(((hue % 360) + 360) % 360, saturation > 1 ? saturation / 100 : saturation, lightness > 1 ? lightness / 100 : lightness)
  return { r, g, b, a: alpha }
}

function parseColorMix(body: string): Rgba | undefined {
  const [space, first, second] = splitTopLevel(body, ',')
  if (!space || !first || !second || !/^in\s+srgb$/iu.test(space.trim()))
    return undefined
  const weighted = (part: string) => {
    const tokens = splitTopLevel(part, ' ')
    const percentage = tokens.find(token => /^[\d.]+%$/u.test(token))
    const color = parseCssColor(tokens.filter(token => token !== percentage).join(' '))
    return color && { color, weight: percentage ? Number.parseFloat(percentage) / 100 : undefined }
  }
  const a = weighted(first)
  const b = weighted(second)
  if (!a || !b)
    return undefined
  let p1 = a.weight ?? (b.weight === undefined ? 0.5 : 1 - b.weight)
  let p2 = b.weight ?? 1 - p1
  const total = p1 + p2
  if (total <= 0)
    return undefined
  p1 /= total
  p2 /= total
  const alpha = a.color.a * p1 + b.color.a * p2
  if (alpha === 0)
    return { r: 0, g: 0, b: 0, a: 0 }
  const mix = (key: 'r' | 'g' | 'b') => (a.color[key] * a.color.a * p1 + b.color[key] * b.color.a * p2) / alpha
  return { r: mix('r'), g: mix('g'), b: mix('b'), a: alpha }
}

/**
 * Parse a resolved CSS colour. Supports hex, rgb(a), hsl(a), common named
 * colours and `color-mix(in srgb, …)`; returns undefined for anything else.
 */
export function parseCssColor(input: string): Rgba | undefined {
  const value = input.trim().toLowerCase()
  if (value.startsWith('#'))
    return parseHex(value)
  if (namedColors[value])
    return parseHex(namedColors[value])
  const match = /^([a-z-]+)\((.*)\)$/su.exec(value)
  if (!match)
    return undefined
  const [, name, body] = match
  if (name === 'color-mix')
    return parseColorMix(body)
  if (['rgb', 'rgba', 'hsl', 'hsla'].includes(name))
    return parseFunction(name, body)
  return undefined
}

/** Colours behind text: a plain colour, or the stops of a single gradient layer. */
export function parsePaintColors(input: string): Rgba[] | undefined {
  const value = input.trim()
  if (/url\(/iu.test(value))
    return undefined
  const layers = splitTopLevel(value, ',')
  if (layers.length !== 1)
    return undefined
  const gradient = /^(?:repeating-)?(?:linear|radial|conic)-gradient\(/iu.exec(value)
  if (!gradient) {
    const color = parseCssColor(value)
    return color && [color]
  }
  const end = closingParen(value, gradient[0].length - 1)
  if (end < 0)
    return undefined
  const stops: Rgba[] = []
  for (const argument of splitTopLevel(value.slice(gradient[0].length, end), ',')) {
    const tokens = splitTopLevel(argument, ' ')
    const color = parseCssColor(tokens[0] ?? '')
    if (color)
      stops.push(color)
    else if (/^(?:#|rgb|hsl|color-mix)/iu.test(tokens[0] ?? ''))
      return undefined
  }
  return stops.length ? stops : undefined
}

/** Composite `top` over `bottom` (source-over). */
export function composite(top: Rgba, bottom: Rgba): Rgba {
  const a = top.a + bottom.a * (1 - top.a)
  if (a === 0)
    return { r: 0, g: 0, b: 0, a: 0 }
  const mix = (key: 'r' | 'g' | 'b') => (top[key] * top.a + bottom[key] * bottom.a * (1 - top.a)) / a
  return { r: mix('r'), g: mix('g'), b: mix('b'), a }
}

function luminance(color: Rgba): number {
  const linear = (value: number) => {
    const c = value / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b)
}

/** WCAG 2.x contrast ratio between two opaque colours. */
export function contrastRatio(a: Rgba, b: Rgba): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

export function formatColor(color: Rgba): string {
  const hex = (value: number) => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0')
  return `#${hex(color.r)}${hex(color.g)}${hex(color.b)}${color.a < 1 ? hex(color.a * 255) : ''}`
}
