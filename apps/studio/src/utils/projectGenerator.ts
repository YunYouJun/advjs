/**
 * Source-to-Project generator (Phase M10 core pipeline).
 *
 * Given a normalized source + template, produces a flat list of
 * {@link TemplateFile}s — the same shape as `utils/projectTemplate.ts` uses
 * for built-in project starters — so the writer loop is shared via
 * `writeTemplateFiles(fs, files)`.
 *
 * Four LLM steps, each gated by a JSON schema validator (see
 * `./projectGenerator/schemas.ts`):
 *   1. characters  → adv/characters/{id}.character.md
 *   2. chapters    → adv/chapters/NN.adv.md     (one LLM call per phase)
 *   3. scenes      → adv/scenes/{id}.md         (+ adv/locations/{id}.md)
 *   4. knowledge   → adv/knowledge/{id}.md      (optional per template)
 *
 * Graceful degradation: if step 1 fails the whole generation aborts (no
 * characters ⇒ nothing else is meaningful). Any later step's failure just
 * flips `draftMode=true` and the pipeline continues with the data it has.
 *
 * Cache-friendly layout: `buildSystemPrompt` and `buildSharedUserContext`
 * are byte-identical across all 4+N calls → OpenAI-compatible providers
 * with prefix cache (Anthropic, DeepSeek, Qwen, …) hit cache for calls 2–N.
 */

import type { AdvCharacter } from '@advjs/types'
import type { ChatMessage } from './aiClient'
import type {
  ChapterJson,
  CharactersJson,
  GeneratedChapter,
  GeneratedCharacter,
  GeneratedLocation,
  GeneratedScene,
  KnowledgeJson,
  ScenesJson,
} from './projectGenerator/schemas'
import type { TemplateFile } from './projectTemplate'
import type { NormalizedSource } from './sourceParser'
import type { TemplateDef } from './templates/loadTemplate'
import { stringifyCharacterMd } from '@advjs/parser'
import { useAiSettingsStore } from '../stores/useAiSettingsStore'
import { AiApiError, buildStreamOptions, streamChat } from './aiClient'
import { parseAiJson } from './chatUtils'
import { stringifyLocationMd } from './locationMd'
import {
  buildChapterInstruction,
  buildCharactersInstruction,
  buildKnowledgeInstruction,
  buildScenesInstruction,
  buildSharedUserContext,
  buildSystemPrompt,
} from './projectGenerator/prompts'
import {
  validateChapterJson,
  validateCharactersJson,
  validateKnowledgeJson,
  validateScenesJson,
} from './projectGenerator/schemas'
import { stringifySceneMd } from './sceneMd'
import { toSlug } from './slug'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type GenerationStep = 'characters' | 'chapters' | 'scenes' | 'knowledge' | 'done'

export interface GenerateProgressEvent {
  step: GenerationStep
  phase: 'start' | 'chunk' | 'complete' | 'error'
  message: string
  partialFiles?: TemplateFile[]
  errorRecoverable?: boolean
}

export interface GenerateStats {
  characters: number
  chapters: number
  scenes: number
  locations: number
  knowledge: number
}

export interface GenerateResult {
  files: TemplateFile[]
  stats: GenerateStats
  failedSteps: GenerationStep[]
  draftMode: boolean
}

/**
 * Allows tests to inject a fake AI/settings bridge without pulling Pinia.
 * Production code uses the default implementation which reads the current
 * `useAiSettingsStore()`.
 */
export interface AiBridge {
  isConfigured: () => boolean
  request: (messages: ChatMessage[], opts: { maxTokens: number, temperature: number, signal?: AbortSignal }) => Promise<string>
}

