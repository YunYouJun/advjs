import type { AdvCharacter, AdvCharacterBody, AdvCharacterFrontmatter } from '@advjs/types'
import { LANGUAGE_LABELS } from '@advjs/types'
import yaml from 'js-yaml'
import { CharacterFrontmatterSchema, formatCharacterFrontmatterError } from './schemas/character'

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
  '知识领域': 'knowledgeDomain',
  'knowledge domain': 'knowledgeDomain',
  'knowledgedomain': 'knowledgeDomain',
  '专业提示': 'expertisePrompt',
  'expertise prompt': 'expertisePrompt',
  'expertiseprompt': 'expertisePrompt',
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
  { field: 'knowledgeDomain', heading: '知识领域' },
  { field: 'expertisePrompt', heading: '专业提示' },
]

const ATTRIBUTE_TEMPLATE_LABELS: Record<string, string> = {
  universal: '通用',
  galgame: '恋爱',
  rpg: 'RPG',
  mystery: '悬疑',
}

/**
 * Frontmatter 字段列表（用于从 AdvCharacter 中提取 frontmatter）
 */
const FRONTMATTER_KEYS: (keyof AdvCharacterFrontmatter)[] = [
  'id',
  'name',
  'avatar',
  'imagePrompt',
  'actor',
  'cv',
  'aliases',
  'tags',
  'faction',
  'language',
  'tachies',
  'relationships',
  'attributes',
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

  // Schema 软校验：失败时 warn 不抛错，保证向后兼容
  const schemaResult = CharacterFrontmatterSchema.safeParse(fm)
  if (!schemaResult.success) {
    console.warn(
      `[advjs/parser] Character frontmatter schema warnings for "${fm.id}":\n${formatCharacterFrontmatterError(schemaResult.error)}`,
    )
  }

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
    imagePrompt: fm.imagePrompt,
    actor: fm.actor,
    cv: fm.cv,
    aliases: normalizedAliases,
    tags: fm.tags,
    faction: fm.faction,
    language: fm.language,
    tachies: fm.tachies,
    relationships: fm.relationships,
    attributes: fm.attributes,
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
    if (value === undefined || value === null || value === '')
      continue

    // 对象/数组按照类型剔除空值
    if (Array.isArray(value)) {
      if (value.length === 0)
        continue
      fm[key] = value
      continue
    }

    if (typeof value === 'object') {
      // 对 attributes 做深度剔除，避免写入空子对象（如 `profile: {}`）
      const pruned = key === 'attributes'
        ? pruneEmpty(value as Record<string, any>)
        : value
      if (pruned === undefined)
        continue
      if (typeof pruned === 'object' && !Array.isArray(pruned) && Object.keys(pruned).length === 0)
        continue
      fm[key] = pruned
      continue
    }

    fm[key] = value
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
 * 递归剔除空对象/空数组/空字符串/undefined。
 * 返回 `undefined` 表示整个子树都是空。
 *
 * 保留：
 * - 数字 `0` / 布尔 `false`（这些是有效值，不应被当成空）
 */
function pruneEmpty(value: any): any {
  if (value === undefined || value === null || value === '')
    return undefined

  if (Array.isArray(value)) {
    return value.length === 0 ? undefined : value
  }

  if (typeof value === 'object') {
    const result: Record<string, any> = {}
    for (const [k, v] of Object.entries(value)) {
      const pruned = pruneEmpty(v)
      if (pruned !== undefined)
        result[k] = pruned
    }
    return Object.keys(result).length === 0 ? undefined : result
  }

  return value
}

function isPresentAttributeValue(value: unknown): boolean {
  if (value === undefined || value === null || value === '')
    return false
  if (Array.isArray(value))
    return value.length > 0
  return true
}

function formatAttributeValue(value: unknown): string {
  if (Array.isArray(value))
    return value.join(', ')
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value)
      .filter(([, v]) => isPresentAttributeValue(v))
      .map(([k, v]) => `${k}=${formatAttributeValue(v)}`)
      .join(', ')
  }
  return String(value)
}

function pushAttributeLine(
  lines: string[],
  excluded: Set<string>,
  path: string,
  label: string,
  value: unknown,
): void {
  if (excluded.has(path) || !isPresentAttributeValue(value))
    return
  lines.push(`- **${label}**: ${formatAttributeValue(value)}`)
}

