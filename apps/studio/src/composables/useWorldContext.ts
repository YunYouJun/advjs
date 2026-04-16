import type { IFileSystem } from '../utils/fs'
import { ref, watch } from 'vue'
import i18n from '../i18n'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useStudioStore } from '../stores/useStudioStore'
import { downloadFromCloud } from '../utils/cloudSync'
import { createFsForProject } from '../utils/fs'

// --- Module-level singleton state ---
const worldContext = ref('')
const isLoading = ref(false)
let watchInitialized = false

/**
 * Load world context (world.md + glossary.md) for character chat system prompts.
 *
 * This is a shared singleton — all callers share the same reactive state.
 * An internal watch on `currentProject` automatically loads data on project switch.
 */
export function useWorldContext() {
  async function loadFromFs(fs: IFileSystem) {
    isLoading.value = true
    try {
      const parts: string[] = []

      const reads = await Promise.allSettled([
        fs.readFile('adv/world.md'),
        fs.readFile('adv/glossary.md'),
      ])

      const [world, glossary] = reads.map(
        r => r.status === 'fulfilled' ? r.value : '',
      )

      if (world)
        parts.push(`${i18n.global.t('systemPrompt.worldContext.worldviewHeader')}\n${world}`)
      if (glossary)
        parts.push(`${i18n.global.t('systemPrompt.worldContext.glossaryHeader')}\n${glossary}`)

      worldContext.value = parts.join('\n\n')
    }
    catch {
      worldContext.value = ''
    }
    finally {
      isLoading.value = false
    }
  }

  async function loadFromDir(dirHandle: FileSystemDirectoryHandle) {
    const { BrowserFsAdapter } = await import('../utils/fs/BrowserFsAdapter')
    await loadFromFs(new BrowserFsAdapter(dirHandle))
  }

  async function loadFromCos(
    cosConfig: { bucket: string, region: string, secretId: string, secretKey: string },
    prefix: string,
  ) {
    isLoading.value = true
    try {
      const parts: string[] = []

      const reads = await Promise.allSettled([
        downloadFromCloud(cosConfig, `${prefix}adv/world.md`),
        downloadFromCloud(cosConfig, `${prefix}adv/glossary.md`),
      ])

      const [world, glossary] = reads.map(
        r => r.status === 'fulfilled' ? r.value : '',
      )

      if (world)
        parts.push(`${i18n.global.t('systemPrompt.worldContext.worldviewHeader')}\n${world}`)
      if (glossary)
        parts.push(`${i18n.global.t('systemPrompt.worldContext.glossaryHeader')}\n${glossary}`)

      worldContext.value = parts.join('\n\n')
    }
    catch {
      worldContext.value = ''
    }
    finally {
      isLoading.value = false
    }
  }

  function $reset() {
    worldContext.value = ''
    isLoading.value = false
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
        const fs = await createFsForProject(project as any)
        await loadFromFs(fs)
      }
      else if (project.source === 'cos' && project.cosPrefix) {
        await loadFromCos(settingsStore.cos, project.cosPrefix)
      }
      else {
        const fs = await createFsForProject({ projectId: project.projectId || project.name, source: project.source })
        await loadFromFs(fs)
      }
    }, { immediate: true })
  }

  return {
    worldContext,
    isLoading,
    loadFromFs,
    loadFromDir,
    loadFromCos,
    $reset,
  }
}
