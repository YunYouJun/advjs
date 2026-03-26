import type { AdvCharacter } from '@advjs/types'

/**
 * 飞书多维表格字段 → AdvCharacter 映射
 */
export function fieldsToCharacter(record: any): AdvCharacter {
  const fields = record.fields || {}

  // 飞书文本字段可能是 [{type: 'text', text: 'value'}] 格式
  const getText = (val: any): string => {
    if (!val)
      return ''
    if (typeof val === 'string')
      return val
    if (Array.isArray(val))
      return val.map((v: any) => v.text || '').join('')
    return String(val)
  }

  return {
    id: getText(fields.id),
    name: getText(fields.name),
    avatar: getText(fields.avatar) || undefined,
    personality: getText(fields.personality) || undefined,
    appearance: getText(fields.appearance) || undefined,
    background: getText(fields.background) || undefined,
    concept: getText(fields.concept) || undefined,
    speechStyle: getText(fields.speechStyle) || undefined,
    faction: getText(fields.faction) || undefined,
    tags: getText(fields.tags) ? getText(fields.tags).split(',').map(t => t.trim()) : undefined,
    aliases: getText(fields.aliases) ? getText(fields.aliases).split(',').map(a => a.trim()) : undefined,
    cv: getText(fields.cv) || undefined,
    actor: getText(fields.actor) || undefined,
    feishuRecordId: record.record_id,
  }
}

/**
 * AdvCharacter → 飞书多维表格字段映射
 */
export function characterToFields(character: Partial<AdvCharacter>): Record<string, any> {
  const fields: Record<string, any> = {}

  if (character.id !== undefined)
    fields.id = character.id
  if (character.name !== undefined)
    fields.name = character.name
  if (character.avatar !== undefined)
    fields.avatar = character.avatar
  if (character.personality !== undefined)
    fields.personality = character.personality
  if (character.appearance !== undefined)
    fields.appearance = character.appearance
  if (character.background !== undefined)
    fields.background = character.background
  if (character.concept !== undefined)
    fields.concept = character.concept
  if (character.speechStyle !== undefined)
    fields.speechStyle = character.speechStyle
  if (character.faction !== undefined)
    fields.faction = character.faction
  if (character.tags !== undefined)
    fields.tags = character.tags.join(', ')
  if (character.aliases !== undefined)
    fields.aliases = character.aliases.join(', ')
  if (character.cv !== undefined)
    fields.cv = character.cv
  if (character.actor !== undefined)
    fields.actor = character.actor

  return fields
}
