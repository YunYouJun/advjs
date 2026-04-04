import type { ComputedRef, Ref } from 'vue'
import { computed, ref } from 'vue'
import { downloadFromCloud, listCloudFiles } from '../utils/cloudSync'
import { readFileFromDir, resolveSubdir } from '../utils/fileAccess'

const TITLE_RE = /^#[ \t]+(\S[\S \t]*)$/m
const MD_EXT_RE = /\.md$/
const ENGLISH_WORD_RE = /[a-z]{2,}/gi
const NON_CJK_RE = /[a-z0-9\s.,!?;:'"()\-[\]{}]/gi
const KNOWLEDGE_PREFIX_RE = /^adv\/knowledge\//

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

/**
 * Extract keywords from a user message for search matching.
 * - Chinese: 2-3 character n-grams
 * - English/other: space-delimited words (lowercased, min 2 chars)
 * - Filters out common stop words
 */
function extractKeywords(message: string): string[] {
  const keywords: string[] = []

  const stopWords = new Set([
    // Chinese
    '的',
    '了',
    '是',
    '在',
    '我',
    '有',
    '和',
    '就',
    '不',
    '人',
    '都',
    '一',
    '一个',
    '上',
    '也',
    '很',
    '到',
    '说',
    '要',
    '去',
    '你',
    '会',
    '着',
    '没有',
    '看',
    '好',
    '自己',
    '这',
    '他',
    '她',
    '它',
    '们',
    '那',
    '吗',
    '什么',
    '怎么',
    '为什么',
    '可以',
    '能',
    '吧',
    '呢',
    '啊',
    '哦',
    '嗯',
    '请',
    '问',
    '关于',
    '告诉',
    // English
    'the',
    'a',
    'an',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'can',
    'shall',
    'to',
    'of',
    'in',
    'for',
    'on',
    'with',
    'at',
    'by',
    'from',
    'as',
    'into',
    'about',
    'like',
    'through',
    'after',
    'over',
    'between',
    'out',
    'up',
    'down',
    'and',
    'but',
    'or',
    'not',
    'no',
    'so',
    'if',
    'then',
    'than',
    'too',
    'very',
    'just',
    'that',
    'this',
    'it',
    'its',
    'my',
    'me',
    'we',
    'they',
    'them',
    'he',
    'she',
    'him',
    'her',
    'you',
    'your',
    'what',
    'which',
    'who',
    'how',
    'when',
    'where',
    'why',
    'tell',
    'please',
    'know',
    'think',
    'want',
    'need',
  ])

  // Extract English words
  const englishWords = message.match(ENGLISH_WORD_RE) || []
  for (const word of englishWords) {
    const lower = word.toLowerCase()
    if (!stopWords.has(lower))
      keywords.push(lower)
  }

  // Extract Chinese segments: use 2-3 char n-grams from Chinese text portions
  const chineseText = message.replace(NON_CJK_RE, '')
  // First filter out stop words (single char)
  const filtered = chineseText.split('').filter(c => !stopWords.has(c)).join('')

  // Generate 2-gram and 3-gram
  for (let i = 0; i < filtered.length - 1; i++) {
    keywords.push(filtered.slice(i, i + 2))
    if (i < filtered.length - 2)
      keywords.push(filtered.slice(i, i + 3))
  }

  // Deduplicate
  return [...new Set(keywords)]
}

/**
 * Score a section against keywords.
 * heading match = +3 per keyword, content match = +1 per keyword.
 */
function scoreSection(section: KnowledgeSection, keywords: string[]): number {
  let score = 0
  const headingLower = section.heading.toLowerCase()
  const contentLower = section.content.toLowerCase()

  for (const kw of keywords) {
    if (headingLower.includes(kw))
      score += 3
    if (contentLower.includes(kw))
      score += 1
  }

  return score
}

/**
 * Recursively list all .md files under a directory handle subdirectory.
 * Returns paths relative to the root dirHandle.
 */
async function listMdFilesRecursive(
  dir: FileSystemDirectoryHandle,
  prefix: string,
): Promise<string[]> {
  const files: string[] = []

  try {
    let targetDir: FileSystemDirectoryHandle = dir
    if (prefix) {
      targetDir = await resolveSubdir(dir, prefix.split('/').filter(Boolean))
    }

    for await (const entry of targetDir.values()) {
      const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.kind === 'file' && entry.name.endsWith('.md')) {
        files.push(entryPath)
      }
      else if (entry.kind === 'directory') {
        const subFiles = await listMdFilesRecursive(dir, entryPath)
        files.push(...subFiles)
      }
    }
  }
  catch {
    // directory not found or access error
  }

  return files.sort()
}

// --- Module-level singleton state ---
const entries: Ref<KnowledgeEntry[]> = ref([])
const isLoading: Ref<boolean> = ref(false)

const domains: ComputedRef<string[]> = computed(() => {
  const domainSet = new Set(entries.value.map(e => e.domain))
  return [...domainSet].sort()
})

