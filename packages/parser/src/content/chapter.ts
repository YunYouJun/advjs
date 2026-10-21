import {
  dumpYamlFrontmatter,
  loadFrontmatterObject,
  mergeManagedFrontmatter,
  parseFrontmatterAndBody,
  readFrontmatterSource,
  writeFrontmatterSource,
} from './frontmatter'

/**
 * Editable chapter data (`*.adv.md`). `content` is the whole file, including
 * its frontmatter.
 */
export interface ChapterFormData {
  filename: string
  title: string
  plotSummary?: string
  content: string
}

const CHAPTER_METADATA_KEYS = ['title', 'plotSummary'] as const

/**
 * Parse chapter .adv.md content → ChapterFormData
 */
export function parseChapterMd(content: string, filename: string): ChapterFormData {
  const { frontmatter } = parseFrontmatterAndBody(content)
  const fm = loadFrontmatterObject(frontmatter)

  return {
    filename,
    title: fm.title || filename.replace('.adv.md', ''),
    plotSummary: fm.plotSummary || fm.description || '',
    content,
  }
}

/**
 * ChapterFormData → .adv.md string
 *
 * If the content already has frontmatter, update it; otherwise write as-is
 */
export function stringifyChapterMd(chapter: ChapterFormData): string {
  // If there's existing content with custom formatting, just return it
  if (chapter.content && chapter.content.trim()) {
    return chapter.content
  }

  // Generate minimal template
  const fm: Record<string, any> = {}
  if (chapter.title)
    fm.title = chapter.title
  if (chapter.plotSummary)
    fm.plotSummary = chapter.plotSummary

  if (Object.keys(fm).length > 0) {
    const yamlStr = dumpYamlFrontmatter(fm)

    return `---\n${yamlStr}\n---\n`
  }

  return ''
}

/**
 * Write `title` and `plotSummary` into the chapter's own frontmatter when they
 * differ from what its `content` declares. Everything else in `content`,
 * including unknown frontmatter keys and the script body, is kept.
 */
export function updateChapterMd(chapter: ChapterFormData): string {
  if (!chapter.content.trim())
    return stringifyChapterMd(chapter)

  const baseline = parseChapterMd(chapter.content, chapter.filename)
  const document = readFrontmatterSource(chapter.content)
  const { data, changed } = mergeManagedFrontmatter(
    document?.data ?? {},
    baseline,
    chapter,
    CHAPTER_METADATA_KEYS,
  )
  if (!changed)
    return chapter.content
  if (document)
    return writeFrontmatterSource(data, document.bodyRaw)
  return Object.keys(data).length > 0
    ? `---\n${dumpYamlFrontmatter(data)}\n---\n\n${chapter.content.replace(/^\n+/u, '')}`
    : chapter.content
}