function appendAttributesForAI(lines: string[], character: AdvCharacter): void {
  const attrs = character.attributes
  if (!attrs || attrs.ai?.promptInject === false)
    return

  const excluded = new Set(attrs.ai?.excludeFields ?? [])
  const attrLines: string[] = []

  if (attrs.template)
    pushAttributeLine(attrLines, excluded, 'template', '模板', ATTRIBUTE_TEMPLATE_LABELS[attrs.template] ?? attrs.template)
  if (attrs.ai?.visibility)
    pushAttributeLine(attrLines, excluded, 'ai.visibility', '可见性', attrs.ai.visibility)

  const profile = attrs.profile
  if (profile) {
    pushAttributeLine(attrLines, excluded, 'profile.age', '年龄', profile.age)
    pushAttributeLine(attrLines, excluded, 'profile.gender', '性别', profile.gender)
    pushAttributeLine(attrLines, excluded, 'profile.occupation', '职业 / 身份', profile.occupation)
    pushAttributeLine(attrLines, excluded, 'profile.personalityTags', '性格关键词', profile.personalityTags)
    pushAttributeLine(attrLines, excluded, 'profile.appearanceSummary', '外貌一句话', profile.appearanceSummary)
  }

  const galgame = attrs.galgame
  if (galgame) {
    pushAttributeLine(attrLines, excluded, 'galgame.birthday', '生日', galgame.birthday)
    pushAttributeLine(attrLines, excluded, 'galgame.bloodType', '血型', galgame.bloodType)
    pushAttributeLine(attrLines, excluded, 'galgame.zodiac', '星座', galgame.zodiac)
    pushAttributeLine(attrLines, excluded, 'galgame.height', '身高', galgame.height)
    pushAttributeLine(attrLines, excluded, 'galgame.likes', '喜好', galgame.likes)
    pushAttributeLine(attrLines, excluded, 'galgame.dislikes', '讨厌', galgame.dislikes)
    pushAttributeLine(attrLines, excluded, 'galgame.affinityInitial', '初始好感度', galgame.affinityInitial)
  }

  const rpg = attrs.rpg
  if (rpg) {
    pushAttributeLine(attrLines, excluded, 'rpg.race', '种族', rpg.race)
    pushAttributeLine(attrLines, excluded, 'rpg.class', '职业', rpg.class)
    pushAttributeLine(attrLines, excluded, 'rpg.level', '等级', rpg.level)
    pushAttributeLine(attrLines, excluded, 'rpg.stats', '六维属性', rpg.stats)
    pushAttributeLine(attrLines, excluded, 'rpg.hpInitial', 'HP 初始值', rpg.hpInitial)
    pushAttributeLine(attrLines, excluded, 'rpg.mpInitial', 'MP 初始值', rpg.mpInitial)
    pushAttributeLine(attrLines, excluded, 'rpg.skills', '技能', rpg.skills)
    pushAttributeLine(attrLines, excluded, 'rpg.equipment', '装备', rpg.equipment)
    pushAttributeLine(attrLines, excluded, 'rpg.alignment', '阵营', rpg.alignment)
  }

  const mystery = attrs.mystery
  if (mystery) {
    pushAttributeLine(attrLines, excluded, 'mystery.publicIdentity', '公开身份', mystery.publicIdentity)
    pushAttributeLine(attrLines, excluded, 'mystery.secret', '隐藏秘密', mystery.secret)
    pushAttributeLine(attrLines, excluded, 'mystery.motive', '动机', mystery.motive)
    pushAttributeLine(attrLines, excluded, 'mystery.alibi', '不在场证明', mystery.alibi)
    pushAttributeLine(attrLines, excluded, 'mystery.clues', '关联线索', mystery.clues)
    pushAttributeLine(attrLines, excluded, 'mystery.redHerrings', '误导信息', mystery.redHerrings)
    pushAttributeLine(attrLines, excluded, 'mystery.suspicionInitial', '初始嫌疑度', mystery.suspicionInitial)
  }

  if (attrs.custom) {
    for (const [key, field] of Object.entries(attrs.custom))
      pushAttributeLine(attrLines, excluded, `custom.${key}`, field.label, field.value)
  }

  if (attrLines.length) {
    lines.push('## 结构化属性')
    lines.push('')
    lines.push(...attrLines)
    lines.push('')
  }
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
  if (character.language)
    meta.push(`- **对话语言**: ${LANGUAGE_LABELS[character.language] ?? character.language}`)

  if (meta.length) {
    lines.push(...meta)
    lines.push('')
  }

  appendAttributesForAI(lines, character)

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
