import type { AdvMusicMetadata } from '@advjs/types'

export const musicUsages = ['background', 'theme', 'opening', 'ending', 'insert'] as const

function fail(message: string): never {
  throw new Error(`MUSIC_METADATA_INVALID: ${message}`)
}

function record(input: unknown, fields: string[], name: string): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input)))
    fail(`${name} must be a JSON object`)
  for (const key of Object.keys(input)) {
    if (!fields.includes(key))
      fail(`${name} contains an unsupported field`)
  }
  return input as Record<string, unknown>
}

function text(input: unknown, name: string, maximum = 4000): string {
  if (typeof input !== 'string' || !input.trim() || input.length > maximum || [...input].some((character) => {
    const code = character.charCodeAt(0)
    return (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127
  })) {
    fail(`${name} must be nonempty bounded text`)
  }
  return input
}

function optionalText(input: Record<string, unknown>, name: string, maximum?: number) {
  return input[name] === undefined ? {} : { [name]: text(input[name], name, maximum) }
}

/** Finite author-only schema: credentials, media URLs and executable settings have no fields. */
export function parseAdvMusicMetadata(input: unknown): AdvMusicMetadata {
  const value = record(input, ['schemaVersion', 'usage', 'source', 'brief', 'rights', 'review'], 'music')
  if (value.schemaVersion !== 1 || !musicUsages.includes(value.usage as typeof musicUsages[number]))
    fail('music must declare schema version 1 and a musical usage')
  const source = record(value.source, ['type', 'tool', 'url'], 'source')
  if (typeof source.type !== 'string' || !['manual', 'external-ai'].includes(source.type))
    fail('source must be manual or external-ai')
  let sourceUrl: string | undefined
  if (source.url !== undefined) {
    const raw = text(source.url, 'source URL', 2048)
    let url: URL
    try {
      url = new URL(raw)
    }
    catch {
      fail('source URL must be an absolute public HTTPS page')
    }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
      fail('source URL must use HTTPS without credentials, query or fragment')
    sourceUrl = url.href
  }
  let brief: AdvMusicMetadata['brief']
  if (value.brief !== undefined) {
    const input = record(value.brief, ['summary', 'mood', 'style', 'durationSeconds', 'tempoBpm', 'instrumental', 'loopIntent', 'notes'], 'brief')
    for (const [key, maximum] of [['durationSeconds', 86400], ['tempoBpm', 1000]] as const) {
      if (input[key] !== undefined && (typeof input[key] !== 'number' || !Number.isFinite(input[key]) || input[key] <= 0 || input[key] > maximum))
        fail(`${key} must be a finite positive creation target`)
    }
    for (const key of ['instrumental', 'loopIntent'] as const) {
      if (input[key] !== undefined && typeof input[key] !== 'boolean')
        fail(`${key} must be a boolean`)
    }
    brief = {
      summary: text(input.summary, 'summary'),
      ...optionalText(input, 'mood', 500),
      ...optionalText(input, 'style', 500),
      ...optionalText(input, 'notes'),
      ...(input.durationSeconds === undefined ? {} : { durationSeconds: input.durationSeconds as number }),
      ...(input.tempoBpm === undefined ? {} : { tempoBpm: input.tempoBpm as number }),
      ...(input.instrumental === undefined ? {} : { instrumental: input.instrumental as boolean }),
      ...(input.loopIntent === undefined ? {} : { loopIntent: input.loopIntent as boolean }),
    }
  }
  let rights: AdvMusicMetadata['rights']
  if (value.rights !== undefined) {
    const input = record(value.rights, ['license', 'credit', 'permissionNote'], 'rights')
    rights = { license: text(input.license, 'license', 300), ...optionalText(input, 'credit', 1000), ...optionalText(input, 'permissionNote') }
  }
  const review = record(value.review, ['status', 'sha256', 'reviewedAt'], 'review')
  if (typeof review.status !== 'string' || !['pending', 'approved', 'rejected'].includes(review.status))
    fail('review status must be pending, approved or rejected')
  if (review.sha256 !== undefined && (typeof review.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(review.sha256)))
    fail('review must bind a lowercase master SHA-256')
  if (review.reviewedAt !== undefined && (typeof review.reviewedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(review.reviewedAt) || !Number.isFinite(Date.parse(review.reviewedAt)) || new Date(review.reviewedAt).toISOString() !== review.reviewedAt))
    fail('review date must be an ISO UTC timestamp')
  if (review.status === 'approved' && (!review.sha256 || !review.reviewedAt || !rights))
    fail('approved music must retain its reviewed master hash, date and license')
  return {
    schemaVersion: 1,
    usage: value.usage as AdvMusicMetadata['usage'],
    source: { type: source.type as AdvMusicMetadata['source']['type'], ...optionalText(source, 'tool', 100), ...(sourceUrl ? { url: sourceUrl } : {}) },
    ...(brief ? { brief } : {}),
    ...(rights ? { rights } : {}),
    review: { status: review.status as AdvMusicMetadata['review']['status'], ...(review.sha256 ? { sha256: review.sha256 as string } : {}), ...(review.reviewedAt ? { reviewedAt: review.reviewedAt as string } : {}) },
  }
}
