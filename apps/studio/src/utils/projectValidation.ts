/**
 * Browser-side project validation.
 *
 * Mirrors the logic of packages/advjs/node/commands/check.ts
 * but operates on in-memory data from useProjectContent instead of the filesystem.
 */

import type { AdvCharacter } from '@advjs/types'
import type {
  AudioInfo,
  ChapterInfo,
  LocationInfo,
  SceneInfo,
} from '../composables/useProjectContent'
import type { IFileSystem } from './fs'
import {
  extractCharacterRefs,
  extractSceneRefs,
  parseAst,
} from '@advjs/parser'

export interface ValidationIssue {
  type: 'error' | 'warning'
  category: 'syntax' | 'character' | 'scene' | 'audio' | 'location'
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
    locations: number
    audios: number
  }
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
  locations: LocationInfo[] = [],
): Promise<ValidationResult> {
  const issues: ValidationIssue[] = []

  // Build known location lookup
  const knownLocations = new Set<string>()
  for (const loc of locations) {
    if (loc.id)
      knownLocations.add(loc.id)
    knownLocations.add(loc.name)
  }

  // Build known character lookup (id, name, aliases)
  const knownCharacters = new Set<string>()
  for (const char of characters) {
    knownCharacters.add(char.id)
    knownCharacters.add(char.name)
    if (char.aliases) {
      for (const alias of char.aliases) knownCharacters.add(alias)
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

  // 3. Scene linkedLocation check
  for (const scene of scenes) {
    if (scene.linkedLocation && !knownLocations.has(scene.linkedLocation)) {
      issues.push({
        type: 'warning',
        category: 'location',
        file: scene.file,
        message: `linkedLocation "${scene.linkedLocation}" not found`,
      })
    }
  }

  // 4. Location reference integrity
  for (const loc of locations) {
    if (loc.linkedScenes) {
      for (const sceneId of loc.linkedScenes) {
        if (!knownScenes.has(sceneId)) {
          issues.push({
            type: 'warning',
            category: 'location',
            file: loc.file,
            message: `linkedScene "${sceneId}" not found`,
          })
        }
      }
    }
    if (loc.linkedCharacters) {
      for (const charId of loc.linkedCharacters) {
        if (!knownCharacters.has(charId)) {
          issues.push({
            type: 'warning',
            category: 'location',
            file: loc.file,
            message: `linkedCharacter "${charId}" not found`,
          })
        }
      }
    }
  }

  // 5. Character relationship targetId integrity
  const characterIdSet = new Set(characters.map(c => c.id))
  for (const char of characters) {
    if (char.relationships) {
      for (const rel of char.relationships) {
        if (rel.targetId && !characterIdSet.has(rel.targetId)) {
          issues.push({
            type: 'warning',
            category: 'character',
            file: `characters/${char.id}`,
            message: `relationship targetId "${rel.targetId}" not found`,
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
      locations: locations.length,
      audios: audios.length,
    },
  }
}

/**
 * Auto-fix warning-level issues by removing broken references from YAML frontmatter.
 *
 * Supported fix types:
 * - audio/location: remove broken linkedScenes/linkedChapters/linkedCharacters entries
 * - character: remove broken relationship.targetId entries
 * - scene: remove broken linkedLocation field
 *
 * Returns the list of issues that were successfully fixed.
 */
export async function autoFixIssues(
  issues: ValidationIssue[],
  fs: IFileSystem,
): Promise<ValidationIssue[]> {
  const fixable = issues.filter(
    i =>
      i.type === 'warning'
      && ['audio', 'location', 'character', 'scene'].includes(i.category),
  )

  if (fixable.length === 0)
    return []

  // Group issues by file for batch processing
  const byFile = new Map<string, ValidationIssue[]>()
  for (const issue of fixable) {
    const list = byFile.get(issue.file) || []
    list.push(issue)
    byFile.set(issue.file, list)
  }

  const fixed: ValidationIssue[] = []

  for (const [file, fileIssues] of byFile) {
    try {
      const content = await fs.readFile(file)
      if (!content)
        continue

      let updated = content

      for (const issue of fileIssues) {
        const before = updated
        updated = removeRefFromFrontmatter(updated, issue)
        if (updated !== before)
          fixed.push(issue)
      }

      if (updated !== content) {
        await fs.writeFile(file, updated)
      }
    }
    catch {
      // Skip files that can't be read/written
    }
  }

  return fixed
}

/**
 * Remove a broken reference from YAML frontmatter.
 * Handles list items (linkedScenes, linkedChapters, linkedCharacters, relationships)
 * and scalar fields (linkedLocation).
 */
const QUOTED_VALUE_RE = /"([^"]+)"/
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---/
const TARGET_ID_LINE_RE = /^\s+-\s+targetId:\s*/
const REL_CONTINUATION_RE = /^\s{4,}\w/
const REL_LIST_ITEM_RE = /^\s+-\s/
const MULTI_NEWLINE_RE = /\n{3,}/g
const ESCAPE_REGEX_CHARS_RE = /[.*+?^${}()|[\]\\]/g

function removeRefFromFrontmatter(
  content: string,
  issue: ValidationIssue,
): string {
  // Extract the broken reference value from the issue message
  // Messages follow patterns like:
  //   linkedScene "xxx" not found
  //   linkedChapter "xxx" not found
  //   linkedCharacter "xxx" not found
  //   linkedLocation "xxx" not found
  //   relationship targetId "xxx" not found
  const match = issue.message.match(QUOTED_VALUE_RE)
  if (!match)
    return content

  const brokenRef = match[1]

  // Split content into frontmatter and body
  const fmMatch = content.match(FRONTMATTER_RE)
  if (!fmMatch)
    return content

  const frontmatter = fmMatch[1]
  let updatedFm = frontmatter

  if (issue.message.startsWith('relationship targetId')) {
    // Remove the entire relationship entry that references this targetId
    // Pattern: lines like "  - targetId: xxx\n    type: ...\n    description: ..."
    const lines = updatedFm.split('\n')
    const newLines: string[] = []
    let skipRelEntry = false
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (TARGET_ID_LINE_RE.test(line) && line.includes(brokenRef)) {
        skipRelEntry = true
        continue
      }
      if (skipRelEntry) {
        // Skip continuation lines of this relationship entry (indented, not a new list item)
        if (REL_CONTINUATION_RE.test(line) && !REL_LIST_ITEM_RE.test(line)) {
          continue
        }
        skipRelEntry = false
      }
      newLines.push(line)
    }
    updatedFm = newLines.join('\n')
  }
  else if (issue.message.startsWith('linkedLocation')) {
    // Remove the linkedLocation line entirely
    updatedFm = updatedFm.replace(
      new RegExp(`^\\s*linkedLocation:\\s*${escapeRegex(brokenRef)}\\s*$`, 'm'),
      '',
    )
  }
  else {
    // Remove a list item matching the broken ref
    // Handles: "  - brokenRef" patterns under linkedScenes/linkedChapters/linkedCharacters
    updatedFm = updatedFm.replace(
      new RegExp(`^\\s*-\\s*${escapeRegex(brokenRef)}\\s*$`, 'm'),
      '',
    )
  }

  // Clean up empty lines left in frontmatter
  updatedFm = updatedFm.replace(MULTI_NEWLINE_RE, '\n\n').trim()

  return content.replace(fmMatch[1], updatedFm)
}

function escapeRegex(str: string): string {
  return str.replace(ESCAPE_REGEX_CHARS_RE, '\\$&')
}
