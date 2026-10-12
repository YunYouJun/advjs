#!/usr/bin/env node
import { Buffer } from 'node:buffer'
import { createHash, randomInt, randomUUID } from 'node:crypto'
import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { isAbsolute, relative, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { listeningCoverage, renderListeningPage } from './lib/audio-listening-page.mjs'

const LIMIT = 64 * 1024 * 1024
const SHA = /^[a-f0-9]{64}$/u
const dimensions = ['naturalness', 'clarity', 'textAccuracy', 'styleFit', 'edges', 'referenceConsistency']
const conditions = ['design-audition', 'design-dialogue', 'base-audition', 'base-dialogue']
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const json = value => `${JSON.stringify(value, null, 2)}\n`
const hasFields = (value, fields) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field))
const boundedText = (value, limit) => typeof value === 'string' && value.length <= limit

async function boundedFile(root, path, limit) {
  const file = await realpath(resolve(root, path))
  const inside = relative(root, file)
  if (!inside || inside.startsWith('..') || isAbsolute(inside))
    throw new Error('LISTENING_PATH_OUTSIDE_ROOT')
  const info = await stat(file)
  if (!info.isFile() || info.size > limit)
    throw new Error('LISTENING_FILE_LIMIT')
  const bytes = await readFile(file)
  if (bytes.length > limit)
    throw new Error('LISTENING_FILE_LIMIT')
  return bytes
}

/** Probe original PCM bytes without a decoder, model, transcoder or network. */
export function inspectListeningWav(bytes) {
  if (bytes.length < 44 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE' || bytes.readUInt32LE(4) + 8 !== bytes.length)
    throw new Error('LISTENING_WAV_INVALID')
  let format
  let frames
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const size = bytes.readUInt32LE(offset + 4)
    const start = offset + 8
    if (start + size > bytes.length)
      throw new Error('LISTENING_WAV_INVALID')
    const name = bytes.toString('ascii', offset, offset + 4)
    if (name === 'fmt ' && size >= 16) {
      const codec = bytes.readUInt16LE(start)
      const channels = bytes.readUInt16LE(start + 2)
      const sampleRate = bytes.readUInt32LE(start + 4)
      const blockAlign = bytes.readUInt16LE(start + 12)
      const bits = bytes.readUInt16LE(start + 14)
      if (codec !== 1 || ![1, 2].includes(channels) || sampleRate < 8000 || sampleRate > 192000 || ![16, 24, 32].includes(bits) || blockAlign !== channels * bits / 8)
        throw new Error('LISTENING_WAV_FORMAT_UNSUPPORTED')
      format = { channels, sampleRate, bits, blockAlign }
    }
    if (name === 'data') {
      if (!format || frames !== undefined || size % format.blockAlign)
        throw new Error('LISTENING_WAV_INVALID')
      frames = size / format.blockAlign
    }
    offset = start + size + (size % 2)
  }
  if (!format || !frames || frames / format.sampleRate > 60)
    throw new Error('LISTENING_WAV_DURATION_INVALID')
  return { durationSeconds: frames / format.sampleRate, sampleRate: format.sampleRate, channels: format.channels, bitsPerSample: format.bits }
}

function crc32(bytes) {
  let crc = 0xFFFFFFFF
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

/** Stored ZIP: original WAV bytes are never decoded or transformed. */
function portableZip(entries) {
  const local = []
  const central = []
  let offset = 0
  for (const [path, bytes] of entries) {
    const name = Buffer.from(path)
    const crc = crc32(bytes)
    const header = Buffer.alloc(30)
    header.writeUInt32LE(0x04034B50)
    header.writeUInt16LE(20, 4)
    header.writeUInt16LE(0x21, 12) // 1980-01-01
    header.writeUInt32LE(crc, 14)
    header.writeUInt32LE(bytes.length, 18)
    header.writeUInt32LE(bytes.length, 22)
    header.writeUInt16LE(name.length, 26)
    local.push(header, name, bytes)
    const row = Buffer.alloc(46)
    row.writeUInt32LE(0x02014B50)
    row.writeUInt16LE(20, 4)
    row.writeUInt16LE(20, 6)
    row.writeUInt16LE(0x21, 14)
    row.writeUInt32LE(crc, 16)
    row.writeUInt32LE(bytes.length, 20)
    row.writeUInt32LE(bytes.length, 24)
    row.writeUInt16LE(name.length, 28)
    row.writeUInt32LE(offset, 42)
    central.push(row, name)
    offset += header.length + name.length + bytes.length
  }
  const directory = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054B50)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...local, directory, end])
}

