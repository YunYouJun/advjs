import type { AdvCharacter } from '@advjs/types'
import { parseCharacterMd } from '@advjs/parser'
import { ref, watch } from 'vue'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useStudioStore } from '../stores/useStudioStore'
import { parseAudioMd } from '../utils/audioMd'
import { downloadFromCloud, listCloudFiles } from '../utils/cloudSync'
import { AUDIO_EXTENSIONS, listFilesInDir, listFilesInDirByExts, readFileFromDir } from '../utils/fileAccess'
import { parseLocationMd } from '../utils/locationMd'
import { parseSceneMd } from '../utils/sceneMd'
import { useKnowledgeBase } from './useKnowledgeBase'

const FILE_EXT_RE = /\.[^.]+$/

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
  src?: string
}

export interface AudioInfo {
  /** Metadata file path (e.g. adv/audio/bgm.md) or audio file path */
  file: string
  name: string
  description?: string
  /** Audio file path within the project */
  src?: string
  duration?: number
  tags?: string[]
  linkedScenes?: string[]
  linkedChapters?: string[]
}

export interface LocationInfo {
  file: string
  name: string
  id?: string
  type?: 'indoor' | 'outdoor' | 'virtual' | 'other'
  description?: string
  tags?: string[]
  linkedScenes?: string[]
  linkedCharacters?: string[]
}

export interface ProjectStats {
  chapters: number
  characters: number
  scenes: number
  locations: number
  knowledge: number
  audios: number
}

// --- Module-level singleton state ---
const chapters = ref<ChapterInfo[]>([])
const characters = ref<AdvCharacter[]>([])
const scenes = ref<SceneInfo[]>([])
const locations = ref<LocationInfo[]>([])
const audios = ref<AudioInfo[]>([])
const stats = ref<ProjectStats>({ chapters: 0, characters: 0, scenes: 0, locations: 0, knowledge: 0, audios: 0 })
const isLoading = ref(false)

// Closure variables for reload
let lastDirHandle: FileSystemDirectoryHandle | null = null
let lastCosConfig: { bucket: string, region: string, secretId: string, secretKey: string } | null = null
let lastCosPrefix: string | null = null

let watchInitialized = false

/**
 * Composable for loading project content (chapters, characters, scenes, knowledge).
 *
 * This is a shared singleton — all callers share the same reactive state.
 * An internal watch on `currentProject` automatically loads data on project switch.
 */
