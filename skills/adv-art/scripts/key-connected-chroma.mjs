#!/usr/bin/env node

import { Buffer } from 'node:buffer'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'

const repoRoot = resolve(import.meta.dirname, '../../..')
const sourceRoot = resolve(repoRoot, 'temp/hamster-art/characters')
const qaRoot = resolve(repoRoot, 'temp/hamster-art/qa-alpha')
const backgrounds = {
  checker: { r: 184, g: 190, b: 203 },
  black: { r: 5, g: 8, b: 15 },
  white: { r: 248, g: 248, b: 246 },
  warm: { r: 83, g: 54, b: 43 },
  cool: { r: 22, g: 55, b: 78 },
}

async function collectSources(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory())
      files.push(...await collectSources(path))
    else if (entry.isFile() && entry.name.endsWith('-source.png'))
      files.push(path)
  }
  return files.sort()
}

function isConnectedChroma(r, g, b) {
  const magentaDominance = (r + b) / 2 - g
  const isMagenta = r >= 172 && b >= 118 && g <= 126 && magentaDominance >= 82
  const isGreen = g >= 145 && g - Math.max(r, b) >= 62
  return isMagenta || isGreen
}

export function keyedPixels(input, width, height) {
  const pixels = Buffer.from(input)
  const removed = new Uint8Array(width * height)
  const queue = new Uint32Array(width * height)
  let head = 0
  let tail = 0

  function enqueue(index) {
    if (removed[index])
      return
    const offset = index * 4
    if (!isConnectedChroma(pixels[offset], pixels[offset + 1], pixels[offset + 2]))
      return
    removed[index] = 1
    queue[tail++] = index
  }

  for (let x = 0; x < width; x++) {
    enqueue(x)
    enqueue((height - 1) * width + x)
  }
  for (let y = 0; y < height; y++) {
    enqueue(y * width)
    enqueue(y * width + width - 1)
  }

  while (head < tail) {
    const index = queue[head++]
    const x = index % width
    const y = Math.floor(index / width)
    if (x > 0)
      enqueue(index - 1)
    if (x + 1 < width)
      enqueue(index + 1)
    if (y > 0)
      enqueue(index - width)
    if (y + 1 < height)
      enqueue(index + width)
  }

  let transparent = 0
  let semiTransparent = 0
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0

  for (let index = 0; index < removed.length; index++) {
    const offset = index * 4
    if (removed[index]) {
      pixels[offset + 3] = 0
      transparent++
      continue
    }

    const x = index % width
    const y = Math.floor(index / width)
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)

    let touchesMatte = false
    for (let dy = -2; dy <= 2 && !touchesMatte; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx
        const ny = y + dy
        if (nx >= 0 && nx < width && ny >= 0 && ny < height && removed[ny * width + nx]) {
          touchesMatte = true
          break
        }
      }
    }
    if (!touchesMatte)
      continue

    const r = pixels[offset]
    const g = pixels[offset + 1]
    const b = pixels[offset + 2]
    const magentaSpill = ((r + b) / 2 - g - 42) / 105
    const greenSpill = (g - Math.max(r, b) - 30) / 110
    const spill = Math.max(0, Math.min(1, Math.max(magentaSpill, greenSpill)))
    if (spill <= 0)
      continue

    const alpha = Math.max(72, Math.round(255 * (1 - spill * 0.62)))
    pixels[offset + 3] = Math.min(pixels[offset + 3], alpha)
    if (greenSpill > magentaSpill) {
      const neutral = (r + b) / 2
      pixels[offset + 1] = Math.round(g * (1 - spill * 0.42) + neutral * spill * 0.42)
    }
    else {
      pixels[offset] = Math.round(r * (1 - spill * 0.32) + g * spill * 0.32)
      pixels[offset + 2] = Math.round(b * (1 - spill * 0.24) + g * spill * 0.24)
    }
    semiTransparent++
  }

  return {
    pixels,
    report: {
      width,
      height,
      transparentPixels: transparent,
      semiTransparentPixels: semiTransparent,
      opaquePixels: width * height - transparent - semiTransparent,
      subjectBounds: { minX, minY, maxX, maxY },
    },
  }
}

function checkerSvg(width, height) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><pattern id="c" width="32" height="32" patternUnits="userSpaceOnUse"><rect width="32" height="32" fill="#f2f2ee"/><path d="M0 0h16v16H0zM16 16h16v16H16z" fill="#aeb6c5"/></pattern></defs><rect width="100%" height="100%" fill="url(#c)"/></svg>`)
}

async function makeQaContactSheet(files, key, background) {
  const thumbWidth = 220
  const thumbHeight = 330
  const columns = 7
  const rows = Math.ceil(files.length / columns)
  const composites = []

  for (let index = 0; index < files.length; index++) {
    const image = await sharp(files[index])
      .resize(thumbWidth, thumbHeight, { fit: 'contain' })
      .png()
      .toBuffer()
    composites.push({
      input: image,
      left: (index % columns) * thumbWidth,
      top: Math.floor(index / columns) * thumbHeight,
    })
  }

  const canvas = key === 'checker'
    ? sharp(checkerSvg(columns * thumbWidth, rows * thumbHeight))
    : sharp({
        create: {
          width: columns * thumbWidth,
          height: rows * thumbHeight,
          channels: 3,
          background,
        },
      })

  await canvas.composite(composites).webp({ quality: 86 }).toFile(join(qaRoot, `characters-${key}.webp`))
}

async function main() {
  const sources = await collectSources(sourceRoot)
  const outputs = []
  const report = {}
  await mkdir(qaRoot, { recursive: true })

  for (const source of sources) {
    const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const keyed = keyedPixels(data, info.width, info.height)
    const output = source.replace(/-source\.png$/u, '.webp')
    await mkdir(dirname(output), { recursive: true })
    await sharp(keyed.pixels, {
      raw: { width: info.width, height: info.height, channels: 4 },
    }).webp({ quality: 92, alphaQuality: 100 }).toFile(output)
    outputs.push(output)
    report[relative(sourceRoot, output)] = keyed.report
  }

  await Promise.all(Object.entries(backgrounds).map(([key, background]) => (
    makeQaContactSheet(outputs, key, background)
  )))
  await writeFile(join(qaRoot, 'alpha-report.json'), `${JSON.stringify(report, null, 2)}\n`)

  const curious = await readFile(join(sourceRoot, 'observer/standing/curious.webp'))
  const curiousStats = await sharp(curious).stats()
  if (!curiousStats.isOpaque && report['observer/standing/curious.webp'].opaquePixels > 300_000) {
    process.stdout.write(`Re-keyed ${outputs.length} character assets; observer/curious subject retained.\n`)
    return
  }
  throw new Error('observer/curious alpha validation failed')
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
  await main()
