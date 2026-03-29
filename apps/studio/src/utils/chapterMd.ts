import yaml from 'js-yaml'
import { parseFrontmatterAndBody } from './mdFrontmatter'

/**
 * Chapter form data for Studio editing
 */
export interface ChapterFormData {
  filename: string
  title: string
  plotSummary?: string
  content: string
}

/**
 * Parse chapter .adv.md content → ChapterFormData
 */
export function parseChapterMd(content: string, filename: string): ChapterFormData {
  const { frontmatter, body: _body } = parseFrontmatterAndBody(content)

  const fm = (frontmatter ? yaml.load(frontmatter) : {}) as Record<string, any>

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
    const yamlStr = yaml.dump(fm, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      quotingType: '\'',
      forceQuotes: false,
    }).trim()

    return `---\n${yamlStr}\n---\n`
  }

  return ''
}