export interface GenerateOptions {
  source: NormalizedSource
  template: TemplateDef
  projectName: string
  projectSlug: string
  onProgress?: (e: GenerateProgressEvent) => void
  signal?: AbortSignal
  /**
   * Override the AI transport. Injected by tests. Leave undefined in
   * production to use `useAiSettingsStore()` + `streamChat`.
   */
  aiBridge?: AiBridge
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEP_TOKEN_BUDGET: Record<Exclude<GenerationStep, 'done'>, number> = {
  characters: 1500,
  chapters: 2000,
  scenes: 1500,
  knowledge: 1500,
}

const STEP_TEMPERATURE = 0.7
// Retries for parse/validation failures (LLM outputs aren't always valid JSON).
const PARSE_RETRIES = 1

// ---------------------------------------------------------------------------
// Default AiBridge (production path)
// ---------------------------------------------------------------------------

function createDefaultAiBridge(): AiBridge {
  return {
    isConfigured() {
      return useAiSettingsStore().isConfigured
    },
    async request(messages, opts) {
      const aiSettings = useAiSettingsStore()
      const streamOptions = buildStreamOptions(
        messages,
        aiSettings.config,
        aiSettings.effectiveBaseURL,
        aiSettings.effectiveModel,
        opts.signal,
      )
      streamOptions.maxTokens = opts.maxTokens
      streamOptions.temperature = opts.temperature
      let accumulated = ''
      for await (const delta of streamChat(streamOptions))
        accumulated += delta
      return accumulated
    },
  }
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export async function generateProject(opts: GenerateOptions): Promise<GenerateResult> {
  const { source, template, projectName, projectSlug, onProgress, signal } = opts
  const aiBridge = opts.aiBridge ?? createDefaultAiBridge()

  if (!aiBridge.isConfigured())
    throw new AiApiError('AI provider is not configured', 'auth')

  const emit = (e: GenerateProgressEvent) => {
    try {
      onProgress?.(e)
    }
    catch { /* swallow listener errors */ }
  }

  const files: TemplateFile[] = []
  const stats: GenerateStats = { characters: 0, chapters: 0, scenes: 0, locations: 0, knowledge: 0 }
  const failedSteps: GenerationStep[] = []

  // Cache-stable prefix for every step
  const sharedSystem = buildSystemPrompt(template)
  const sharedUser = buildSharedUserContext(template, source)

  const logStart = new Date().toISOString()

  // --------------------------- Step 1 · characters ---------------------------
  emit({ step: 'characters', phase: 'start', message: '提取角色中…' })
  let characters: GeneratedCharacter[]
  try {
    const data = await runStep<CharactersJson>(
      aiBridge,
      [
        { role: 'system', content: sharedSystem },
        { role: 'user', content: sharedUser },
        { role: 'user', content: buildCharactersInstruction(template) },
      ],
      validateCharactersJson,
      STEP_TOKEN_BUDGET.characters,
      signal,
    )
    if (!data)
      throw new Error('LLM did not return valid characters JSON')
    characters = data.characters
  }
  catch (err) {
    emit({ step: 'characters', phase: 'error', message: `角色生成失败：${(err as Error).message}`, errorRecoverable: false })
    throw err
  }

  for (const c of characters) {
    const file = characterToFile(c)
    files.push(file)
  }
  stats.characters = characters.length
  emit({ step: 'characters', phase: 'complete', message: `已生成 ${characters.length} 个角色`, partialFiles: [...files] })

  // --------------------------- Step 2 · chapters -----------------------------
  emit({ step: 'chapters', phase: 'start', message: `生成 ${template.chapterStructure.length} 个章节…` })
  const chapters: GeneratedChapter[] = []
  for (let i = 0; i < template.chapterStructure.length; i++) {
    if (signal?.aborted)
      throw new DOMException('aborted', 'AbortError')
    try {
      const data = await runStep<ChapterJson>(
        aiBridge,
        [
          { role: 'system', content: sharedSystem },
          { role: 'user', content: sharedUser },
          { role: 'user', content: buildChapterInstruction(template, i, characters) },
        ],
        validateChapterJson,
        STEP_TOKEN_BUDGET.chapters,
        signal,
      )
      if (!data)
        throw new Error(`chapter ${i + 1} JSON invalid`)
      chapters.push(data.chapter)
      const filename = normalizeChapterFilename(data.chapter.filename, i + 1)
      files.push(chapterToFile(filename, data.chapter))
      emit({
        step: 'chapters',
        phase: 'chunk',
        message: `章节 ${i + 1}/${template.chapterStructure.length} 完成：${data.chapter.title}`,
        partialFiles: [...files],
      })
    }
    catch (err) {
      emit({
        step: 'chapters',
        phase: 'error',
        message: `章节 ${i + 1} 生成失败：${(err as Error).message}`,
        errorRecoverable: true,
      })
      if (!failedSteps.includes('chapters'))
        failedSteps.push('chapters')
      // continue with remaining chapters
    }
  }
  stats.chapters = chapters.length
  emit({ step: 'chapters', phase: 'complete', message: `章节阶段完成（${chapters.length} 章）`, partialFiles: [...files] })

  // --------------------------- Step 3 · scenes -------------------------------
  emit({ step: 'scenes', phase: 'start', message: '生成场景与地点中…' })
  let scenes: GeneratedScene[] = []
  let locations: GeneratedLocation[] = []
  if (chapters.length > 0) {
    try {
      const data = await runStep<ScenesJson>(
        aiBridge,
        [
          { role: 'system', content: sharedSystem },
          { role: 'user', content: sharedUser },
          { role: 'user', content: buildScenesInstruction(template, chapters) },
        ],
        validateScenesJson,
        STEP_TOKEN_BUDGET.scenes,
        signal,
      )
      if (!data)
        throw new Error('scenes JSON invalid')
      scenes = data.scenes
      locations = data.locations ?? []
    }
    catch (err) {
      emit({ step: 'scenes', phase: 'error', message: `场景生成失败：${(err as Error).message}`, errorRecoverable: true })
      if (!failedSteps.includes('scenes'))
        failedSteps.push('scenes')
    }
  }
  for (const s of scenes)
    files.push(sceneToFile(s))
  for (const l of locations)
    files.push(locationToFile(l))
  stats.scenes = scenes.length
  stats.locations = locations.length
  emit({ step: 'scenes', phase: 'complete', message: `已生成 ${scenes.length} 个场景、${locations.length} 个地点`, partialFiles: [...files] })

  // --------------------------- Step 4 · knowledge ----------------------------
  if (template.knowledgeExtraction) {
    emit({ step: 'knowledge', phase: 'start', message: '沉淀知识条目…' })
    try {
      const data = await runStep<KnowledgeJson>(
        aiBridge,
        [
          { role: 'system', content: sharedSystem },
          { role: 'user', content: sharedUser },
          { role: 'user', content: buildKnowledgeInstruction(template) },
        ],
        validateKnowledgeJson,
        STEP_TOKEN_BUDGET.knowledge,
        signal,
      )
      if (!data)
        throw new Error('knowledge JSON invalid')
      for (const entry of data.entries)
        files.push(knowledgeToFile(entry))
      stats.knowledge = data.entries.length
      emit({ step: 'knowledge', phase: 'complete', message: `已沉淀 ${data.entries.length} 条知识`, partialFiles: [...files] })
    }
    catch (err) {
      emit({ step: 'knowledge', phase: 'error', message: `知识沉淀失败：${(err as Error).message}`, errorRecoverable: true })
      if (!failedSteps.includes('knowledge'))
        failedSteps.push('knowledge')
    }
  }

  // --------------------------- Boilerplate files -----------------------------
  files.push({ path: 'README.md', content: buildReadme(projectName, template) })
  files.push({ path: 'adv/world.md', content: buildWorldMd(source, template) })
  files.push({ path: 'adv/outline.md', content: buildOutlineMd(chapters) })
  files.push({
    path: 'adv/.import-log.md',
    content: buildImportLog({
      projectName,
      projectSlug,
      source,
      template,
      stats,
      failedSteps,
      startedAt: logStart,
      finishedAt: new Date().toISOString(),
    }),
  })

  emit({ step: 'done', phase: 'complete', message: '生成完成', partialFiles: [...files] })

  return {
    files,
    stats,
    failedSteps,
    draftMode: failedSteps.length > 0,
  }
}

// ---------------------------------------------------------------------------
// Per-step LLM runner with parse-level retries
// ---------------------------------------------------------------------------

async function runStep<T>(
  bridge: AiBridge,
  messages: ChatMessage[],
  validate: (raw: any) => T,
  maxTokens: number,
  signal: AbortSignal | undefined,
): Promise<T | null> {
  for (let attempt = 0; attempt <= PARSE_RETRIES; attempt++) {
    if (signal?.aborted)
      throw new DOMException('aborted', 'AbortError')
    const accumulated = await bridge.request(messages, { maxTokens, temperature: STEP_TEMPERATURE, signal })
    const result = parseAiJson(accumulated, validate)
    if (result !== null)
      return result
    // else: malformed — loop to retry
  }
  return null
}

// ---------------------------------------------------------------------------
// Converters: GeneratedX → TemplateFile
// ---------------------------------------------------------------------------

function characterToFile(c: GeneratedCharacter): TemplateFile {
  const character: AdvCharacter = {
    id: c.id,
    name: c.name,
    tags: c.tags,
    appearance: c.appearance,
    personality: c.personality,
    background: c.background,
    concept: c.concept,
    speechStyle: c.speechStyle,
  }
  return {
    path: `adv/characters/${c.id}.character.md`,
    content: stringifyCharacterMd(character),
  }
}

function chapterToFile(filename: string, c: GeneratedChapter): TemplateFile {
  const frontmatterLines: string[] = ['---']
  frontmatterLines.push(`title: '${escapeYaml(c.title)}'`)
  if (c.plotSummary)
    frontmatterLines.push(`plotSummary: '${escapeYaml(c.plotSummary)}'`)
  frontmatterLines.push(`phase: ${c.phase}`)
  frontmatterLines.push('---')
  frontmatterLines.push('')
  const body = c.body.trim()
  const choiceList = (c.choices ?? []).map(ch => `- ${ch.label}${ch.hint ? `（${ch.hint}）` : ''}`).join('\n')
  const content = choiceList
    ? `${frontmatterLines.join('\n')}${body}\n\n${choiceList}\n`
    : `${frontmatterLines.join('\n')}${body}\n`
  return { path: `adv/chapters/${filename}`, content }
}

function sceneToFile(s: GeneratedScene): TemplateFile {
  return {
    path: `adv/scenes/${s.id}.md`,
    content: stringifySceneMd({
      id: s.id,
      name: s.name,
      description: s.description,
      imagePrompt: s.imagePrompt,
      type: s.type ?? 'image',
      tags: s.tags,
      linkedLocation: s.linkedLocation,
    }),
  }
}

function locationToFile(l: GeneratedLocation): TemplateFile {
  return {
    path: `adv/locations/${l.id}.md`,
    content: stringifyLocationMd({
      id: l.id,
      name: l.name,
      type: l.type,
      description: l.description,
      tags: l.tags,
      defaultImagePrompt: l.defaultImagePrompt,
    }),
  }
}

function knowledgeToFile(entry: { id: string, title: string, domain?: string, body: string, tags?: string[] }): TemplateFile {
  const header = [`# ${entry.title}`]
  if (entry.domain)
    header.push(`\n> Domain: ${entry.domain}`)
  if (entry.tags && entry.tags.length)
    header.push(`> Tags: ${entry.tags.join(', ')}`)
  const folder = entry.domain ? `adv/knowledge/${toSlug(entry.domain) || 'general'}` : 'adv/knowledge'
  return {
    path: `${folder}/${entry.id}.md`,
    content: `${header.join('\n')}\n\n${entry.body.trim()}\n`,
  }
}

// ---------------------------------------------------------------------------
// Boilerplate builders
// ---------------------------------------------------------------------------

function buildReadme(projectName: string, template: TemplateDef): string {
  return `# ${projectName}

An [ADV.JS](https://advjs.org) project generated from \`${template.id}\` template.

## Structure

\`\`\`
adv/
├── world.md            # 世界观设定
├── outline.md          # 故事大纲
├── chapters/           # 章节文件
├── characters/         # 角色设定
├── scenes/             # 场景设定
├── locations/          # 地点设定
└── knowledge/          # 知识沉淀
\`\`\`

## Preview

\`\`\`bash
npx advjs dev
\`\`\`

> Generated by ADV.JS Studio · Phase M10 Source-to-Project Pipeline
`
}

function buildWorldMd(source: NormalizedSource, template: TemplateDef): string {
  return `# 世界观设定

> 自动生成自 ${source.type} 素材「${source.title}」，模板 ${template.name}

## 氛围与基调

${template.sceneStyle}

## 素材梗概

${source.segments.slice(0, 2).map(s => `- **${s.heading}**：${trimPreview(s.body, 120)}`).join('\n')}
`
}

function buildOutlineMd(chapters: GeneratedChapter[]): string {
  if (chapters.length === 0)
    return `# 故事大纲\n\n（生成过程中章节阶段失败，请在 Studio 内编辑大纲。）\n`
  const lines = ['# 故事大纲', '']
  chapters.forEach((c, i) => {
    lines.push(`## 第 ${i + 1} 章 · ${c.title}`)
    if (c.plotSummary)
      lines.push(`\n${c.plotSummary}`)
    lines.push('')
  })
  return lines.join('\n')
}

interface ImportLogInput {
  projectName: string
  projectSlug: string
  source: NormalizedSource
  template: TemplateDef
  stats: GenerateStats
  failedSteps: GenerationStep[]
  startedAt: string
  finishedAt: string
}

function buildImportLog(input: ImportLogInput): string {
  const { projectName, projectSlug, source, template, stats, failedSteps, startedAt, finishedAt } = input
  return `# Import Log

- Project: **${projectName}** (slug: \`${projectSlug}\`)
- Template: \`${template.id}\` (${template.name}, v${template.version})
- Source: ${source.type} · 「${source.title}」 · ${source.segments.length} segments
- Started: ${startedAt}
- Finished: ${finishedAt}

## Stats

| Kind | Count |
| --- | --- |
| characters | ${stats.characters} |
| chapters | ${stats.chapters} |
| scenes | ${stats.scenes} |
| locations | ${stats.locations} |
| knowledge | ${stats.knowledge} |

## Failed steps

${failedSteps.length === 0 ? '_(none — generation completed clean)_' : failedSteps.map(s => `- ${s}`).join('\n')}
`
}

// ---------------------------------------------------------------------------
// Tiny helpers
// ---------------------------------------------------------------------------

const ESCAPE_YAML_APOS_RE = /'/g
const ESCAPE_YAML_NL_RE = /\r?\n/g
const TRIM_PREVIEW_RE = /\s+/g
const NORMALIZE_CHAPTER_LEADING_SLASH_RE = /^\/+/g
const NORMALIZE_CHAPTER_ADV_RE = /^adv\/chapters\//g
const NORMALIZE_CHAPTER_MD_RE = /\.md$/g

function escapeYaml(s: string): string {
  return s.replace(ESCAPE_YAML_APOS_RE, '\'\'').replace(ESCAPE_YAML_NL_RE, ' ')
}

function trimPreview(s: string, n: number): string {
  const flat = s.replace(TRIM_PREVIEW_RE, ' ').trim()
  return flat.length > n ? `${flat.slice(0, n)}…` : flat
}

function normalizeChapterFilename(suggested: string | undefined, index: number): string {
  const fallback = `${String(index).padStart(2, '0')}.adv.md`
  if (!suggested)
    return fallback
  const trimmed = suggested.trim().replace(NORMALIZE_CHAPTER_LEADING_SLASH_RE, '').replace(NORMALIZE_CHAPTER_ADV_RE, '')
  if (!trimmed)
    return fallback
  return trimmed.endsWith('.adv.md') ? trimmed : `${trimmed.replace(NORMALIZE_CHAPTER_MD_RE, '')}.adv.md`
}
