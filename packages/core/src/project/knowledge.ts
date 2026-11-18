const TITLE_RE = /^#[ \t]+(\S[^\r\n]*)/m
const MD_EXT_RE = /\.md$/
const KNOWLEDGE_PREFIX_RE = /^adv\/knowledge\//
const SAFE_TITLE_RE = /[^a-z0-9\u4E00-\u9FFF]+/g
const TRIM_UNDERSCORE_RE = /^_|_$/g

export interface KnowledgeSection {
  /** Title of the parent knowledge file */
  entryTitle: string
  /** ## heading text */
  heading: string
  /** Section content (without heading) */
  content: string
  /** Domain this section belongs to */
  domain: string
}

export interface KnowledgeEntry {
  /** Subdirectory name (e.g. 'law'), root = 'general' */
  domain: string
  /** File path */
  file: string
  /** Title extracted from # heading or filename */
  title: string
  /** Full raw content */
  content: string
  /** Parsed sections */
  sections: KnowledgeSection[]
}

/**
 * Split markdown content into sections by ## headings.
 * Returns an array of { heading, content } objects.
 */
function splitIntoSections(
  markdown: string,
  entryTitle: string,
  domain: string,
): KnowledgeSection[] {
  const lines = markdown.split('\n')
  const sections: KnowledgeSection[] = []
  let currentHeading = ''
  let currentLines: string[] = []

  for (const line of lines) {
    if (line.startsWith('## ')) {
      // Save previous section if it has content
      if (currentLines.length > 0) {
        const content = currentLines.join('\n').trim()
        if (content) {
          sections.push({
            entryTitle,
            heading: currentHeading,
            content,
            domain,
          })
        }
      }
      currentHeading = line.slice(3).trim()
      currentLines = []
    }
    else {
      // Skip the top-level # heading line
      if (line.startsWith('# ') && sections.length === 0 && currentLines.length === 0)
        continue
      currentLines.push(line)
    }
  }

  // Save last section
  if (currentLines.length > 0) {
    const content = currentLines.join('\n').trim()
    if (content) {
      sections.push({
        entryTitle,
        heading: currentHeading,
        content,
        domain,
      })
    }
  }

  return sections
}

/**
 * Extract title from markdown content (first # heading) or fallback to filename.
 */
function extractTitle(content: string, filename: string): string {
  const match = content.match(TITLE_RE)
  if (match)
    return match[1].trim()
  return filename.replace(MD_EXT_RE, '')
}

export function parseKnowledgeEntry(file: string, content: string, domain = knowledgeDomain(file)): KnowledgeEntry {
  const filename = file.split('/').pop() || file
  const title = extractTitle(content, filename)
  const sections = splitIntoSections(content, title, domain)

  return {
    domain,
    file,
    title,
    content,
    sections,
  }
}

/**
 * Determine domain from file path.
 * `adv/knowledge/law/criminal.md` → 'law'
 * `adv/knowledge/overview.md` → 'general'
 */
export function knowledgeDomain(filePath: string): string {
  // Remove the adv/knowledge/ prefix
  const knowledgePath = filePath.replace(KNOWLEDGE_PREFIX_RE, '')
  const parts = knowledgePath.split('/')
  // If there's a subdirectory, use it as domain
  if (parts.length > 1)
    return parts[0]
  return 'general'
}

export function newKnowledgeEntry(domain: string, title: string, content: string): KnowledgeEntry {
  if (!domain || domain === '.' || domain === '..' || domain.includes('/') || domain.includes('\\') || Array.from(domain).some(char => char.charCodeAt(0) < 32))
    throw new Error('Invalid knowledge domain')
  const safeTitle = title.toLowerCase().replace(SAFE_TITLE_RE, '_').replace(TRIM_UNDERSCORE_RE, '') || 'untitled'
  const dir = domain === 'general' ? 'adv/knowledge' : `adv/knowledge/${domain}`
  return parseKnowledgeEntry(`${dir}/${safeTitle}.md`, `# ${title}\n\n${content}`)
}

export function updateKnowledgeTitle(source: string, title: string): string {
  const current = source.match(TITLE_RE)
  if (current?.[1].trim() === title)
    return source
  return current ? source.replace(TITLE_RE, () => `# ${title}`) : `# ${title}\n\n${source}`
}