export async function prepareListeningReview({ evidenceRoot, output }) {
  if (typeof evidenceRoot !== 'string' || typeof output !== 'string' || !isAbsolute(evidenceRoot) || !isAbsolute(output))
    throw new Error('LISTENING_ABSOLUTE_PATH_REQUIRED')
  const root = await realpath(evidenceRoot)
  const records = []
  for (const host of ['editor', 'studio']) {
    const design = JSON.parse((await boundedFile(root, `${host}/provider/design-audition.manifest.json`, 1024 * 1024)).toString())
    const targetStyle = design.samples?.[0]?.description
    if (typeof targetStyle !== 'string' || targetStyle.length > 8000)
      throw new Error('LISTENING_SOURCE_METADATA_INVALID')
    for (const condition of conditions) {
      const source = `${host}/audio/${condition}.wav`
      const sourceManifest = `${host}/provider/${condition}.manifest.json`
      const metadataBytes = await boundedFile(root, sourceManifest, 1024 * 1024)
      const metadata = JSON.parse(metadataBytes.toString())
      const record = metadata.samples?.[0]
      if (metadata.samples?.length !== 1 || !SHA.test(record?.sha256) || typeof record?.text !== 'string' || !record.text.trim() || record.text.length > 4000)
        throw new Error('LISTENING_SOURCE_METADATA_INVALID')
      const bytes = await boundedFile(root, source, LIMIT)
      if (digest(bytes) !== record.sha256 || (record.bytes !== undefined && record.bytes !== bytes.length))
        throw new Error('LISTENING_SOURCE_SHA_MISMATCH')
      records.push({ host, condition, source, sourceManifest, sourceManifestSha256: digest(metadataBytes), bytes, text: record.text, targetStyle, sha256: record.sha256, ...(record.reference ? { conditioningReference: { sha256: record.reference.sha256, text: record.reference.text } } : {}), ...inspectListeningWav(bytes) })
    }
  }
  for (let index = records.length - 1; index > 0; index--) {
    const other = randomInt(index + 1)
    ;[records[index], records[other]] = [records[other], records[index]]
  }
  records.forEach((row, index) => row.id = `S${String(index + 1).padStart(2, '0')}`)
  const pairs = []
  for (const host of ['editor', 'studio']) {
    const reference = records.find(row => row.host === host && row.condition === 'design-audition')
    for (const sample of records.filter(row => row.host === host && row.condition.startsWith('base-'))) {
      if (sample.conditioningReference?.sha256 !== reference.sha256 || sample.conditioningReference?.text !== reference.text)
        throw new Error('LISTENING_REFERENCE_SOURCE_MISMATCH')
    }
    for (const phase of ['audition', 'dialogue']) {
      const pair = records.filter(row => row.host === host && row.condition.endsWith(phase))
      if (pair.length !== 2 || pair[0].text !== pair[1].text)
        throw new Error('LISTENING_PAIR_TEXT_MISMATCH')
      pairs.push({ id: `P${pairs.length + 1}`, samples: pair.map(row => row.id), relation: 'same-text-same-character-design-and-reference-conditioning' })
    }
  }
  const manifest = {
    schemaVersion: 1,
    kind: 'advjs-blind-human-listening-package',
    id: `listening-${randomUUID()}`,
    status: 'pending',
    audioPolicy: 'Original PCM WAV bytes; no transcoding, trimming, loudness normalization or playback-rate adjustment.',
    ratingsPolicy: 'Human observations only. Unfilled scores remain null. A personal descriptive review is not a standards-compliant MOS study. Different character groups are not expected to share one voice.',
    dimensions,
    scale: { 1: '很差', 2: '较差', 3: '一般', 4: '较好', 5: '很好' },
    samples: records.map(row => ({ id: row.id, src: `samples/${row.id}.wav`, sha256: row.sha256, bytes: row.bytes.length, text: row.text, targetStyle: row.targetStyle, durationSeconds: row.durationSeconds, sampleRate: row.sampleRate, channels: row.channels, bitsPerSample: row.bitsPerSample, referenceRole: row.conditioningReference ? 'conditioning-source' : 'listening-comparison-only', referenceId: row.condition === 'design-audition' ? null : records.find(reference => reference.host === row.host && reference.condition === 'design-audition').id })),
    pairs,
  }
  await mkdir(output, { recursive: false, mode: 0o700 })
  await mkdir(resolve(output, 'samples'), { mode: 0o700 })
  const entries = [
    ['index.html', Buffer.from(renderListeningPage(manifest))],
    ['listening-manifest.json', Buffer.from(json(manifest))],
    ['README.txt', Buffer.from('离线打开 index.html，保留 samples/ 与 listening-manifest.json。所有评分 pending；需真人听审。原 WAV SHA 已逐字节核验。private-audit-map.json 是揭盲钥匙，不公开、不入 ZIP。\n')],
    ...records.map(row => [`samples/${row.id}.wav`, row.bytes]),
  ]
  const privateMap = { schemaVersion: 1, kind: 'advjs-private-listening-audit', packageId: manifest.id, evidenceRoot: root, samples: records.map(({ bytes, ...row }) => ({ ...row, bytes: bytes.length })) }
  const privateEntries = [
    ['private-audit-map.json', Buffer.from(json(privateMap))],
    ['portable-listening.zip', portableZip(entries)],
  ]
  const files = []
  for (const [path, bytes] of [...entries, ...privateEntries]) {
    await writeFile(resolve(output, path), bytes, { flag: 'wx', mode: 0o600 })
    const saved = await boundedFile(await realpath(output), path, path.endsWith('.zip') ? 8 * LIMIT : LIMIT)
    if (!saved.equals(bytes))
      throw new Error('LISTENING_COPY_VERIFICATION_FAILED')
    files.push({ path, bytes: bytes.length, sha256: digest(saved), public: entries.some(entry => entry[0] === path) })
  }
  const audit = { schemaVersion: 1, kind: 'advjs-listening-artifact-audit', status: 'prepared-human-review-pending', packageId: manifest.id, sourceRoot: root, files }
  await writeFile(resolve(output, 'archive-index.json'), json(audit), { flag: 'wx', mode: 0o600 })
  return { packageRoot: output, packageId: manifest.id, samples: manifest.samples.length, pairs: manifest.pairs.length, status: 'pending', portableZip: resolve(output, 'portable-listening.zip'), audit: resolve(output, 'archive-index.json') }
}

