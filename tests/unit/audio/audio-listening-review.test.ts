// @vitest-environment node
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { request } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Ajv from 'ajv'
import { afterEach, describe, expect, it } from 'vitest'
import { createListeningReviewServer, loadListeningPackage, prepareListeningReview, validateListeningReview } from '../../../scripts/audio-listening-review.mjs'
import { listeningCoverage } from '../../../scripts/lib/audio-listening-page.mjs'

const roots: string[] = []
const hosts: Array<{ close: () => Promise<unknown> }> = []
afterEach(async () => {
  for (const host of hosts.splice(0))
    await host.close()
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true })
})
function wav(index: number) {
  const bytes = Buffer.alloc(48044)
  bytes.write('RIFF')
  bytes.writeUInt32LE(bytes.length - 8, 4)
  bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16)
  bytes.writeUInt16LE(1, 20)
  bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(24000, 24)
  bytes.writeUInt32LE(48000, 28)
  bytes.writeUInt16LE(2, 32)
  bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36)
  bytes.writeUInt32LE(48000, 40)
  bytes.writeInt16LE(index + 1, 44)
  return bytes
}
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'advjs-listening-'))
  roots.push(root)
  const evidenceRoot = join(root, 'evidence')
  for (const [hostIndex, host] of ['editor', 'studio'].entries()) {
    await mkdir(join(evidenceRoot, host, 'audio'), { recursive: true })
    await mkdir(join(evidenceRoot, host, 'provider'))
    for (const [index, condition] of ['design-audition', 'design-dialogue', 'base-audition', 'base-dialogue'].entries()) {
      const bytes = wav(hostIndex * 4 + index)
      await writeFile(join(evidenceRoot, host, 'audio', `${condition}.wav`), bytes)
      await writeFile(join(evidenceRoot, host, 'provider', `${condition}.manifest.json`), JSON.stringify({ samples: [{ bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), text: condition.endsWith('audition') ? '同一试听文本。' : '同一对白文本。', description: `Host ${hostIndex} original voice`, ...(condition.startsWith('base-') ? { reference: { sha256: createHash('sha256').update(wav(hostIndex * 4)).digest('hex'), text: '同一试听文本。' } } : {}) }], notPublic: { sensitiveAuthorMetadata: 'never exported' } }))
    }
  }
  return { evidenceRoot, output: join(root, 'package') }
}

