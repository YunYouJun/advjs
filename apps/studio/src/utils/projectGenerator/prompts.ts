/**
 * Per-step prompt builders for Phase M10 Source-to-Project pipeline.
 *
 * Cache-prefix-friendly layout (see `docs/studio/ai-contest-2026.md` §3.2):
 *   ┌─ system   ── template.systemPrompt + JSON-only reminder    (run-static)
 *   ├─ user     ── template JSON + source metadata + segments    (run-static)
 *   └─ user     ── step-specific instruction + prior-step outputs (step-variant)
 *
 * The first two messages are byte-identical across all four LLM calls within
 * a single `generateProject()` invocation, so OpenAI-compatible providers
 * with prefix-cache support (Anthropic, DeepSeek, Qwen, …) hit cache for
 * calls 2–4.
 *
 * Content-facing prompt authors (non-engineers) can iterate the strings in
 * this file without touching generator logic.
 */

import type { NormalizedSource } from '../sourceParser'
import type { TemplateDef } from '../templates/loadTemplate'
import type { GeneratedChapter, GeneratedCharacter } from './schemas'

const JSON_ONLY_REMINDER = `
You MUST respond with a single valid JSON object and NOTHING else — no
markdown fences, no commentary, no "here's your json". If the source is
insufficient, still produce the JSON with your best inferences; never
respond with prose.`.trim()

// ---------------------------------------------------------------------------
// Shared (cache-stable) prefix
// ---------------------------------------------------------------------------

export function buildSystemPrompt(template: TemplateDef): string {
  return `${template.systemPrompt.trim()}\n\n${JSON_ONLY_REMINDER}`
}

export function buildSharedUserContext(
  template: TemplateDef,
  source: NormalizedSource,
): string {
  const archetypes = template.characterArchetypes
    .map(a => `  - ${a.role}（${a.tone}，voice hint: ${a.voiceHint}）`)
    .join('\n')
  const chapters = template.chapterStructure
    .map(c => `  - ${c.phase}（choices: ${c.choices}, budget: ${c.targetTokens} tokens）`)
    .join('\n')
  const segments = source.segments
    .map(s => `### 段落 ${s.index + 1} — ${s.heading}\n${s.body}`)
    .join('\n\n---\n\n')

  return [
    `# 模板规格`,
    `- id: ${template.id}`,
    `- name: ${template.name}`,
    `- sceneStyle: ${template.sceneStyle}`,
    `- 章节结构：\n${chapters}`,
    `- 角色原型：\n${archetypes}`,
    ``,
    `# 素材元信息`,
    `- title: ${source.title}`,
    `- type: ${source.type}`,
    `- segments: ${source.segments.length}`,
    source.suggestedTemplateId ? `- suggestedTemplate: ${source.suggestedTemplateId}` : '',
    ``,
    `# 素材正文`,
    segments,
  ].filter(Boolean).join('\n')
}

// ---------------------------------------------------------------------------
// Step 1 · characters
// ---------------------------------------------------------------------------