export async function loadListeningPackage(packageRoot) {
  const root = await realpath(packageRoot)
  const manifest = JSON.parse((await boundedFile(root, 'listening-manifest.json', 256 * 1024)).toString())
  if (manifest.schemaVersion !== 1 || manifest.kind !== 'advjs-blind-human-listening-package' || !Array.isArray(manifest.samples) || manifest.samples.length !== 8 || !manifest.dimensions?.every((dimension, index) => dimension === dimensions[index]) || manifest.dimensions.length !== dimensions.length)
    throw new Error('LISTENING_PACKAGE_INVALID')
  const ids = new Set()
  const files = new Map([['/', ['index.html', 'text/html; charset=utf-8']], ['/index.html', ['index.html', 'text/html; charset=utf-8']], ['/listening-manifest.json', ['listening-manifest.json', 'application/json']]])
  for (const sample of manifest.samples) {
    if (!/^S0[1-8]$/u.test(sample.id) || ids.has(sample.id) || sample.src !== `samples/${sample.id}.wav` || !SHA.test(sample.sha256))
      throw new Error('LISTENING_PACKAGE_INVALID')
    ids.add(sample.id)
    const bytes = await boundedFile(root, sample.src, LIMIT)
    const format = inspectListeningWav(bytes)
    if (bytes.length !== sample.bytes || digest(bytes) !== sample.sha256 || format.durationSeconds !== sample.durationSeconds)
      throw new Error('LISTENING_PACKAGE_SHA_MISMATCH')
    files.set(`/${sample.src}`, [sample.src, 'audio/wav'])
  }
  return { root, manifest, files }
}

