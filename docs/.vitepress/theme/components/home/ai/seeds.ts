import type { StoryLocale } from '../../../../../../packages/ai/src'

export interface StorySeed {
  /** Project files, `adv.config.json` and `adv/…`. */
  files: Record<string, string>
  /** Stands in when the model's segment fails twice. */
  fallback: string
}

const FALLBACK = 'fallback.adv.md'

// Raw source of each seed, bundled into the AI chunk only.
const seedFiles = import.meta.glob('./seeds/endless-tram/*/**/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
// A run generated ahead of time (`scripts/home-ai-sample.ts`), for visitors without a key.
const sampleFiles = import.meta.glob('./samples/endless-tram/*/**/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

function filesUnder(all: Record<string, string>, prefix: string): Record<string, string> {
  return Object.fromEntries(Object.entries(all)
    .filter(([path]) => path.startsWith(prefix))
    .map(([path, source]) => [path.slice(prefix.length), source]))
}

export function endlessTramSeed(locale: StoryLocale): StorySeed {
  const { [FALLBACK]: fallback, ...files } = filesUnder(seedFiles, `./seeds/endless-tram/${locale}/`)
  return { files, fallback }
}

/** The sample run's project files, if one has been generated for this language. */
export function endlessTramSample(locale: StoryLocale): Record<string, string> | undefined {
  const files = filesUnder(sampleFiles, `./samples/endless-tram/${locale}/`)
  return Object.keys(files).length ? files : undefined
}
