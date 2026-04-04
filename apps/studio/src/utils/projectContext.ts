/**
 * Shared project context assembly logic.
 * Used by useChatStore to load context from either local FS or COS cloud storage.
 */

const CONTEXT_SECTIONS = [
  { path: 'adv/world.md', heading: '## World Setting' },
  { path: 'adv/outline.md', heading: '## Story Outline' },
  { path: 'adv/chapters/README.md', heading: '## Chapters' },
  { path: 'adv/characters/README.md', heading: '## Characters' },
  { path: 'adv/scenes/README.md', heading: '## Scenes' },
  { path: 'adv/glossary.md', heading: '## Glossary' },
] as const

/**
 * Assemble project context by reading files via the provided `readFn`.
 * The I/O strategy (local FS, COS, etc.) is abstracted behind `readFn`.
 * Returns a single string with all sections joined by double newlines.
 */
export async function assembleProjectContext(
  readFn: (path: string) => Promise<string>,
): Promise<string> {
  const reads = await Promise.allSettled(
    CONTEXT_SECTIONS.map(s => readFn(s.path)),
  )
  const parts: string[] = []
  CONTEXT_SECTIONS.forEach((s, i) => {
    const r = reads[i]
    const content = r.status === 'fulfilled' ? r.value : ''
    if (content)
      parts.push(`${s.heading}\n${content}`)
  })
  return parts.join('\n\n')
}
