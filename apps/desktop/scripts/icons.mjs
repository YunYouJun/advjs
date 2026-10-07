import { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'

const assets = resolve(import.meta.dirname, '../assets')
const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024]

// Only the layered source, badge and lossless fallback are versioned.
// Generate portable icons without Xcode; compile the native catalog when available.
export async function prepareDesktopIcons({ assetsPath = assets, native = 'auto', refreshSource = false } = {}) {
  const output = resolve(assetsPath, 'generated')
  const tools = native === false && !refreshSource ? undefined : nativeTools()
  if ((native === true || refreshSource) && !tools)
    throw new Error('Native icon compilation requires macOS with Xcode and Icon Composer. Source refresh requires Xcode 27 or later.')
  await mkdir(output, { recursive: true })
  if (refreshSource)
    await refreshFallback(assetsPath, tools)
  const production = await readFile(resolve(assetsPath, 'icon-fallback.webp'))
  const badge = await readFile(resolve(assetsPath, 'dev-badge.svg'))
  const development = await sharp(production).composite([{ input: badge }]).png().toBuffer()
  for (const [name, input] of [['icon', production], ['icon-dev', development]]) {
    const images = new Map(await Promise.all(sizes.map(async (size) => {
      const png = await sharp(input).resize(size, size).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer()
      return [size, png]
    })))
    await writeFile(resolve(output, `${name}.icns`), encodeIcns(images))
    await writeFile(resolve(output, `${name}.png`), images.get(1024))
    await writeFile(resolve(output, `${name}.ico`), encodeIco(images))
  }
  // Remove stale catalogs before compilation or a fallback build without Xcode.
  await rm(resolve(output, 'Assets.car'), { force: true })
  if (tools)
    await compileNativeCatalog(assetsPath, output)
  process.stdout.write(`Generated desktop icons in assets/generated/ (${tools ? 'native catalog included' : 'portable fallback'}).\n`)
  return { output, nativeCatalog: !!tools }
}

function nativeTools() {
  if (process.platform !== 'darwin')
    return undefined
  let developer
  try {
    developer = execFileSync('xcode-select', ['-p'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  }
  catch {
    return undefined
  }
  // xcrun's ictool is an actool alias; use Icon Composer's image exporter.
  const exporter = resolve(developer, '../Applications/Icon Composer.app/Contents/Executables/ictool')
  return existsSync(exporter) ? { exporter } : undefined
}

async function compileNativeCatalog(assetsPath, output) {
  const temporary = await mkdtemp(resolve(tmpdir(), 'advjs-native-icons-'))
  try {
    execFileSync('xcrun', [
      'actool',
      resolve(assetsPath, 'ADVJSEditor.icon'),
      '--compile',
      temporary,
      '--output-format',
      'human-readable-text',
      '--notices',
      '--warnings',
      '--errors',
      '--output-partial-info-plist',
      resolve(temporary, 'Info.plist'),
      '--app-icon',
      'ADVJSEditor',
      '--include-all-app-icons',
      '--enable-on-demand-resources',
      'NO',
      '--development-region',
      'en',
      '--target-device',
      'mac',
      '--minimum-deployment-target',
      '11.0',
      '--platform',
      'macosx',
    ], { stdio: 'inherit' })
    await copyFile(resolve(temporary, 'Assets.car'), resolve(output, 'Assets.car'))
  }
  finally {
    await rm(temporary, { recursive: true, force: true })
  }
}

async function refreshFallback(assetsPath, tools) {
  const temporary = await mkdtemp(resolve(tmpdir(), 'advjs-rendered-icon-'))
  try {
    const rendered = resolve(temporary, 'rendered.png')
    execFileSync(tools.exporter, [
      resolve(assetsPath, 'ADVJSEditor.icon'),
      '--export-image',
      '--output-file',
      rendered,
      '--platform',
      'macOS',
      '--rendition',
      'Default',
      '--width',
      '1024',
      '--height',
      '1024',
      '--scale',
      '1',
      '--design-generation',
      '27',
    ], { stdio: 'inherit' })
    const tile = await sharp(rendered).resize(824, 824).png().toBuffer()
    // Keep the native layers square; only the legacy fallback gets Dock padding.
    const flattened = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
      <defs><filter id="shadow" x="0" y="0" width="1024" height="1024" filterUnits="userSpaceOnUse">
        <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#142b46" flood-opacity=".18"/>
      </filter></defs>
      <image x="100" y="100" width="824" height="824" href="data:image/png;base64,${tile.toString('base64')}" filter="url(#shadow)"/>
    </svg>`)
    await sharp(flattened).webp({ lossless: true, quality: 100, effort: 6 }).toFile(resolve(assetsPath, 'icon-fallback.webp'))
  }
  finally {
    await rm(temporary, { recursive: true, force: true })
  }
}

function encodeIcns(images) {
  const frames = [['icp4', 16], ['icp5', 32], ['icp6', 64], ['ic07', 128], ['ic08', 256], ['ic09', 512], ['ic10', 1024]].map(([type, size]) => {
    const png = images.get(size)
    const header = Buffer.alloc(8)
    header.write(type, 0, 'ascii')
    header.writeUInt32BE(8 + png.length, 4)
    return Buffer.concat([header, png])
  })
  const header = Buffer.alloc(8)
  header.write('icns', 0, 'ascii')
  header.writeUInt32BE(8 + frames.reduce((total, frame) => total + frame.length, 0), 4)
  return Buffer.concat([header, ...frames])
}

function encodeIco(images) {
  // ICO directory followed by PNG frames, preserving alpha and small-size detail.
  const windowsSizes = [16, 24, 32, 48, 64, 128, 256]
  const frames = windowsSizes.map(size => images.get(size))
  const directory = Buffer.alloc(6 + windowsSizes.length * 16)
  directory.writeUInt16LE(1, 2)
  directory.writeUInt16LE(windowsSizes.length, 4)
  let offset = directory.length
  for (const [index, size] of windowsSizes.entries()) {
    const entry = 6 + index * 16
    directory[entry] = size % 256
    directory[entry + 1] = size % 256
    directory.writeUInt16LE(1, entry + 4)
    directory.writeUInt16LE(32, entry + 6)
    directory.writeUInt32LE(frames[index].length, entry + 8)
    directory.writeUInt32LE(offset, entry + 12)
    offset += frames[index].length
  }
  return Buffer.concat([directory, ...frames])
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const options = process.argv.slice(2)
  if (options.some(option => !['--native', '--refresh-source'].includes(option)))
    throw new Error('Usage: icons.mjs [--native] [--refresh-source]')
  await prepareDesktopIcons({ native: options.includes('--native') ? true : 'auto', refreshSource: options.includes('--refresh-source') })
}
