import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'
import sharp from 'sharp'
import { prepareDesktopIcons } from './icons.mjs'

const source = resolve(import.meta.dirname, '../assets')

async function fixture(context) {
  const assetsPath = await mkdtemp(resolve(tmpdir(), 'advjs-icons-test-'))
  context.after(() => rm(assetsPath, { recursive: true, force: true }))
  for (const name of ['icon-fallback.webp', 'dev-badge.svg'])
    await copyFile(resolve(source, name), resolve(assetsPath, name))
  return assetsPath
}

test('a clean source-only checkout generates portable icons and clears stale catalogs', async (context) => {
  const assetsPath = await fixture(context)
  const input = await readFile(resolve(assetsPath, 'icon-fallback.webp'))
  await mkdir(resolve(assetsPath, 'generated'))
  await writeFile(resolve(assetsPath, 'generated/Assets.car'), 'stale catalog')
  const result = await prepareDesktopIcons({ assetsPath, native: false })
  assert.equal(result.nativeCatalog, false)
  assert.deepEqual((await readdir(result.output)).sort(), ['icon-dev.icns', 'icon-dev.ico', 'icon-dev.png', 'icon.icns', 'icon.ico', 'icon.png'])
  const production = await readFile(resolve(result.output, 'icon.png'))
  const development = await readFile(resolve(result.output, 'icon-dev.png'))
  assert.deepEqual(await sharp(production).ensureAlpha().raw().toBuffer(), await sharp(input).ensureAlpha().raw().toBuffer())
  assert.notDeepEqual(await sharp(development).raw().toBuffer(), await sharp(production).raw().toBuffer())
  const original = new Map(await Promise.all((await readdir(result.output)).map(async name => [name, await readFile(resolve(result.output, name))])))
  await prepareDesktopIcons({ assetsPath, native: false })
  for (const [name, data] of original)
    assert.deepEqual(await readFile(resolve(result.output, name)), data)
  assert.deepEqual(await readFile(resolve(assetsPath, 'icon-fallback.webp')), input)
})

test('Windows ICO frames have valid offsets, dimensions and decodable PNG data', async (context) => {
  const assetsPath = await fixture(context)
  const { output } = await prepareDesktopIcons({ assetsPath, native: false })
  for (const name of ['icon', 'icon-dev']) {
    const ico = await readFile(resolve(output, `${name}.ico`))
    assert.equal(ico.readUInt16LE(0), 0)
    assert.equal(ico.readUInt16LE(2), 1)
    assert.equal(ico.readUInt16LE(4), 7)
    let offset = 6 + 7 * 16
    for (const [index, size] of [16, 24, 32, 48, 64, 128, 256].entries()) {
      const entry = 6 + index * 16
      assert.equal(ico[entry] || 256, size)
      assert.equal(ico[entry + 1] || 256, size)
      assert.equal(ico.readUInt32LE(entry + 12), offset)
      const length = ico.readUInt32LE(entry + 8)
      const image = await sharp(ico.subarray(offset, offset + length)).metadata()
      assert.equal(image.format, 'png')
      assert.equal(image.width, size)
      assert.equal(image.height, size)
      offset += length
    }
    assert.equal(offset, ico.length)
  }
})

test('macOS iconutil accepts generated ICNS and exports its 1024px representation', { skip: process.platform !== 'darwin' }, async (context) => {
  const assetsPath = await fixture(context)
  const { output } = await prepareDesktopIcons({ assetsPath, native: false })
  for (const name of ['icon', 'icon-dev']) {
    const iconset = resolve(assetsPath, `${name}.iconset`)
    execFileSync('iconutil', ['--convert', 'iconset', '--output', iconset, resolve(output, `${name}.icns`)], { stdio: 'pipe' })
    const image = await readFile(resolve(iconset, 'icon_512x512@2x.png'))
    assert.equal((await sharp(image).metadata()).width, 1024)
    assert.deepEqual(await sharp(image).raw().toBuffer(), await sharp(resolve(output, `${name}.png`)).raw().toBuffer())
  }
})
