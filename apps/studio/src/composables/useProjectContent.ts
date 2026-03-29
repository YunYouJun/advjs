import type { AdvCharacter } from '@advjs/types'
import { parseCharacterMd } from '@advjs/parser'
import { ref } from 'vue'
import { downloadFromCloud, listCloudFiles } from '../utils/cloudSync'
import { listFilesInDir, readFileFromDir } from '../utils/fileAccess'
import { parseSceneMd } from '../utils/sceneMd'
import { useKnowledgeBase } from './useKnowledgeBase'

export interface ChapterInfo {
  file: string
  name: string
  preview: string
  content?: string
}

export interface SceneInfo {
  file: string
  name: string
  id?: string
  description?: string
  imagePrompt?: string
  type?: 'image' | 'model'
  tags?: string[]
}

export interface ProjectStats {
  chapters: number
  characters: number
  scenes: number
  knowledge: number
}

export function useProjectContent() {
  const chapters = ref<ChapterInfo[]>([])
  const characters = ref<AdvCharacter[]>([])
  const scenes = ref<SceneInfo[]>([])
  const stats = ref<ProjectStats>({ chapters: 0, characters: 0, scenes: 0, knowledge: 0 })
  const isLoading = ref(false)
  const knowledgeBase = useKnowledgeBase()

  // Store the last-used dir handle for reload
  let lastDirHandle: FileSystemDirectoryHandle | null = null
  let lastCosConfig: { bucket: string, region: string, secretId: string, secretKey: string } | null = null
  let lastCosPrefix: string | null = null

  /**
   * Load project content from a local FileSystemDirectoryHandle
   */
  async function loadFromDir(dirHandle: FileSystemDirectoryHandle) {
    lastDirHandle = dirHandle
    lastCosConfig = null
    lastCosPrefix = null

    isLoading.value = true
    try {
      // Load chapters
      const chapterFiles: string[] = []
      try {
        const files = await listFilesInDir(dirHandle, 'adv/chapters', '.adv.md')
        chapterFiles.push(...files)
      }
      catch { /* no chapters dir */ }

      try {
        const rootFiles = await listFilesInDir(dirHandle, 'adv', '.adv.md')
        for (const f of rootFiles) {
          if (!chapterFiles.includes(f))
            chapterFiles.push(f)
        }
      }
      catch { /* no root adv.md files */ }

      chapterFiles.sort()

      const chapterInfos: ChapterInfo[] = []
      for (const file of chapterFiles) {
        let preview = ''
        let content = ''
        try {
          content = await readFileFromDir(dirHandle, file)
          // Extract first meaningful line as preview
          const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('---') && !l.startsWith('#'))
          preview = lines[0]?.slice(0, 100) || ''
        }
        catch { /* can't read */ }

        chapterInfos.push({
          file,
          name: file.split('/').pop()?.replace('.adv.md', '') || file,
          preview,
          content,
        })
      }
      chapters.value = chapterInfos

      // Load characters
      const charList: AdvCharacter[] = []
      try {
        const charFiles = await listFilesInDir(dirHandle, 'adv/characters', '.character.md')
        for (const file of charFiles) {
          try {
            const content = await readFileFromDir(dirHandle, file)
            const character = parseCharacterMd(content)
            charList.push(character)
          }
          catch { /* parse error */ }
        }
      }
      catch { /* no characters dir */ }
      characters.value = charList

      // Load scenes with frontmatter parsing
      const sceneList: SceneInfo[] = []
      try {
        const sceneFiles = await listFilesInDir(dirHandle, 'adv/scenes', '.md')
        for (const file of sceneFiles) {
          try {
            const content = await readFileFromDir(dirHandle, file)
            const parsed = parseSceneMd(content)
            sceneList.push({
              file,
              name: parsed.name || file.split('/').pop()?.replace('.md', '') || file,
              id: parsed.id,
              description: parsed.description,
              imagePrompt: parsed.imagePrompt,
              type: parsed.type,
              tags: parsed.tags,
            })
          }
          catch {
            // Fallback: just use file name
            sceneList.push({
              file,
              name: file.split('/').pop()?.replace('.md', '') || file,
            })
          }
        }
      }
      catch { /* no scenes dir */ }
      scenes.value = sceneList

      // Load knowledge base
      await knowledgeBase.loadFromDir(dirHandle)

      // Update stats
      stats.value = {
        chapters: chapterInfos.length,
        characters: charList.length,
        scenes: sceneList.length,
        knowledge: knowledgeBase.entries.value.length,
      }
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Load project content from COS cloud storage
   */
  async function loadFromCos(cosConfig: { bucket: string, region: string, secretId: string, secretKey: string }, prefix: string) {
    lastCosConfig = cosConfig
    lastCosPrefix = prefix
    lastDirHandle = null

    isLoading.value = true
    try {
      const allFiles = await listCloudFiles(cosConfig, prefix)

      // Chapters
      const chapterFiles = allFiles.filter(f => f.endsWith('.adv.md')).sort()
      const chapterInfos: ChapterInfo[] = []
      for (const file of chapterFiles) {
        let preview = ''
        try {
          const content = await downloadFromCloud(cosConfig, file)
          const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('---') && !l.startsWith('#'))
          preview = lines[0]?.slice(0, 100) || ''
        }
        catch { /* can't read */ }

        chapterInfos.push({
          file,
          name: file.split('/').pop()?.replace('.adv.md', '') || file,
          preview,
        })
      }
      chapters.value = chapterInfos

      // Characters
      const charFiles = allFiles.filter(f => f.endsWith('.character.md'))
      const charList: AdvCharacter[] = []
      for (const file of charFiles) {
        try {
          const content = await downloadFromCloud(cosConfig, file)
          const character = parseCharacterMd(content)
          charList.push(character)
        }
        catch { /* parse error */ }
      }
      characters.value = charList

      // Scenes
      const sceneFiles = allFiles.filter(f => f.includes('/scenes/') && f.endsWith('.md'))
      scenes.value = sceneFiles.map(file => ({
        file,
        name: file.split('/').pop()?.replace('.md', '') || file,
      }))

      // Load knowledge base
      await knowledgeBase.loadFromCos(cosConfig, prefix)

      stats.value = {
        chapters: chapterInfos.length,
        characters: charList.length,
        scenes: sceneFiles.length,
        knowledge: knowledgeBase.entries.value.length,
      }
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Reload content from the last-used source
   */
  async function reload() {
    if (lastDirHandle) {
      await loadFromDir(lastDirHandle)
    }
    else if (lastCosConfig && lastCosPrefix) {
      await loadFromCos(lastCosConfig, lastCosPrefix)
    }
  }

  /**
   * Get the current directory handle (for file saving)
   */
  function getDirHandle(): FileSystemDirectoryHandle | null {
    return lastDirHandle
  }

  return {
    chapters,
    characters,
    scenes,
    stats,
    isLoading,
    knowledgeBase,
    loadFromDir,
    loadFromCos,
    reload,
    getDirHandle,
  }
}
