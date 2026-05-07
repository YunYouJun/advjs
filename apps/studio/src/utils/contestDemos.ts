/**
 * Contest demo registry — bundles `examples/ai-contest/<slug>/adv/` content into
 * the Studio bundle at build time, so the 3 赛事 demos can be hydrated into a
 * fresh project (via MemoryFsAdapter) with zero filesystem-permission prompts
 * and zero network dependency.
 *
 * Mirrors the pattern used by `templates/loadTemplate.ts` for YAMLs.
 *
 * Adding a new demo:
 *   1. Drop `adv/**\/*.md` files under `examples/ai-contest/<slug>/`
 *   2. Add a row to `CONTEST_DEMOS` below with display metadata
 *   3. Done — the glob will pick it up automatically
 */

// Vite glob: eager + raw. Returns { [absolute-relative-path]: string }.
// Path goes 4 levels up from this file (utils → src → studio → apps → repo root).
const ADV_FILES = import.meta.glob('../../../../examples/ai-contest/*/adv/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export interface ContestDemoMeta {
  /** Stable slug used both as folder name in examples/ and as projectId in studio store. */
  slug: string
  /** Display name shown in UI. */
  name: string
  /** One-line description for the action card. */
  description: string
  /** i18n key for the name. Falls back to `name` if missing. */
  nameKey?: string
  /** i18n key for the description. */
  descKey?: string
}

/**
 * Curated list of demos to surface in Studio. Order = display order.
 * The slug must match a directory under `examples/ai-contest/`.
 */
export const CONTEST_DEMOS: ContestDemoMeta[] = [
  {
    slug: 'life-story',
    name: '奶奶的一生',
    description: '人生故事 ADV · AI 向善·时光忆站',
    nameKey: 'contestDemo.lifeStoryName',
    descKey: 'contestDemo.lifeStoryDesc',
  },
  {
    slug: 'history-talk',
    name: '跨越时空的对谈',
    description: '与孔子 / 图灵 / 达芬奇对话 · AI 教育创新',
    nameKey: 'contestDemo.historyTalkName',
    descKey: 'contestDemo.historyTalkDesc',
  },
  {
    slug: 'murder-mystery',
    name: '雪夜庄园',
    description: 'AI 剧本杀 · 6 NPC + 多结局',
    nameKey: 'contestDemo.murderMysteryName',
    descKey: 'contestDemo.murderMysteryDesc',
  },
]

/**
 * One bundled file ready to be written into MemoryFs.
 * `path` is project-relative (e.g. `adv/world.md`).
 */
export interface DemoFile {
  path: string
  content: string
}

/**
 * Read all bundled `adv/**\/*.md` files belonging to the given demo.
 *
 * Returns an empty array if the slug is unknown. We intentionally don't throw
 * — the caller decides how to surface "demo not bundled" (probably dev-only
 * misconfiguration that build would have caught).
 */
export function loadContestDemoFiles(slug: string): DemoFile[] {
  const needle = `/examples/ai-contest/${slug}/`
  const out: DemoFile[] = []
  for (const [absPath, content] of Object.entries(ADV_FILES)) {
    if (!absPath.includes(needle))
      continue
    // Strip everything before "adv/" so the path becomes project-relative.
    const idx = absPath.indexOf('/adv/')
    if (idx < 0)
      continue
    const projectRel = absPath.slice(idx + 1) // "adv/..."
    out.push({ path: projectRel, content })
  }
  // Stable order — characters first, then chapters, scenes, locations,
  // knowledge — matches the pipeline output order users are familiar with.
  return out.sort((a, b) => a.path.localeCompare(b.path))
}

/**
 * Quick existence check for build-time validation. Returns true if the slug
 * has at least one bundled `.md` file.
 */
export function hasContestDemo(slug: string): boolean {
  const needle = `/examples/ai-contest/${slug}/`
  return Object.keys(ADV_FILES).some(p => p.includes(needle))
}

/**
 * Stable projectId we use when installing a contest demo. Prefixed so it's
 * obvious in IndexedDB / project list that this is a bundled demo, not a
 * user-created project.
 */
export function contestDemoProjectId(slug: string): string {
  return `demo-${slug}`
}
