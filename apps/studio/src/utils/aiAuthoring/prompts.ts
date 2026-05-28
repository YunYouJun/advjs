/**
 * Prompt builders for Phase 16 AI-assisted authoring.
 *
 * Two builders:
 *   - buildOutlinePrompt        → outline.md (Markdown)
 *   - buildChapterDraftPrompt   → chapter body (AdvScript, no frontmatter)
 *
 * AdvScript syntax description below is intentionally a self-contained copy
 * of the syntax block from `projectGenerator/prompts.ts`, so this module
 * stays free of `TemplateDef` and template-pipeline coupling.
 */

import type { AdvCharacter } from '@advjs/types'

const ADV_SCRIPT_SYNTAX = [
  `# AdvScript 语法（必须遵守）`,
  `- 场景头： 【地点，时间，内/外景】 使用全角方括号和全角逗号；放在每个场景首行`,
  `- 旁白： （旁白文字） 使用全角括号`,
  `- 角色对白： @id 另起一行，随后一行为「对白文字」`,
  `- 内心独白： > 文字（行首大于号）`,
  `- 选项：使用 Markdown 无序列表 "- 选项文字"，章节末给出`,
].join('\n')

function describeCharacter(c: AdvCharacter): string {
  const parts = [`@${c.id}（${c.name}）`]
  if (c.personality)
    parts.push(`性格：${c.personality}`)
  if (c.appearance)
    parts.push(`外貌：${c.appearance}`)
  return `  - ${parts.join(' / ')}`
}

export interface BuildOutlinePromptInput {
  worldMd: string
  characters: AdvCharacter[]
  hint?: string
}

export function buildOutlinePrompt(input: BuildOutlinePromptInput): string {
  const charList = input.characters.length > 0
    ? input.characters.map(describeCharacter).join('\n')
    : '  （暂无角色卡，请基于世界设定自由想象主要人物）'

  return [
    `你是 ADV.JS 互动小说编剧。请基于下方「世界设定」与「角色卡」产出一份多章节故事大纲（outline.md）。`,
    ``,
    `# 世界设定`,
    input.worldMd.trim() || '（世界设定为空，请基于角色信息合理假设）',
    ``,
    `# 角色卡`,
    charList,
    ``,
    input.hint?.trim() ? `# 作者引导\n${input.hint.trim()}\n` : '',
    `# 输出格式要求`,
    `- 直接输出 Markdown，不要包裹 \`\`\` 代码块；`,
    `- 第一行用 \`# 故事大纲\` 作为标题；`,
    `- \`## 总览\` 一段：交代核心冲突与基调（2-4 句）；`,
    `- 每一章用 \`## 第 N 章 · 章节名\` 作为标题；推荐 3-6 章；`,
    `- 每章下面用 \`### 冲突\` / \`### 转折\` / \`### 目标\` 三个三级标题展开，每段 1-3 句即可；`,
    `- 全程使用中文；除大纲正文外不要解释说明。`,
  ].filter(Boolean).join('\n')
}

export interface BuildChapterDraftPromptInput {
  worldMd: string
  outlineMd: string
  chapterTitle: string
  chapterPlotSummary?: string
  characters: AdvCharacter[]
  hint?: string
}

export function buildChapterDraftPrompt(input: BuildChapterDraftPromptInput): string {
  const charList = input.characters.length > 0
    ? input.characters.map(describeCharacter).join('\n')
    : '  （未选角色，请保守使用旁白叙述）'

  return [
    `你是 ADV.JS 互动小说编剧。请为「${input.chapterTitle}」一章草拟完整正文（AdvScript）。`,
    ``,
    `# 世界设定`,
    input.worldMd.trim() || '（未提供）',
    ``,
    `# 故事大纲（供上下文）`,
    input.outlineMd.trim() || '（未提供）',
    ``,
    `# 本章信息`,
    `- 标题：${input.chapterTitle}`,
    input.chapterPlotSummary?.trim() ? `- 梗概：${input.chapterPlotSummary.trim()}` : '',
    ``,
    `# 出场角色（必须用 @id 引用）`,
    charList,
    ``,
    input.hint?.trim() ? `# 作者引导\n${input.hint.trim()}\n` : '',
    ADV_SCRIPT_SYNTAX,
    ``,
    `# 输出要求`,
    `- 直接输出 AdvScript 正文，**不要 YAML frontmatter**（系统会自动保留章节元信息）；`,
    `- 至少 1 个场景头、3-8 轮角色对白、1-2 段旁白；`,
    `- 章节末给出 2-3 个选项；`,
    `- 不要解释，不要 \`\`\` 代码块包裹。`,
  ].filter(Boolean).join('\n')
}