/**
 * Composable for loading, indexing, and querying knowledge files.
 *
 * Knowledge files are .md files stored in `adv/knowledge/` or `adv/knowledge/{domain}/`.
 * They are split by `##` headings into sections for fine-grained retrieval.
 *
 * This is a shared singleton — all callers share the same reactive state.
 */
export function useKnowledgeBase() {
  /**
   * Parse a single knowledge file into a KnowledgeEntry.
   */
  function parseEntry(file: string, content: string, domain: string): KnowledgeEntry {
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
  function extractDomain(filePath: string): string {
    // Remove the adv/knowledge/ prefix
    const knowledgePath = filePath.replace(KNOWLEDGE_PREFIX_RE, '')
    const parts = knowledgePath.split('/')
    // If there's a subdirectory, use it as domain
    if (parts.length > 1)
      return parts[0]
    return 'general'
  }

  /**
   * Load knowledge files from a local directory handle.
   * Scans `adv/knowledge/` recursively for .md files.
   */
  async function loadFromDir(dirHandle: FileSystemDirectoryHandle): Promise<void> {
    isLoading.value = true
    try {
      const knowledgeFiles = await listMdFilesRecursive(dirHandle, 'adv/knowledge')
      const newEntries: KnowledgeEntry[] = []

      for (const file of knowledgeFiles) {
        try {
          const content = await readFileFromDir(dirHandle, file)
          const domain = extractDomain(file)
          newEntries.push(parseEntry(file, content, domain))
        }
        catch {
          // skip unreadable files
        }
      }

      entries.value = newEntries
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Load knowledge files from COS cloud storage.
   */
  async function loadFromCos(
    cosConfig: { bucket: string, region: string, secretId: string, secretKey: string },
    prefix: string,
  ): Promise<void> {
    isLoading.value = true
    try {
      const allFiles = await listCloudFiles(cosConfig, prefix)
      const knowledgeFiles = allFiles.filter(
        f => f.includes('/knowledge/') && f.endsWith('.md'),
      )

      const newEntries: KnowledgeEntry[] = []

      for (const file of knowledgeFiles) {
        try {
          const content = await downloadFromCloud(cosConfig, file)
          // Normalize path relative to project prefix
          const relativePath = file.startsWith(prefix) ? file.slice(prefix.length) : file
          const domain = extractDomain(relativePath)
          newEntries.push(parseEntry(file, content, domain))
        }
        catch {
          // skip unreadable files
        }
      }

      entries.value = newEntries
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Get all knowledge entries for a specific domain.
   */
  function getEntriesForDomain(domain: string): KnowledgeEntry[] {
    if (!domain)
      return entries.value
    return entries.value.filter(
      e => e.domain === domain || e.domain === 'general',
    )
  }

  /**
   * Get a brief summary of available knowledge for a domain.
   */
  function getDomainSummary(domain: string): string {
    const domainEntries = getEntriesForDomain(domain)
    if (domainEntries.length === 0)
      return ''

    const totalSections = domainEntries.reduce((sum, e) => sum + e.sections.length, 0)
    const titles = domainEntries.map(e => e.title).join(', ')
    return `${domainEntries.length} files, ${totalSections} sections: ${titles}`
  }

  /**
   * Core retrieval: select relevant knowledge sections based on user message.
   *
   * V1 implementation uses keyword matching:
   * 1. Extract keywords from userMessage (Chinese n-grams + English words)
   * 2. Score all sections in the domain: heading match = +3, content match = +1
   * 3. Sort by score descending, accumulate until maxChars is reached
   * 4. Return concatenated markdown
   *
   * Future V2: can be replaced with embedding similarity (same interface).
   */
  function selectRelevantKnowledge(
    userMessage: string,
    domain: string,
    maxChars: number = 3000,
  ): string {
    const domainEntries = getEntriesForDomain(domain)
    if (domainEntries.length === 0)
      return ''

    const keywords = extractKeywords(userMessage)
    if (keywords.length === 0)
      return ''

    // Score all sections
    const allSections = domainEntries.flatMap(e => e.sections)
    const scored = allSections
      .map(section => ({
        section,
        score: scoreSection(section, keywords),
      }))
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)

    if (scored.length === 0)
      return ''

    // Accumulate sections up to maxChars
    const selectedParts: string[] = []
    let totalChars = 0

    for (const { section } of scored) {
      const part = section.heading
        ? `## ${section.heading}\n\n${section.content}`
        : section.content
      const partLength = part.length

      if (totalChars + partLength > maxChars && selectedParts.length > 0)
        break

      selectedParts.push(part)
      totalChars += partLength
    }

    return selectedParts.join('\n\n')
  }

  function $reset() {
    entries.value = []
    isLoading.value = false
  }

  return {
    entries,
    domains,
    isLoading,
    loadFromDir,
    loadFromCos,
    getEntriesForDomain,
    getDomainSummary,
    selectRelevantKnowledge,
    $reset,
  }
}