/** Only fixed public artifacts are served, even when private audit files share the directory. */
export async function createListeningReviewServer({ packageRoot, port = 0 }) {
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error('LISTENING_PORT_INVALID')
  const { root, manifest, files } = await loadListeningPackage(packageRoot)
  const server = createServer(async (request, response) => {
    const finish = status => response.writeHead(status, { 'Cache-Control': 'no-store' }).end()
    const address = server.address()
    if (request.headers.host !== `127.0.0.1:${address.port}`)
      return finish(403)
    if (!['GET', 'HEAD'].includes(request.method))
      return finish(405)
    const entry = files.get(request.url)
    if (!entry)
      return finish(404)
    try {
      const [path, mime] = entry
      const bytes = await boundedFile(root, path, LIMIT)
      const sample = manifest.samples.find(sample => sample.src === path)
      if (sample && (digest(bytes) !== sample.sha256 || bytes.length !== sample.bytes))
        return finish(409)
      const headers = { 'Content-Type': mime, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': 'default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; media-src \'self\'; connect-src \'none\'; img-src \'none\'; frame-ancestors \'none\'; form-action \'none\'; base-uri \'none\'', 'Accept-Ranges': 'bytes' }
      let from = 0
      let to = bytes.length - 1
      if (request.headers.range) {
        const range = /^bytes=(\d*)-(\d*)$/u.exec(request.headers.range)
        if (!sample || !range || !(range[1] || range[2]))
          return finish(416)
        from = range[1] ? Number(range[1]) : Math.max(0, bytes.length - Number(range[2]))
        to = range[1] && range[2] ? Number(range[2]) : to
        if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from > to || from >= bytes.length)
          return finish(416)
        to = Math.min(to, bytes.length - 1)
        headers['Content-Range'] = `bytes ${from}-${to}/${bytes.length}`
      }
      headers['Content-Length'] = String(to - from + 1)
      response.writeHead(request.headers.range ? 206 : 200, headers)
      response.end(request.method === 'HEAD' ? undefined : bytes.subarray(from, to + 1))
    }
    catch {
      finish(409)
    }
  })
  await new Promise((done, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', done)
  })
  return { server, url: `http://127.0.0.1:${server.address().port}/`, close: () => new Promise((done, reject) => server.close(error => error ? reject(error) : done())) }
}

/** Imported scores are observations, never evidence of an automated MOS result. */
export function validateListeningReview(review, manifest) {
  if (!hasFields(review, ['schemaVersion', 'kind', 'packageId', 'createdAt', 'status', 'provenance', 'environment', 'samples', 'summary']) || review.schemaVersion !== 1 || review.kind !== 'advjs-human-listening-review' || review.packageId !== manifest.id || !boundedText(review.createdAt, 80) || !Number.isFinite(Date.parse(review.createdAt)) || !['pending', 'complete'].includes(review.status) || !['pending', 'human-attested', 'simulation'].includes(review.provenance) || !Array.isArray(review.samples) || review.samples.length !== manifest.samples.length || !hasFields(review.summary, ['standardMOS', 'note']) || review.summary.standardMOS !== null || !boundedText(review.summary.note, 400))
    throw new Error('LISTENING_REVIEW_INVALID')
  const identifiers = new Set()
  let complete = true
  for (const sample of review.samples) {
    const expected = manifest.samples.find(row => row.id === sample.sampleId)
    if (!hasFields(sample, ['sampleId', 'sha256', 'text', 'scores', 'notes', 'plays', 'endedCount']) || !expected || identifiers.has(sample.sampleId) || sample.sha256 !== expected.sha256 || sample.text !== expected.text || !hasFields(sample.scores, dimensions) || !dimensions.every(key => sample.scores[key] === null || sample.scores[key] === 'na' || (Number.isInteger(sample.scores[key]) && sample.scores[key] >= 1 && sample.scores[key] <= 5)) || !boundedText(sample.notes, 4000) || !Array.isArray(sample.plays) || sample.plays.length > 1000 || !Number.isSafeInteger(sample.endedCount) || sample.endedCount < 0)
      throw new Error('LISTENING_REVIEW_SAMPLE_INVALID')
    identifiers.add(sample.sampleId)
    for (const play of sample.plays) {
      if (!hasFields(play, ['startedAt', 'fromSeconds', 'toSeconds', 'rate']) || !boundedText(play.startedAt, 80) || !Number.isFinite(Date.parse(play.startedAt)) || play.rate !== 1 || !Number.isFinite(play.fromSeconds) || !Number.isFinite(play.toSeconds) || play.fromSeconds < 0 || play.toSeconds < play.fromSeconds || play.toSeconds > expected.durationSeconds + 0.15)
        throw new Error('LISTENING_REVIEW_PLAYBACK_INVALID')
    }
    complete &&= sample.endedCount > 0 && listeningCoverage(sample.plays, expected.durationSeconds) >= 0.95 && dimensions.every(key => sample.scores[key] !== null)
  }
  const environment = review.environment
  const environmentLimits = { reviewerId: 80, device: 160, outputMode: 160, systemVolume: 160, language: 80, notes: 160, userAgent: 2000 }
  if (!hasFields(environment, Object.keys(environmentLimits)) || !Object.entries(environmentLimits).every(([field, limit]) => boundedText(environment[field], limit)))
    throw new Error('LISTENING_REVIEW_ENVIRONMENT_INVALID')
  complete &&= Boolean(environment && ['reviewerId', 'device', 'outputMode', 'systemVolume', 'language'].every(key => typeof environment[key] === 'string' && environment[key].trim() && environment[key].length <= 400))
  if (review.status === 'complete' && (!complete || review.provenance === 'pending'))
    throw new Error('LISTENING_REVIEW_INCOMPLETE')
  return { status: review.status, provenance: review.provenance, eligibleHumanReview: complete && review.status === 'complete' && review.provenance === 'human-attested', standardMOS: null, note: review.provenance === 'simulation' ? 'Simulation is excluded from human review and MOS.' : 'Human attestation and playback coverage support a personal review; a formal MOS study remains pending.' }
}

