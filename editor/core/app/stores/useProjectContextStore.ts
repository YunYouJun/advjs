import { acceptHMRUpdate, defineStore } from 'pinia'

export interface ProjectContextStats {
  chapters: number
  characters: number
  scenes: number
}

export const useProjectContextStore = defineStore('@advjs/editor:project-context', () => {
  const consoleStore = useConsoleStore()

  const worldContent = ref('')
  const outlineContent = ref('')
  const glossaryContent = ref('')
  const chaptersReadme = ref('')
  const charsReadme = ref('')
  const scenesReadme = ref('')

  const stats = ref<ProjectContextStats>({
    chapters: 0,
    characters: 0,
    scenes: 0,
  })

  const isLoaded = ref(false)

  /**
   * Try to read a file from a directory handle, return empty string if not found
   */
  async function tryReadFile(dirHandle: FileSystemDirectoryHandle, path: string): Promise<string> {
    try {
      const parts = path.split('/')
      let currentDir = dirHandle

      // Navigate through subdirectories
      for (let i = 0; i < parts.length - 1; i++) {
        currentDir = await currentDir.getDirectoryHandle(parts[i])
      }

      const fileHandle = await currentDir.getFileHandle(parts.at(-1)!)
      const file = await fileHandle.getFile()
      return await file.text()
    }
    catch {
      return ''
    }
  }

  /**
   * Count entries in a subdirectory matching a pattern
   */
  async function countEntries(dirHandle: FileSystemDirectoryHandle, subDir: string, ext: string): Promise<number> {
    try {
      const subDirHandle = await dirHandle.getDirectoryHandle(subDir)
      let count = 0
      for await (const entry of subDirHandle.values()) {
        if (entry.kind === 'file' && entry.name.endsWith(ext) && entry.name !== 'README.md') {
          count++
        }
      }
      return count
    }
    catch {
      return 0
    }
  }

  /**
   * Load all project context files from the adv/ directory
   */
  async function loadContext(dirHandle: FileSystemDirectoryHandle) {
    try {
      // Try to find adv/ subdirectory first
      let advDir: FileSystemDirectoryHandle
      try {
        advDir = await dirHandle.getDirectoryHandle('adv')
      }
      catch {
        // If no adv/ subdirectory, use root as adv dir
        advDir = dirHandle
      }

      // Read context files in parallel
      const [world, outline, glossary, chapters, chars, scenes] = await Promise.all([
        tryReadFile(advDir, 'world.md'),
        tryReadFile(advDir, 'outline.md'),
        tryReadFile(advDir, 'glossary.md'),
        tryReadFile(advDir, 'chapters/README.md'),
        tryReadFile(advDir, 'characters/README.md'),
        tryReadFile(advDir, 'scenes/README.md'),
      ])

      worldContent.value = world
      outlineContent.value = outline
      glossaryContent.value = glossary
      chaptersReadme.value = chapters
      charsReadme.value = chars
      scenesReadme.value = scenes

      // Count stats
      const [chapterCount, characterCount, sceneCount] = await Promise.all([
        countEntries(advDir, 'chapters', '.adv.md'),
        countEntries(advDir, 'characters', '.character.md'),
        countEntries(advDir, 'scenes', '.md'),
      ])

      stats.value = {
        chapters: chapterCount,
        characters: characterCount,
        scenes: sceneCount,
      }

      isLoaded.value = true
      consoleStore.success('Project context loaded')
    }
    catch (error) {
      consoleStore.error('Failed to load project context', { error })
    }
  }

  /**
   * Get merged context string for AI (equivalent to `adv context` output)
   */
  function getMergedContext(): string {
    const sections: string[] = []

    if (worldContent.value) {
      sections.push(`# World\n\n${worldContent.value}`)
    }
    if (outlineContent.value) {
      sections.push(`# Outline\n\n${outlineContent.value}`)
    }
    if (chaptersReadme.value) {
      sections.push(`# Chapters\n\n${chaptersReadme.value}`)
    }
    if (charsReadme.value) {
      sections.push(`# Characters\n\n${charsReadme.value}`)
    }
    if (scenesReadme.value) {
      sections.push(`# Scenes\n\n${scenesReadme.value}`)
    }
    if (glossaryContent.value) {
      sections.push(`# Glossary\n\n${glossaryContent.value}`)
    }

    return sections.join('\n\n---\n\n')
  }

  return {
    worldContent,
    outlineContent,
    glossaryContent,
    chaptersReadme,
    charsReadme,
    scenesReadme,
    stats,
    isLoaded,

    loadContext,
    getMergedContext,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useProjectContextStore, import.meta.hot))
