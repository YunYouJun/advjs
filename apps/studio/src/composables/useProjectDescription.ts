import type { IFileSystem } from '../utils/fs'
import { ref, watch } from 'vue'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useStudioStore } from '../stores/useStudioStore'
import { downloadFromCloud } from '../utils/cloudSync'
import { createFsForProject } from '../utils/fs'

// --- Module-level singleton state ---
const worldMd = ref('')
const outlineMd = ref('')
const glossaryMd = ref('')
const propsMd = ref('')
const writingStyleMd = ref('')
const isLoading = ref(false)
let watchInitialized = false

const TITLE_RE = /^#[ \t]+(\S[^\n]*)$/m
const SECTION_RE = /^##[ \t]+(\S[^\n]*)$/gm

/**
 * Extract title from markdown (first # heading) or return empty string.
 */
function extractTitle(md: string): string {
  const match = md.match(TITLE_RE)
  return match ? match[1].trim() : ''
}

/**
 * Extract the first N characters of meaningful content (skip headings / frontmatter).
 */
function extractPreview(md: string, maxLength = 200): string {
  const lines = md.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('---') && !l.startsWith('>'))
  const text = lines.join(' ').trim()
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text
}

/**
 * Extract ## headings as a list of section titles.
 */
function extractSections(md: string): string[] {
  return Array.from(md.matchAll(SECTION_RE), m => m[1].trim())
}

/**
 * Composable for loading project description files (world.md, outline.md, glossary.md, props.md, writing-style.md).
 *
 * Shared singleton — all callers share the same reactive state.
 */
export function useProjectDescription() {
  async function loadFromFs(fs: IFileSystem) {
    isLoading.value = true
    try {
      const reads = await Promise.allSettled([
        fs.readFile('adv/world.md'),
        fs.readFile('adv/outline.md'),
        fs.readFile('adv/glossary.md'),
        fs.readFile('adv/props.md'),
        fs.readFile('adv/writing-style.md'),
      ])

      worldMd.value = reads[0].status === 'fulfilled' ? reads[0].value : ''
      outlineMd.value = reads[1].status === 'fulfilled' ? reads[1].value : ''
      glossaryMd.value = reads[2].status === 'fulfilled' ? reads[2].value : ''
      propsMd.value = reads[3].status === 'fulfilled' ? reads[3].value : ''
      writingStyleMd.value = reads[4].status === 'fulfilled' ? reads[4].value : ''
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
      const reads = await Promise.allSettled([
        downloadFromCloud(cosConfig, `${prefix}adv/world.md`),
        downloadFromCloud(cosConfig, `${prefix}adv/outline.md`),
        downloadFromCloud(cosConfig, `${prefix}adv/glossary.md`),
        downloadFromCloud(cosConfig, `${prefix}adv/props.md`),
        downloadFromCloud(cosConfig, `${prefix}adv/writing-style.md`),
      ])

      worldMd.value = reads[0].status === 'fulfilled' ? reads[0].value : ''
      outlineMd.value = reads[1].status === 'fulfilled' ? reads[1].value : ''
      glossaryMd.value = reads[2].status === 'fulfilled' ? reads[2].value : ''
      propsMd.value = reads[3].status === 'fulfilled' ? reads[3].value : ''
      writingStyleMd.value = reads[4].status === 'fulfilled' ? reads[4].value : ''
    }
    finally {
      isLoading.value = false
    }
  }

  function $reset() {
    worldMd.value = ''
    outlineMd.value = ''
    glossaryMd.value = ''
    propsMd.value = ''
    writingStyleMd.value = ''
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
      if (project.source === 'cos' && project.cosPrefix) {
        await loadFromCos(settingsStore.cos, project.cosPrefix)
      }
      else {
        const fs = await createFsForProject({
          dirHandle: project.dirHandle,
          projectId: project.projectId || project.name,
          source: project.source,
        })
        await loadFromFs(fs)
      }
    }, { immediate: true })
  }

  return {
    worldMd,
    outlineMd,
    glossaryMd,
    propsMd,
    writingStyleMd,
    isLoading,
    extractTitle,
    extractPreview,
    extractSections,
    loadFromFs,
    loadFromCos,
    $reset,
  }
}