async function main(args) {
  if (!args.length || args.includes('--help')) {
    process.stdout.write('Usage:\n  node scripts/audio-listening-review.mjs prepare --evidence-root <absolute directory> --output <new absolute directory>\n  node scripts/audio-listening-review.mjs serve --package <absolute directory> [--port 8769]\n  node scripts/audio-listening-review.mjs validate-review --package <absolute directory> --review <absolute JSON>\nNo models or cloud requests. Scores remain pending until a human listens.\n')
    return
  }
  const [command, ...flags] = args
  const allowed = command === 'prepare' ? ['--evidence-root', '--output'] : command === 'serve' ? ['--package', '--port'] : command === 'validate-review' ? ['--package', '--review'] : []
  const options = {}
  for (let index = 0; index < flags.length; index += 2) {
    if (!allowed.includes(flags[index]) || typeof flags[index + 1] !== 'string' || flags[index + 1].startsWith('--') || options[flags[index]] !== undefined)
      throw new Error('LISTENING_ARGUMENT_INVALID')
    options[flags[index]] = flags[index + 1]
  }
  if (command === 'prepare') {
    process.stdout.write(json(await prepareListeningReview({ evidenceRoot: options['--evidence-root'], output: options['--output'] })))
  }
  else if (command === 'serve' && isAbsolute(options['--package'] ?? '')) {
    const host = await createListeningReviewServer({ packageRoot: options['--package'], port: options['--port'] === undefined ? 8769 : Number(options['--port']) })
    process.stdout.write(json({ url: host.url, scores: 'pending', publicFilesOnly: true }))
    for (const signal of ['SIGINT', 'SIGTERM'])
      process.once(signal, () => { void host.close().then(() => process.exit(0)) })
  }
  else if (command === 'validate-review' && isAbsolute(options['--review'] ?? '') && isAbsolute(options['--package'] ?? '')) {
    const { manifest } = await loadListeningPackage(options['--package'])
    if ((await stat(options['--review'])).size > 256 * 1024)
      throw new Error('LISTENING_REVIEW_LIMIT')
    process.stdout.write(json(validateListeningReview(JSON.parse(await readFile(options['--review'], 'utf8')), manifest)))
  }
  else {
    throw new Error('LISTENING_ARGUMENT_INVALID')
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    const code = typeof error?.message === 'string' && /^LISTENING_[A-Z_]+$/u.test(error.message) ? error.message : 'LISTENING_OPERATION_FAILED'
    process.stderr.write(`${JSON.stringify({ code })}\n`)
    process.exitCode = 1
  })
}