export function buildCharactersInstruction(template: TemplateDef): string {
  const needed = template.characterArchetypes.length
  return [
    `# 当前步骤：角色提取（Step 1 / 4）`,
    `基于素材，提炼出 ${needed}–${needed + 2} 个关键角色。每个角色对应上文"角色原型"之一。`,
    ``,
    `输出 JSON Schema:`,
    `{`,
    `  "characters": [`,
    `    {`,
    `      "id": "english-slug-lowercase-hyphenated",`,
    `      "name": "中文或原文名",`,
    `      "tags": ["可选标签"],`,
    `      "voiceHint": "与模板角色原型匹配的 voiceHint",`,
    `      "appearance": "外貌描述（可留空）",`,
    `      "personality": "性格描述",`,
    `      "background": "人物背景",`,
    `      "concept": "理念/信念（可留空）",`,
    `      "speechStyle": "说话风格（可留空）"`,
    `    }`,
    `  ]`,
    `}`,
    ``,
    `要求：`,
    `- id 必须是英文小写短横线连字符，跨角色唯一；`,
    `- name 保留原文；`,
    `- personality、background 必填；其余字段可省略；`,
    `- 除 JSON 外不得有任何其他内容。`,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Step 2 · chapters
// ---------------------------------------------------------------------------

export function buildChapterInstruction(
  template: TemplateDef,
  chapterIndex: number,
  characters: GeneratedCharacter[],
): string {
  const phase = template.chapterStructure[chapterIndex]
  const charList = characters
    .map(c => `  - @${c.id}（${c.name}）`)
    .join('\n')

  return [
    `# 当前步骤：章节生成（Step 2 / 4） — 第 ${chapterIndex + 1} 章 / 共 ${template.chapterStructure.length} 章`,
    ``,
    `本章规格：`,
    `- phase: ${phase.phase}`,
    `- choices: ${phase.choices}`,
    `- budget: ~${phase.targetTokens} tokens`,
    `- sceneStyle: ${template.sceneStyle}`,
    ``,
    `已生成的角色（正文对白用 @id 引用）：`,
    charList,
    ``,
    `# AdvScript 语法（必须遵守）`,
    `- 场景头： 【地点，时间，内/外景】 使用全角方括号和全角逗号；放在每个场景首行`,
    `- 旁白： （旁白文字） 使用全角括号`,
    `- 角色对白： @id 另起一行，随后一行为「对白文字」`,
    `- 内心独白： > 文字（行首大于号）`,
    `- 选项：使用 Markdown 无序列表 "- 选项文字"，章节末给出；${phase.choices} 个选项`,
    ``,
    `输出 JSON Schema:`,
    `{`,
    `  "chapter": {`,
    `    "filename": "chapter-NN-${phase.phase}.adv.md",`,
    `    "title": "本章标题",`,
    `    "phase": "${phase.phase}",`,
    `    "plotSummary": "一句话剧情梗概",`,
    `    "body": "完整 AdvScript 正文（含场景头、对白、旁白、选项）",`,
    `    "choices": [{ "label": "选项文字", "hint": "可选的后果提示" }],`,
    `    "sceneRefs": ["scene-id-1", "scene-id-2"]`,
    `  }`,
    `}`,
    ``,
    `注意：`,
    `- body 字段必须是可直接保存为 .adv.md 的完整 AdvScript 正文；`,
    `- sceneRefs 列出本章出现的场景 id（供 Step 3 展开为 scenes 文件）；`,
    `- 若 choices=${phase.choices}=0，chapter.choices 省略或为空数组；`,
    `- 除 JSON 外不得有任何其他内容。`,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Step 3 · scenes (+ locations by-product)
// ---------------------------------------------------------------------------

export function buildScenesInstruction(
  template: TemplateDef,
  chapters: GeneratedChapter[],
): string {
  const refs = Array.from(new Set(chapters.flatMap(c => c.sceneRefs ?? [])))
  const refList = refs.length > 0
    ? refs.map(r => `  - ${r}`).join('\n')
    : '  （章节未声明 sceneRefs，请根据章节 body 中的【…】场景头自动提取）'

  return [
    `# 当前步骤：场景与地点生成（Step 3 / 4）`,
    ``,
    `已生成的章节里出现的场景引用：`,
    refList,
    ``,
    `模板 sceneStyle：${template.sceneStyle}`,
    ``,
    `输出 JSON Schema:`,
    `{`,
    `  "scenes": [`,
    `    {`,
    `      "id": "英文 slug（与章节 sceneRefs 中的 id 对应）",`,
    `      "name": "中文场景名",`,
    `      "description": "场景描述（1-2 句）",`,
    `      "imagePrompt": "英文短句，用于 AI 文生图",`,
    `      "type": "image",`,
    `      "tags": ["可选"],`,
    `      "linkedLocation": "对应 locations[].id（可选）"`,
    `    }`,
    `  ],`,
    `  "locations": [`,
    `    {`,
    `      "id": "英文 slug",`,
    `      "name": "中文地点名",`,
    `      "type": "indoor",`,
    `      "description": "地点描述",`,
    `      "tags": ["可选"],`,
    `      "defaultImagePrompt": "英文短句（可选）"`,
    `    }`,
    `  ]`,
    `}`,
    ``,
    `要求：`,
    `- 每一个章节里出现的场景 id 都必须在 scenes[] 里出现；`,
    `- 若多个场景共享同一地理位置，提炼一个 locations[] 条目并通过 linkedLocation 连接；`,
    `- locations[] 可为空数组；`,
    `- 除 JSON 外不得有任何其他内容。`,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Step 4 · knowledge
// ---------------------------------------------------------------------------

export function buildKnowledgeInstruction(template: TemplateDef): string {
  return [
    `# 当前步骤：知识沉淀（Step 4 / 4）`,
    ``,
    `从素材中提炼 3–8 条可长期复用的背景知识条目（术语定义、政策要点、SOP 步骤、时代背景等），`,
    `供 Studio 知识库（adv/knowledge/）检索。避免重复素材原文，只沉淀"值得被其他章节再次使用"的部分。`,
    ``,
    `模板是否启用知识沉淀：${template.knowledgeExtraction ? 'yes' : 'no'}。`,
    `${template.knowledgeExtraction ? '' : '（模板已关闭知识沉淀，请返回 { "entries": [] }）'}`,
    ``,
    `输出 JSON Schema:`,
    `{`,
    `  "entries": [`,
    `    {`,
    `      "id": "英文 slug",`,
    `      "title": "条目标题",`,
    `      "domain": "可选分类（如：政策 / 术语 / 流程）",`,
    `      "body": "Markdown 正文（1-3 段）",`,
    `      "tags": ["可选"]`,
    `    }`,
    `  ]`,
    `}`,
    ``,
    `除 JSON 外不得有任何其他内容。`,
  ].filter(Boolean).join('\n')
}
