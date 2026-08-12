import { Buffer } from 'node:buffer'
import { mkdir, readdir } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { keyedPixels } from '../../../skills/adv-art/scripts/key-connected-chroma.mjs'

const scriptRoot = dirname(fileURLToPath(import.meta.url))
const assetRoot = resolve(scriptRoot, '../../../temp/hamster-art')
const cgRoot = join(assetRoot, 'cg')
const backgroundRoot = join(assetRoot, 'backgrounds')
const animationRoot = join(assetRoot, 'characters/pet-hamster/animations')

function escapeXml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

async function prepareBackgrounds() {
  const sources = (await readdir(backgroundRoot))
    .filter(file => file.endsWith('-source.png'))
    .sort()
  const slotWidth = 480
  const imageHeight = 320
  const labelHeight = 28
  const columns = 3
  const composites = []

  for (const [index, file] of sources.entries()) {
    const id = basename(file, '-source.png')
    const source = join(backgroundRoot, file)
    const output = join(backgroundRoot, `${id}.webp`)
    await sharp(source)
      .resize(1536, 1024, { fit: 'cover', position: 'attention' })
      .webp({ quality: 91 })
      .toFile(output)
    const thumbnail = await sharp(output)
      .resize(slotWidth, imageHeight, { fit: 'cover' })
      .webp({ quality: 82 })
      .toBuffer()
    const left = (index % columns) * slotWidth
    const top = Math.floor(index / columns) * (imageHeight + labelHeight)
    composites.push({ input: thumbnail, left, top })
    composites.push({
      input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${slotWidth}" height="${labelHeight}"><rect width="100%" height="100%" fill="#070a12"/><text x="8" y="19" fill="#b8c3d6" font-family="monospace" font-size="13">${escapeXml(id)}</text></svg>`),
      left,
      top: top + imageHeight,
    })
  }

  const rows = Math.ceil(sources.length / columns)
  await sharp({
    create: {
      width: columns * slotWidth,
      height: rows * (imageHeight + labelHeight),
      channels: 3,
      background: '#070a12',
    },
  }).composite(composites).webp({ quality: 88 }).toFile(join(assetRoot, 'contact-backgrounds.webp'))
}

async function prepareCg() {
  const sources = (await readdir(cgRoot))
    .filter(file => file.endsWith('-source.png'))
    .sort()
  const contactComposites = []

  for (const [index, file] of sources.entries()) {
    const id = basename(file, '-source.png')
    const source = join(cgRoot, file)
    const output = join(cgRoot, `${id}.webp`)
    const thumbnail = join(cgRoot, `${id}.thumbnail.webp`)
    await sharp(source)
      .resize(1536, 1024, { fit: 'cover', position: 'attention' })
      .webp({ quality: 91 })
      .toFile(output)
    const thumb = await sharp(source)
      .resize(384, 256, { fit: 'cover', position: 'attention' })
      .webp({ quality: 82 })
      .toBuffer()
    await sharp(thumb).toFile(thumbnail)
    contactComposites.push({
      input: thumb,
      left: (index % 4) * 384,
      top: Math.floor(index / 4) * 256,
    })
  }

  await sharp({
    create: { width: 1536, height: 512, channels: 3, background: '#070a12' },
  }).composite(contactComposites).webp({ quality: 88 }).toFile(join(assetRoot, 'contact-cg.webp'))
}

async function prepareRunningSprite() {
  const source = join(animationRoot, 'running-grid-source.png')
  const metadata = await sharp(source).metadata()
  if (metadata.width !== 1536 || metadata.height !== 1024)
    throw new Error(`running sprite grid must be 1536x1024, received ${metadata.width}x${metadata.height}`)

  const frames = []
  for (let index = 0; index < 6; index++) {
    const left = (index % 3) * 512
    const top = Math.floor(index / 3) * 512
    const { data, info } = await sharp(source)
      .extract({ left, top, width: 512, height: 512 })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const keyed = keyedPixels(data, info.width, info.height)
    const subject = await sharp(keyed.pixels, {
      raw: { width: 512, height: 512, channels: 4 },
    })
      .trim({ background: '#00000000', threshold: 8 })
      .resize({ height: 290, fit: 'inside', withoutEnlargement: false })
      .png()
      .toBuffer({ resolveWithObject: true })
    const anchorY = 430
    const shadow = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><defs><filter id="b"><feGaussianBlur stdDeviation="12"/></filter></defs><ellipse cx="256" cy="432" rx="115" ry="18" fill="#07101b" opacity=".28" filter="url(#b)"/></svg>')
    const normalized = await sharp({
      create: { width: 512, height: 512, channels: 4, background: '#00000000' },
    }).composite([
      { input: shadow, left: 0, top: 0 },
      {
        input: subject.data,
        left: Math.round((512 - subject.info.width) / 2),
        top: anchorY - subject.info.height,
      },
    ]).png().toBuffer()
    frames.push(normalized)
  }

  const frameWidth = 512
  const frameHeight = 512
  const output = join(animationRoot, 'running.webp')
  const composites = frames.map((input, index) => ({ input, left: index * frameWidth, top: 0 }))
  await sharp({
    create: { width: frameWidth * frames.length, height: frameHeight, channels: 4, background: '#00000000' },
  }).composite(composites).webp({ quality: 91, alphaQuality: 100 }).toFile(output)

  const checker = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="3072" height="512"><defs><pattern id="c" width="32" height="32" patternUnits="userSpaceOnUse"><rect width="32" height="32" fill="#f2f2ee"/><path d="M0 0h16v16H0zM16 16h16v16H16z" fill="#aeb6c5"/></pattern></defs><rect width="100%" height="100%" fill="url(#c)"/></svg>')
  await sharp(checker).composite([{ input: output }]).webp({ quality: 86 }).toFile(join(animationRoot, 'running-qa.webp'))
}

await mkdir(cgRoot, { recursive: true })
await mkdir(backgroundRoot, { recursive: true })
await mkdir(animationRoot, { recursive: true })
await prepareBackgrounds()
await prepareCg()
await prepareRunningSprite()
process.stdout.write('Prepared 15 backgrounds, 8 CGs, contact sheets, and six-frame hamster animation.\n')
