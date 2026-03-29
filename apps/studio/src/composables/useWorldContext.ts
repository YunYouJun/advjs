import { ref } from 'vue'
import { downloadFromCloud } from '../utils/cloudSync'
import { readFileFromDir } from '../utils/fileAccess'

/**
 * Load world context (world.md + glossary.md) for character chat system prompts.
 */
export function useWorldContext() {
  const worldContext = ref('')
  const isLoading = ref(false)

  async function loadFromDir(dirHandle: FileSystemDirectoryHandle) {
    isLoading.value = true
    try {
      const parts: string[] = []

      const reads = await Promise.allSettled([
        readFileFromDir(dirHandle, 'adv/world.md'),
        readFileFromDir(dirHandle, 'adv/glossary.md'),
      ])

      const [world, glossary] = reads.map(
        r => r.status === 'fulfilled' ? r.value : '',
      )

      if (world)
        parts.push(`## 世界观\n${world}`)
      if (glossary)
        parts.push(`## 术语表\n${glossary}`)

      worldContext.value = parts.join('\n\n')
    }
    catch {
      worldContext.value = ''
    }
    finally {
      isLoading.value = false
    }
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
        parts.push(`## 世界观\n${world}`)
      if (glossary)
        parts.push(`## 术语表\n${glossary}`)

      worldContext.value = parts.join('\n\n')
    }
    catch {
      worldContext.value = ''
    }
    finally {
      isLoading.value = false
    }
  }

  return {
    worldContext,
    isLoading,
    loadFromDir,
    loadFromCos,
  }
}
