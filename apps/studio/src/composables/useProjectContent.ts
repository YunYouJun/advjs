import type { AdvAssetEntry, AdvCharacter } from '@advjs/types'
import type { IFileSystem } from '../utils/fs'
import {
  projectAudioEntry,
  projectChapterName,
  projectChapterPreview,
  projectFallbackEntry,
  projectLocationEntry,
  projectRawAudioEntries,
  projectSceneEntry,
} from '@advjs/core'
import { parseAudioMd, parseCharacterMd, parseLocationMd, parseSceneMd } from '@advjs/parser'
import { nextTick, ref, shallowRef, watch } from 'vue'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useStudioStore } from '../stores/useStudioStore'
import { downloadFromCloud, listCloudFiles } from '../utils/cloudSync'
import { AUDIO_EXTENSIONS, createFsForProject } from '../utils/fs'
import { observeStudioFileSystem, studioFileMutationRevision } from '../utils/fs/mutations'
import { loadStudioAssetCatalog } from '../utils/projectAssets'
import { discoverRuntimeChapterFiles } from '../utils/projectRuntimeFiles'
import { assertStudioProjectReady } from '../utils/projectWriteQueue'
import { useKnowledgeBase } from './useKnowledgeBase'

const FILE_EXT_RE = /\.[^.]+$/

export interface ChapterInfo {
  file: string
  name: string
  preview: string
  content?: string
  format?: 'flow' | 'adv-md'
}

export interface SceneInfo {
  file: string
  name: string
  id?: string
  description?: string
  imagePrompt?: string
  type?: 'image' | 'model'
  tags?: string[]
  assetId?: string
  src?: string
  linkedLocation?: string
}

