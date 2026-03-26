import type { AdvCharacter, AdvCharacterBody, AdvCharacterFrontmatter } from '@advjs/types'
import yaml from 'js-yaml'

/**
 * Regex for matching ## heading lines (module-level for performance)
 */
const HEADING_RE = /^##\s(.+)$/

/**
 * Section heading 到 AdvCharacterBody 字段的映射
 * 支持中英文标题
 */
const SECTION_MAP: Record<string, keyof AdvCharacterBody> = {
  '外貌': 'appearance',
  'appearance': 'appearance',
  '性格': 'personality',
  'personality': 'personality',
  '背景': 'background',
  'background': 'background',
  '理念': 'concept',
  'concept': 'concept',
  '说话风格': 'speechStyle',
  'speech style': 'speechStyle',
  'speechstyle': 'speechStyle',
}

/**
 * Body 字段到 section 标题的映射（序列化用，使用中文标题）
 */
const BODY_SECTION_ORDER: { field: keyof AdvCharacterBody, heading: string }[] = [
  { field: 'appearance', heading: '外貌' },
  { field: 'personality', heading: '性格' },
  { field: 'background', heading: '背景' },
  { field: 'concept', heading: '理念' },
  { field: 'speechStyle', heading: '说话风格' },
]

/**
 * Frontmatter 字段列表（用于从 AdvCharacter 中提取 frontmatter）
 */
const FRONTMATTER_KEYS: (keyof AdvCharacterFrontmatter)[] = [
  'id',
  'name',
  'avatar',
  'actor',
  'cv',
  'aliases',
  'tags',
  'faction',
  'tachies',
  'relationships',
]

/**
 * 解析 .character.md 内容 → AdvCharacter
 */
export function parseCharacterMd(content: string): AdvCharacter {
  const { frontmatter, body } = parseFrontmatterAndBody(content)

  // 解析 YAML frontmatter
  const fm = (frontmatter ? yaml.load(frontmatter) : {}) as Record<string, any>

  // 校验必填字段
  if (!fm.id || typeof fm.id !== 'string')
    throw new Error('Character .character.md must have a string `id` in frontmatter')
  if (!fm.name || typeof fm.name !== 'string')
    throw new Error('Character .character.md must have a string `name` in frontmatter')

  // 解析 body sections
  const bodySections = parseBodySections(body)

  // 解析 aliases
  const aliases = fm.aliases
  const normalizedAliases = aliases
    ? (Array.isArray(aliases) ? aliases : [aliases])
    : undefined

  const character: AdvCharacter = {
    id: fm.id,
    name: fm.name,
    avatar: fm.avatar,
    actor: fm.actor,
    cv: fm.cv,
    aliases: normalizedAliases,
    tags: fm.tags,
    faction: fm.faction,
    tachies: fm.tachies,
    relationships: fm.relationships,
    ...bodySections,
  }

  // 清除 undefined 值
  return Object.fromEntries(
    Object.entries(character).filter(([_, v]) => v !== undefined),
  ) as AdvCharacter
}

/**
 * AdvCharacter → .character.md 字符串
 */
export function stringifyCharacterMd(character: AdvCharacter): string {
  // 提取 frontmatter 字段
  const fm: Record<string, any> = {}
  for (const key of FRONTMATTER_KEYS) {
    const value = character[key]
    if (value !== undefined && value !== null && value !== '') {
      // 跳过空数组和空对象
      if (Array.isArray(value) && value.length === 0)
        continue
      if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0)
        continue
      fm[key] = value
    }
  }

  const yamlStr = yaml.dump(fm, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    quotingType: '\'',
    forceQuotes: false,
  }).trim()

  // 构建 body sections
  const sections: string[] = []
  for (const { field, heading } of BODY_SECTION_ORDER) {
    const content = character[field]
    if (content && content.trim()) {
      sections.push(`## ${heading}\n\n${content.trim()}`)
    }
  }

  const bodyStr = sections.join('\n\n')

  if (bodyStr) {
    return `---\n${yamlStr}\n---\n\n${bodyStr}\n`
  }
  return `---\n${yamlStr}\n---\n`
}

/**
 * 导出为 AI 友好的纯净 markdown（去掉 tachies/avatar 等视觉字段）
 */
export function exportCharacterForAI(character: AdvCharacter): string {
  const lines: string[] = []

  lines.push(`# ${character.name}`)
  lines.push('')

  // 元信息
  const meta: string[] = []
  if (character.aliases?.length)
    meta.push(`- **别名**: ${character.aliases.join(', ')}`)
  if (character.faction)
    meta.push(`- **阵营**: ${character.faction}`)
  if (character.tags?.length)
    meta.push(`- **标签**: ${character.tags.join(', ')}`)
  if (character.cv)
    meta.push(`- **声优**: ${character.cv}`)
  if (character.actor)
    meta.push(`- **演员**: ${character.actor}`)

  if (meta.length) {
    lines.push(...meta)
    lines.push('')
  }

  // Body sections
  for (const { field, heading } of BODY_SECTION_ORDER) {
    const content = character[field]
    if (content?.trim()) {
      lines.push(`## ${heading}`)
      lines.push('')
      lines.push(content.trim())
      lines.push('')
    }
  }

  // Relationships
  if (character.relationships?.length) {
    lines.push('## 关系')
    lines.push('')
    for (const rel of character.relationships) {
      const desc = rel.description ? `: ${rel.description}` : ''
      lines.push(`- **${rel.targetId}** (${rel.type})${desc}`)
    }
    lines.push('')
  }

  return `${lines.join('\n').trim()}\n`
}

/**
 * 从 .character.md 内容中分离 frontmatter 和 body
 */
function parseFrontmatterAndBody(content: string): { frontmatter: string, body: string } {
  const trimmed = content.trim()
  if (!trimmed.startsWith('---')) {
    return { frontmatter: '', body: trimmed }
  }

  const endIndex = trimmed.indexOf('---', 3)
  if (endIndex === -1) {
    return { frontmatter: '', body: trimmed }
  }

  const frontmatter = trimmed.slice(3, endIndex).trim()
  const body = trimmed.slice(endIndex + 3).trim()
  return { frontmatter, body }
}

/**
 * 解析 body 中的 ## heading sections → AdvCharacterBody
 */
function parseBodySections(body: string): AdvCharacterBody {
  if (!body)
    return {}

  const result: AdvCharacterBody = {}
  const lines = body.split('\n')
  let currentField: keyof AdvCharacterBody | null = null
  let currentContent: string[] = []

  function flushSection() {
    if (currentField && currentContent.length > 0) {
      result[currentField] = currentContent.join('\n').trim()
    }
    currentContent = []
  }

  for (const line of lines) {
    const headingMatch = line.match(HEADING_RE)
    if (headingMatch) {
      flushSection()
      const heading = headingMatch[1].trim().toLowerCase()
      currentField = SECTION_MAP[heading] || null
    }
    else if (currentField) {
      currentContent.push(line)
    }
  }

  // flush last section
  flushSection()

  return result
}