describe('anonymous personal human listening package', () => {
  it('copies eight original WAVs exactly, records private provenance, exports only finite portable artifacts and preserves correct same-character pairs', async () => {
    const input = await fixture()
    const result = await prepareListeningReview(input)
    expect(result).toMatchObject({ samples: 8, pairs: 4, status: 'pending' })
    const { manifest } = await loadListeningPackage(input.output)
    const privateMap = JSON.parse(await readFile(join(input.output, 'private-audit-map.json'), 'utf8'))
    for (const row of manifest.samples) {
      const source = privateMap.samples.find((item: { id: string }) => item.id === row.id)
      expect(await readFile(join(input.output, row.src))).toEqual(await readFile(join(input.evidenceRoot, source.source)))
      const reference = row.referenceId && privateMap.samples.find((item: { id: string }) => item.id === row.referenceId)
      if (reference) {
        expect(reference.host).toBe(source.host)
        expect(reference.condition).toBe('design-audition')
      }
    }
    for (const pair of manifest.pairs) {
      const [left, right] = pair.samples.map((id: string) => privateMap.samples.find((item: { id: string }) => item.id === id))
      expect(left.host).toBe(right.host)
      expect(left.text).toBe(right.text)
    }
    const zip = await readFile(result.portableZip)
    const filenames: string[] = []
    let cursor = zip.readUInt32LE(zip.length - 6)
    while (zip.readUInt32LE(cursor) === 0x02014B50) {
      const length = zip.readUInt16LE(cursor + 28)
      filenames.push(zip.toString('utf8', cursor + 46, cursor + 46 + length))
      cursor += 46 + length + zip.readUInt16LE(cursor + 30) + zip.readUInt16LE(cursor + 32)
    }
    expect(filenames).toHaveLength(11)
    expect(filenames).not.toContain('private-audit-map.json')
    expect(zip.toString()).not.toContain('sensitiveAuthorMetadata')
    expect(zip.toString()).not.toContain(input.evidenceRoot)
    expect(zip.subarray(0, 4).readUInt32LE()).toBe(0x04034B50)
    await expect(prepareListeningReview(input)).rejects.toThrow()
  })

  it('refuses altered source audio before creating a package and detects alteration before serving media', async () => {
    const input = await fixture()
    const source = join(input.evidenceRoot, 'editor/audio/design-audition.wav')
    const original = await readFile(source)
    await writeFile(source, wav(99))
    await expect(prepareListeningReview(input)).rejects.toThrow('SOURCE_SHA_MISMATCH')
    await writeFile(source, original)
    await prepareListeningReview(input)
    const { manifest } = await loadListeningPackage(input.output)
    const server = await createListeningReviewServer({ packageRoot: input.output })
    hosts.push(server)
    await writeFile(join(input.output, manifest.samples[0].src), wav(99))
    expect((await fetch(new URL(manifest.samples[0].src, server.url))).status).toBe(409)
    await expect(loadListeningPackage(input.output)).rejects.toThrow('PACKAGE_SHA_MISMATCH')
  })

  it('rejects a claimed conditioning reference that is not the original same-character design audition', async () => {
    const input = await fixture()
    const path = join(input.evidenceRoot, 'studio/provider/base-audition.manifest.json')
    const metadata = JSON.parse(await readFile(path, 'utf8'))
    metadata.samples[0].reference.sha256 = 'f'.repeat(64)
    await writeFile(path, JSON.stringify(metadata))
    await expect(prepareListeningReview(input)).rejects.toThrow('REFERENCE_SOURCE_MISMATCH')
  })

  it('serves GET/HEAD/Range original public samples while denying private maps, ZIPs, traversal, queries and write methods', async () => {
    const input = await fixture()
    await prepareListeningReview(input)
    const { manifest } = await loadListeningPackage(input.output)
    const server = await createListeningReviewServer({ packageRoot: input.output })
    hosts.push(server)
    const sample = manifest.samples[0]
    const url = new URL(sample.src, server.url)
    const range = await fetch(url, { headers: { range: 'bytes=10-19' } })
    expect(range.status).toBe(206)
    expect(range.headers.get('content-range')).toBe(`bytes 10-19/${sample.bytes}`)
    expect(Buffer.from(await range.arrayBuffer())).toEqual((await readFile(join(input.output, sample.src))).subarray(10, 20))
    const head = await fetch(url, { method: 'HEAD' })
    expect(head.status).toBe(200)
    expect(head.headers.get('content-type')).toBe('audio/wav')
    expect((await head.arrayBuffer()).byteLength).toBe(0)
    for (const path of ['private-audit-map.json', 'archive-index.json', 'portable-listening.zip', '%2e%2e/private-audit-map.json', `${sample.src}?download=true`])
      expect((await fetch(new URL(path, server.url))).status).toBe(404)
    expect((await fetch(server.url, { method: 'POST' })).status).toBe(405)
    expect((await fetch(url, { headers: { range: 'bytes=999999-' } })).status).toBe(416)
    const hostStatus = await new Promise<number | undefined>((done, reject) => {
      const connection = request(server.url, { headers: { host: 'external.example' } }, (response) => {
        response.resume()
        done(response.statusCode)
      })
      connection.once('error', reject)
      connection.end()
    })
    expect(hostStatus).toBe(403)
    expect((await fetch(server.url)).headers.get('content-security-policy')).toContain('connect-src \'none\'')
  })

  it('keeps unfilled scores pending, requires real-play coverage and explicit human provenance, and excludes simulated complete grades from MOS', async () => {
    const input = await fixture()
    await prepareListeningReview(input)
    const { manifest } = await loadListeningPackage(input.output)
    const review = {
      schemaVersion: 1,
      kind: 'advjs-human-listening-review',
      packageId: manifest.id,
      createdAt: new Date().toISOString(),
      status: 'pending',
      provenance: 'pending',
      environment: { reviewerId: '', device: '', outputMode: '', systemVolume: '', language: '', notes: '', userAgent: 'test simulation' },
      samples: manifest.samples.map((sample: { id: string, sha256: string, text: string }) => ({ sampleId: sample.id, sha256: sample.sha256, text: sample.text, scores: Object.fromEntries(manifest.dimensions.map((dimension: string) => [dimension, null])), notes: '', plays: [], endedCount: 0 })),
      summary: { standardMOS: null, note: 'No automated auditory scores.' },
    }
    const schema = JSON.parse(await readFile(new URL('../../../scripts/audio-listening-review.schema.json', import.meta.url), 'utf8'))
    const validate = new Ajv({ strict: true }).compile(schema)
    expect(validate(review), JSON.stringify(validate.errors)).toBe(true)
    expect(validateListeningReview(review, manifest)).toMatchObject({ status: 'pending', eligibleHumanReview: false, standardMOS: null })
    const simulated = structuredClone(review)
    simulated.status = 'complete'
    simulated.provenance = 'simulation'
    Object.assign(simulated.environment, { reviewerId: 'test-only', device: 'test-only', outputMode: 'test-only', systemVolume: 'test-only', language: 'zh-CN' })
    simulated.samples.forEach((sample: { scores: Record<string, number | null>, endedCount: number, plays: object[] }) => {
      Object.keys(sample.scores).forEach(key => sample.scores[key] = 5)
      sample.endedCount = 1
      sample.plays = [{ startedAt: new Date().toISOString(), fromSeconds: 0.7, toSeconds: 1, rate: 1 }]
    })
    expect(() => validateListeningReview(simulated, manifest)).toThrow('INCOMPLETE')
    simulated.samples.forEach((sample: { plays: object[] }) => sample.plays = [{ startedAt: new Date().toISOString(), fromSeconds: 0, toSeconds: 1, rate: 1 }])
    expect(validateListeningReview(simulated, manifest)).toMatchObject({ eligibleHumanReview: false, provenance: 'simulation', standardMOS: null })
    expect(validate({ ...simulated, summary: { standardMOS: 5, note: 'invented' } })).toBe(false)
    simulated.samples[0].sha256 = 'f'.repeat(64)
    expect(() => validateListeningReview(simulated, manifest)).toThrow('SAMPLE_INVALID')
    expect(listeningCoverage([{ rate: 1, fromSeconds: 0, toSeconds: 0.5 }, { rate: 1, fromSeconds: 0.25, toSeconds: 1 }], 1)).toBe(1)
    expect(listeningCoverage([{ rate: 2, fromSeconds: 0, toSeconds: 1 }], 1)).toBe(0)
  })
})