export function useProjectContent() {
  const knowledgeBase = useKnowledgeBase()

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
              src: parsed.src,
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

      // Load locations with frontmatter parsing
      const locationList: LocationInfo[] = []
      try {
        const locationFiles = await listFilesInDir(dirHandle, 'adv/locations', '.md')
        for (const file of locationFiles) {
          try {
            const content = await readFileFromDir(dirHandle, file)
            const parsed = parseLocationMd(content)
            locationList.push({
              file,
              name: parsed.name || file.split('/').pop()?.replace('.md', '') || file,
              id: parsed.id,
              type: parsed.type,
              description: parsed.description,
              tags: parsed.tags,
              linkedScenes: parsed.linkedScenes,
              linkedCharacters: parsed.linkedCharacters,
            })
          }
          catch {
            locationList.push({
              file,
              name: file.split('/').pop()?.replace('.md', '') || file,
            })
          }
        }
      }
      catch { /* no locations dir */ }
      locations.value = locationList

      // Load audio
      const audioList: AudioInfo[] = []
      try {
        // Load audio metadata files (.md)
        const audioMdFiles = await listFilesInDir(dirHandle, 'adv/audio', '.md')
        for (const file of audioMdFiles) {
          try {
            const content = await readFileFromDir(dirHandle, file)
            const parsed = parseAudioMd(content)
            audioList.push({
              file,
              name: parsed.name,
              description: parsed.description,
              src: parsed.src,
              duration: parsed.duration,
              tags: parsed.tags,
              linkedScenes: parsed.linkedScenes,
              linkedChapters: parsed.linkedChapters,
            })
          }
          catch {
            audioList.push({
              file,
              name: file.split('/').pop()?.replace('.md', '') || file,
            })
          }
        }

        // Also list raw audio files without metadata
        const audioFiles = await listFilesInDirByExts(dirHandle, 'adv/audio', AUDIO_EXTENSIONS)
        for (const file of audioFiles) {
          const baseName = file.split('/').pop()?.replace(FILE_EXT_RE, '') || ''
          // Skip if we already have metadata for this audio
          if (!audioList.some(a => a.name === baseName || a.src === file.split('/').pop())) {
            audioList.push({
              file,
              name: baseName,
              src: file,
            })
          }
        }
      }
      catch { /* no audio dir */ }
      audios.value = audioList

      // Load knowledge base + start watching for changes
      await knowledgeBase.loadFromDir(dirHandle)
      knowledgeBase.watchForChanges(dirHandle)

      // Update stats
      stats.value = {
        chapters: chapterInfos.length,
        characters: charList.length,
        scenes: sceneList.length,
        locations: locationList.length,
        knowledge: knowledgeBase.entries.value.length,
        audios: audioList.length,
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
      const sceneList: SceneInfo[] = []
      for (const file of sceneFiles) {
        try {
          const content = await downloadFromCloud(cosConfig, file)
          const parsed = parseSceneMd(content)
          sceneList.push({
            file,
            name: parsed.name || file.split('/').pop()?.replace('.md', '') || file,
            id: parsed.id,
            description: parsed.description,
            imagePrompt: parsed.imagePrompt,
            type: parsed.type,
            tags: parsed.tags,
            src: parsed.src,
          })
        }
        catch {
          sceneList.push({
            file,
            name: file.split('/').pop()?.replace('.md', '') || file,
          })
        }
      }
      scenes.value = sceneList

      // Locations
      const locationFiles = allFiles.filter(f => f.includes('/locations/') && f.endsWith('.md'))
      const locationList: LocationInfo[] = []
      for (const file of locationFiles) {
        try {
          const content = await downloadFromCloud(cosConfig, file)
          const parsed = parseLocationMd(content)
          locationList.push({
            file,
            name: parsed.name || file.split('/').pop()?.replace('.md', '') || file,
            id: parsed.id,
            type: parsed.type,
            description: parsed.description,
            tags: parsed.tags,
            linkedScenes: parsed.linkedScenes,
            linkedCharacters: parsed.linkedCharacters,
          })
        }
        catch {
          locationList.push({
            file,
            name: file.split('/').pop()?.replace('.md', '') || file,
          })
        }
      }
      locations.value = locationList

      // Audio
      const audioMdFiles = allFiles.filter(f => f.includes('/audio/') && f.endsWith('.md'))
      const audioMediaFiles = allFiles.filter(f => f.includes('/audio/') && AUDIO_EXTENSIONS.some(ext => f.toLowerCase().endsWith(ext)))
      const audioList: AudioInfo[] = []
      for (const file of audioMdFiles) {
        try {
          const content = await downloadFromCloud(cosConfig, file)
          const parsed = parseAudioMd(content)
          audioList.push({
            file,
            name: parsed.name,
            description: parsed.description,
            src: parsed.src,
            duration: parsed.duration,
            tags: parsed.tags,
            linkedScenes: parsed.linkedScenes,
            linkedChapters: parsed.linkedChapters,
          })
        }
        catch {
          audioList.push({
            file,
            name: file.split('/').pop()?.replace('.md', '') || file,
          })
        }
      }
      for (const file of audioMediaFiles) {
        const baseName = file.split('/').pop()?.replace(FILE_EXT_RE, '') || ''
        if (!audioList.some(a => a.name === baseName)) {
          audioList.push({ file, name: baseName, src: file })
        }
      }
      audios.value = audioList

      // Load knowledge base
      await knowledgeBase.loadFromCos(cosConfig, prefix)

      stats.value = {
        chapters: chapterInfos.length,
        characters: charList.length,
        scenes: sceneList.length,
        locations: locationList.length,
        knowledge: knowledgeBase.entries.value.length,
        audios: audioList.length,
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

  function $reset() {
    chapters.value = []
    characters.value = []
    scenes.value = []
    locations.value = []
    audios.value = []
    stats.value = { chapters: 0, characters: 0, scenes: 0, locations: 0, knowledge: 0, audios: 0 }
    isLoading.value = false
    lastDirHandle = null
    lastCosConfig = null
    lastCosPrefix = null
    knowledgeBase.$reset()
  }

  if (!watchInitialized) {
    watchInitialized = true
    const studioStore = useStudioStore()
    const settingsStore = useSettingsStore()

    watch(() => studioStore.currentProject, async (project) => {
      if (!project) {
        $reset()
        return
      }
      if (project.dirHandle) {
        await loadFromDir(project.dirHandle)
      }
      else if (project.source === 'cos' && project.cosPrefix) {
        await loadFromCos(settingsStore.cos, project.cosPrefix)
      }
    }, { immediate: true })
  }

  return {
    chapters,
    characters,
    scenes,
    locations,
    audios,
    stats,
    isLoading,
    knowledgeBase,
    loadFromDir,
    loadFromCos,
    reload,
    getDirHandle,
    $reset,
  }
}
