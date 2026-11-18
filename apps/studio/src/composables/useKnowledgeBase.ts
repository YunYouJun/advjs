import type { KnowledgeEntry, KnowledgeSection } from '@advjs/core/project'
import type { ComputedRef, Ref } from 'vue'
import type { IFileSystem } from '../utils/fs'
import { knowledgeDomain, newKnowledgeEntry, parseKnowledgeEntry } from '@advjs/core/project'
import { computed, ref } from 'vue'
import { downloadFromCloud, listCloudFiles } from '../utils/cloudSync'

export type { KnowledgeEntry, KnowledgeSection } from '@advjs/core/project'

const ENGLISH_WORD_RE = /[a-z]{2,}/gi
const NON_CJK_RE = /[a-z0-9\s.,!?;:'"()\-[\]{}]/gi

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
    // Japanese
    'の',
    'に',
    'は',
    'を',
    'た',
    'が',
    'で',
    'て',
    'と',
    'し',
    'れ',
    'さ',
    'ある',
    'いる',
    'する',
    'から',
    'まで',
    'より',
    'また',
    'この',
    'その',
    'あの',
    'どの',
    'これ',
    'それ',
    'あれ',
    'です',
    'ます',
    'った',
    'って',
    'ない',
    'なく',
    'もの',
    'こと',
    'ため',
    'よう',
    'など',
    'だけ',
    'でも',
    'ても',
    'けど',
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
 * Recursively list all .md files under a directory via IFileSystem.
 */
async function listMdFilesRecursiveFs(
  fs: IFileSystem,
  prefix: string,
): Promise<string[]> {
  const files: string[] = []
  try {
    const entries = await fs.readdir(prefix)
    for (const entry of entries) {
      if (entry.type === 'file' && entry.name.endsWith('.md')) {
        files.push(entry.path)
      }
      else if (entry.type === 'directory') {
        const subFiles = await listMdFilesRecursiveFs(fs, entry.path)
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
let watchInterval: ReturnType<typeof setInterval> | null = null
let lastFileSnapshot: Map<string, number> = new Map() // filename → lastModified

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
          const domain = knowledgeDomain(relativePath)
          newEntries.push(parseKnowledgeEntry(file, content, domain))
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
   * Load knowledge files via IFileSystem interface.
   */
  async function loadFromFs(fs: IFileSystem, isCurrent: () => boolean = () => true): Promise<void> {
    isLoading.value = true
    try {
      const knowledgeFiles = await listMdFilesRecursiveFs(fs, 'adv/knowledge')
      const newEntries: KnowledgeEntry[] = []
      const snapshot = new Map<string, number>()

      for (const file of knowledgeFiles) {
        try {
          const content = await fs.readFile(file)
          const domain = knowledgeDomain(file)
          newEntries.push(parseKnowledgeEntry(file, content, domain))
          snapshot.set(file, content.length)
        }
        catch {
          // skip unreadable files
        }
      }

      if (isCurrent()) {
        entries.value = newEntries
        lastFileSnapshot = snapshot
      }
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Save a knowledge entry via IFileSystem.
   */
  async function saveEntryFs(fs: IFileSystem, entry: KnowledgeEntry): Promise<void> {
    await fs.writeFile(entry.file, entry.content)
    const idx = entries.value.findIndex(e => e.file === entry.file)
    if (idx >= 0) {
      entries.value[idx] = entry
    }
    else {
      entries.value = [...entries.value, entry]
    }
  }

  /**
   * Create a new knowledge entry via IFileSystem.
   */
  async function createEntryFs(
    fs: IFileSystem,
    domain: string,
    title: string,
    content: string,
  ): Promise<KnowledgeEntry> {
    const entry = newKnowledgeEntry(domain, title, content)
    await fs.writeFile(entry.file, entry.content)
    entries.value = [...entries.value, entry]
    return entry
  }

  /**
   * Delete a knowledge entry via IFileSystem.
   */
  async function deleteEntryFs(fs: IFileSystem, filePath: string): Promise<void> {
    await fs.deleteFile(filePath)
    entries.value = entries.value.filter(e => e.file !== filePath)
  }

  /**
   * Start watching for file changes via IFileSystem.
   */
  function watchForChangesFs(fs: IFileSystem): void {
    stopWatching()
    watchInterval = setInterval(async () => {
      if (isLoading.value)
        return
      try {
        const knowledgeFiles = await listMdFilesRecursiveFs(fs, 'adv/knowledge')
        if (knowledgeFiles.length !== lastFileSnapshot.size) {
          await loadFromFs(fs)
          return
        }
        for (const file of knowledgeFiles) {
          try {
            const content = await fs.readFile(file)
            const prevLen = lastFileSnapshot.get(file)
            if (prevLen === undefined || prevLen !== content.length) {
              await loadFromFs(fs)
              return
            }
          }
          catch {
            await loadFromFs(fs)
            return
          }
        }
      }
      catch {
        stopWatching()
      }
    }, 30_000)
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

  /**
   * V2 embedding-based retrieval. Opt-in feature — only called when embedding is enabled.
   *
   * 1. Generate query embedding
   * 2. Check IndexedDB cache for section embeddings (refresh stale)
   * 3. Rank by cosine similarity → top-K → accumulate to maxChars
   *
   * Falls back to V1 keyword matching on any error.
   */
  async function selectRelevantKnowledgeV2(
    userMessage: string,
    domain: string,
    _embeddingConfig: unknown,
    _projectId: string = '_default_',
    maxChars: number = 3000,
  ): Promise<string> {
    // Managed embeddings are not registered yet. Production fails closed to
    // deterministic local keyword retrieval instead of calling a provider.
    return selectRelevantKnowledge(userMessage, domain, maxChars)
  }

  /**
   * Stop watching for file changes.
   */
  function stopWatching(): void {
    if (watchInterval) {
      clearInterval(watchInterval)
      watchInterval = null
    }
  }

  function $reset() {
    stopWatching()
    entries.value = []
    isLoading.value = false
    lastFileSnapshot = new Map()
  }

  return {
    entries,
    domains,
    isLoading,
    loadFromFs,
    loadFromCos,
    getEntriesForDomain,
    getDomainSummary,
    selectRelevantKnowledge,
    selectRelevantKnowledgeV2,
    saveEntryFs,
    createEntryFs,
    deleteEntryFs,
    watchForChangesFs,
    stopWatching,
    $reset,
  }
}
