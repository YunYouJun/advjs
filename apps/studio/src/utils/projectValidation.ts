/**
 * Browser-side project validation.
 *
 * Mirrors the logic of packages/advjs/node/commands/check.ts
 * but operates on in-memory data from useProjectContent instead of the filesystem.
 */

import type { AdvCharacter } from '@advjs/types'
import type { AudioInfo, ChapterInfo, SceneInfo } from '../composables/useProjectContent'
import { parseAst } from '@advjs/parser'

export interface ValidationIssue {
  type: 'error' | 'warning'
  category: 'syntax' | 'character' | 'scene' | 'audio'
  file: string
  message: string
}

export interface ValidationResult {
  issues: ValidationIssue[]
  passed: boolean
  stats: {
    scripts: number
    characters: number
    scenes: number
    audios: number
  }
}

// Match @Name or @Name(status) or @Name（状态）
const PARENTHESES_STATUS_RE = /[（(].*?[）)]$/

// Match 【place，time，inOrOut】 scene blocks
const SCENE_BLOCK_RE = /^【(.+)】$/gm

/**
 * Extract character names referenced via @Name syntax from .adv.md content.
 */
function extractCharacterRefs(content: string): string[] {
  const names = new Set<string>()
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('@'))
      continue
    let name = trimmed.slice(1)
    name = name.replace(PARENTHESES_STATUS_RE, '').trim()
    if (name)
      names.add(name)
  }
  return [...names]
}

/**
 * Extract scene place names from 【place，time，inOrOut】 syntax.
 */
function extractSceneRefs(content: string): string[] {
  const places = new Set<string>()
  let match: RegExpExecArray | null
  SCENE_BLOCK_RE.lastIndex = 0
  // eslint-disable-next-line no-cond-assign
  while ((match = SCENE_BLOCK_RE.exec(content)) !== null) {
    const parts = match[1].split('，')
    if (parts[0])
      places.add(parts[0].trim())
  }
  return [...places]
}

/**
 * Validate a project using in-memory data from useProjectContent.
 * Checks: syntax, character references, scene references, audio link integrity.
 */
export async function validateProject(
  chapters: ChapterInfo[],
  characters: AdvCharacter[],
  scenes: SceneInfo[],
  audios: AudioInfo[],
): Promise<ValidationResult> {
  const issues: ValidationIssue[] = []

  // Build known character lookup (id, name, aliases)
  const knownCharacters = new Set<string>()
  for (const char of characters) {
    knownCharacters.add(char.id)
    knownCharacters.add(char.name)
    if (char.aliases) {
      for (const alias of char.aliases)
        knownCharacters.add(alias)
    }
  }

  // Build known scene lookup (id, name)
  const knownScenes = new Set<string>()
  for (const scene of scenes) {
    if (scene.id)
      knownScenes.add(scene.id)
    knownScenes.add(scene.name)
    // Also use filename without extension
    const fileName = scene.file.split('/').pop()?.replace('.md', '')
    if (fileName)
      knownScenes.add(fileName)
  }

  // Build known chapter files lookup
  const knownChapterFiles = new Set(chapters.map(c => c.file))

  // 1. Syntax check + reference extraction
  for (const chapter of chapters) {
    if (!chapter.content)
      continue

    // Syntax check
    try {
      await parseAst(chapter.content)
    }
    catch (err) {
      issues.push({
        type: 'error',
        category: 'syntax',
        file: chapter.file,
        message: err instanceof Error ? err.message : String(err),
      })
    }

    // Character reference check
    const charRefs = extractCharacterRefs(chapter.content)
    for (const name of charRefs) {
      if (!knownCharacters.has(name)) {
        issues.push({
          type: 'error',
          category: 'character',
          file: chapter.file,
          message: name,
        })
      }
    }

    // Scene reference check
    const sceneRefs = extractSceneRefs(chapter.content)
    for (const place of sceneRefs) {
      if (!knownScenes.has(place)) {
        issues.push({
          type: 'warning',
          category: 'scene',
          file: chapter.file,
          message: place,
        })
      }
    }
  }

  // 2. Audio link integrity
  for (const audio of audios) {
    if (audio.linkedScenes) {
      for (const sceneId of audio.linkedScenes) {
        if (!knownScenes.has(sceneId)) {
          issues.push({
            type: 'warning',
            category: 'audio',
            file: audio.file,
            message: `linkedScene "${sceneId}" not found`,
          })
        }
      }
    }
    if (audio.linkedChapters) {
      for (const chapterFile of audio.linkedChapters) {
        if (!knownChapterFiles.has(chapterFile)) {
          issues.push({
            type: 'warning',
            category: 'audio',
            file: audio.file,
            message: `linkedChapter "${chapterFile}" not found`,
          })
        }
      }
    }
  }

  return {
    issues,
    passed: issues.filter(i => i.type === 'error').length === 0,
    stats: {
      scripts: chapters.length,
      characters: characters.length,
      scenes: scenes.length,
      audios: audios.length,
    },
  }
}