export interface AudioInfo {
  /** Metadata file path (e.g. adv/audio/bgm.md) or audio file path */
  file: string
  name: string
  description?: string
  assetId?: string
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
  defaultImagePrompt?: string
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
const loadErrors = ref<string[]>([])

// Closure variables for reload
const lastFs = shallowRef<IFileSystem | null>(null)
let lastCosConfig: { bucket: string, region: string, secretId: string, secretKey: string } | null = null
let lastCosPrefix: string | null = null
let currentLoad: Promise<void> = Promise.resolve()

let watchInitialized = false
let loadGeneration = 0
let contentReadGeneration = 0

/**
 * Composable for loading project content (chapters, characters, scenes, knowledge).
 *
 * This is a shared singleton — all callers share the same reactive state.
 * An internal watch on `currentProject` automatically loads data on project switch.
 */
export function useProjectContent() {
  const knowledgeBase = useKnowledgeBase()

  function clearLoadedContent() {
    chapters.value = []
    characters.value = []
    scenes.value = []
    locations.value = []
    audios.value = []
    stats.value = { chapters: 0, characters: 0, scenes: 0, locations: 0, knowledge: 0, audios: 0 }
    knowledgeBase.$reset()
  }

  /**
   * Load project content from an IFileSystem instance
   */
  async function loadFromFs(fs: IFileSystem) {
    if (lastFs.value !== fs)
      clearLoadedContent()
    lastFs.value = observeStudioFileSystem(fs)
    const read = ++contentReadGeneration
    const generation = loadGeneration
    const revision = studioFileMutationRevision(fs)
    const ownsRead = () => read === contentReadGeneration && generation === loadGeneration && lastFs.value === fs
    const isCurrent = () => {
      if (!ownsRead() || revision !== studioFileMutationRevision(fs))
        return false
      try {
        assertStudioProjectReady(fs)
        return true
      }
      catch { return false }
    }
    lastCosConfig = null
    lastCosPrefix = null

    try {
      assertStudioProjectReady(fs)
    }
    catch (error) {
      // Recovery must remain reachable even if a config or entire content tree
      // was removed before the previous page stopped. Do not load partial facts.
      clearLoadedContent()
      loadErrors.value = [error instanceof Error ? error.message : String(error)]
      isLoading.value = false
      return
    }

    isLoading.value = true
    loadErrors.value = []
    try {
      // Load chapters
      const chapterFiles = await discoverRuntimeChapterFiles(fs)

      const chapterInfos: ChapterInfo[] = []
      for (const file of chapterFiles) {
        let preview = ''
        let content = ''
        try {
          content = await fs.readFile(file)
          if (!isCurrent())
            return
          preview = projectChapterPreview(file, content)
        }
        catch (err) {
          if (!isCurrent())
            return
          const msg = `Failed to read chapter ${file}: ${err instanceof Error ? err.message : String(err)}`
          console.warn(msg)
          loadErrors.value.push(msg)
        }

        chapterInfos.push({
          file,
          name: projectChapterName(file),
          preview,
          content,
          format: file.endsWith('.chapter.json') ? 'flow' : 'adv-md',
        })
      }

      // Load characters
      const charList: AdvCharacter[] = []
      try {
        const charFiles = await fs.listFiles('adv/characters', '.character.md')
        for (const file of charFiles) {
          try {
            const content = await fs.readFile(file)
            if (!isCurrent())
              return
            const character = parseCharacterMd(content)
            charList.push(character)
          }
          catch (err) {
            if (!isCurrent())
              return
            const msg = `Failed to parse character ${file}: ${err instanceof Error ? err.message : String(err)}`
            console.warn(msg)
            loadErrors.value.push(msg)
          }
        }
      }
      catch { /* no characters dir */ }

      // Load scenes with frontmatter parsing
      const sceneList: SceneInfo[] = []
      try {
        const sceneFiles = await fs.listFiles('adv/scenes', '.md')
        for (const file of sceneFiles) {
          try {
            sceneList.push(projectSceneEntry(file, await fs.readFile(file)))
          }
          catch (err) {
            if (!isCurrent())
              return
            console.warn(`Failed to parse scene ${file}: ${err instanceof Error ? err.message : String(err)}`)
            // Fallback: just use file name
            sceneList.push(projectFallbackEntry(file))
          }
        }
      }
      catch { /* no scenes dir */ }

      // Load locations with frontmatter parsing
      const locationList: LocationInfo[] = []
      try {
        const locationFiles = await fs.listFiles('adv/locations', '.md')
        for (const file of locationFiles) {
          try {
            locationList.push(projectLocationEntry(file, await fs.readFile(file)))
          }
          catch (err) {
            if (!isCurrent())
              return
            console.warn(`Failed to parse location ${file}: ${err instanceof Error ? err.message : String(err)}`)
            locationList.push(projectFallbackEntry(file))
          }
        }
      }
      catch { /* no locations dir */ }

      // Load audio
      const audioList: AudioInfo[] = []
      try {
        // Load audio metadata files (.md)
        const audioMdFiles = await fs.listFiles('adv/audio', '.md')
        for (const file of audioMdFiles) {
          try {
            audioList.push(projectAudioEntry(file, await fs.readFile(file)))
          }
          catch (err) {
            if (!isCurrent())
              return
            console.warn(`Failed to parse audio ${file}: ${err instanceof Error ? err.message : String(err)}`)
            audioList.push(projectFallbackEntry(file))
          }
        }

        // Also list raw audio files without metadata
        const audioFiles = await fs.listFilesByExts('adv/audio', AUDIO_EXTENSIONS)
        audioList.push(...projectRawAudioEntries(audioFiles, audioList))
      }
      catch { /* no audio dir */ }
      if (await fs.exists('adv/assets.json')) {
        const catalog = await loadStudioAssetCatalog(fs)
        audioList.splice(0, audioList.length, ...(catalog?.list({ type: 'audio' }) ?? []).map(asset => ({
          file: `adv/assets.json#${asset.id}`,
          name: asset.title || asset.id,
          assetId: asset.id,
          duration: asset.duration,
          tags: asset.labels,
        })))
        catalog?.dispose()
      }

      // Load knowledge base + start watching for changes
      if (!isCurrent())
        return
      await knowledgeBase.loadFromFs(fs, isCurrent)
      if (!isCurrent())
        return
      chapters.value = chapterInfos
      characters.value = charList
      scenes.value = sceneList
      locations.value = locationList
      audios.value = audioList

      knowledgeBase.watchForChangesFs(fs)

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
      if (ownsRead())
        isLoading.value = false
    }
  }

  /**
   * Load project content from COS cloud storage
   */
  async function loadFromCos(cosConfig: { bucket: string, region: string, secretId: string, secretKey: string }, prefix: string) {
    lastCosConfig = cosConfig
    lastCosPrefix = prefix
    lastFs.value = null

    isLoading.value = true
    loadErrors.value = []
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
        catch (err) {
          const msg = `Failed to read chapter ${file}: ${err instanceof Error ? err.message : String(err)}`
          console.warn(msg)
          loadErrors.value.push(msg)
        }

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
        catch (err) {
          const msg = `Failed to parse character ${file}: ${err instanceof Error ? err.message : String(err)}`
          console.warn(msg)
          loadErrors.value.push(msg)
        }
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
            assetId: parsed.assetId,
            src: parsed.src,
            linkedLocation: parsed.linkedLocation,
          })
        }
        catch (err) {
          const msg = `Failed to parse scene ${file}: ${err instanceof Error ? err.message : String(err)}`
          console.warn(msg)
          loadErrors.value.push(msg)
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
            defaultImagePrompt: parsed.defaultImagePrompt,
          })
        }
        catch (err) {
          const msg = `Failed to parse location ${file}: ${err instanceof Error ? err.message : String(err)}`
          console.warn(msg)
          loadErrors.value.push(msg)
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
            assetId: parsed.assetId,
            src: parsed.src,
            duration: parsed.duration,
            tags: parsed.tags,
            linkedScenes: parsed.linkedScenes,
            linkedChapters: parsed.linkedChapters,
          })
        }
        catch (err) {
          console.warn(`Failed to parse audio ${file}: ${err instanceof Error ? err.message : String(err)}`)
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
    if (lastFs.value) {
      await loadFromFs(lastFs.value)
    }
    else if (lastCosConfig && lastCosPrefix) {
      await loadFromCos(lastCosConfig, lastCosPrefix)
    }
  }

  /**
   * Get the current IFileSystem instance (for file saving / reading)
   */
  function getFs(): IFileSystem | null {
    return lastFs.value
  }

  /** Read-only view of the canonical catalog for overview counts and previews. */
  function applyAudioCatalogAssets(assets: AdvAssetEntry[]) {
    audios.value = assets.filter(asset => asset.type === 'audio').map(asset => ({ file: `adv/assets.json#${asset.id}`, name: asset.title || asset.id, assetId: asset.id, duration: asset.duration, tags: asset.labels }))
    stats.value = { ...stats.value, audios: audios.value.length }
  }

  async function whenReady(): Promise<void> {
    // A project switch queues its loader watcher. Await that queue before
    // capturing currentLoad, otherwise callers can observe the previous FS.
    await nextTick()
    await currentLoad
  }

  function $reset() {
    clearLoadedContent()
    isLoading.value = false
    loadErrors.value = []
    lastFs.value = null
    lastCosConfig = null
    lastCosPrefix = null
  }

  if (!watchInitialized) {
    watchInitialized = true
    const studioStore = useStudioStore()
    const settingsStore = useSettingsStore()

    watch(() => studioStore.currentProject, (project) => {
      const generation = ++loadGeneration
      currentLoad = (async () => {
        if (!project) {
          $reset()
          return
        }
        if (project.source === 'cos' && project.cosPrefix) {
          await loadFromCos(settingsStore.cos, project.cosPrefix)
        }
        else {
          // Local (dirHandle), memory, or capacitor FS
          const fs = await createFsForProject({
            dirHandle: project.dirHandle,
            projectId: project.projectId || project.name,
            source: project.source,
          })
          if (generation !== loadGeneration)
            return
          await loadFromFs(fs)
        }
      })()
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
    loadErrors,
    knowledgeBase,
    loadFromFs,
    loadFromCos,
    reload,
    getFs,
    applyAudioCatalogAssets,
    whenReady,
    $reset,
  }
}
