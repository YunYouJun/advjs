import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed } from 'vue'
import { collectProjectContext } from '../workspaces/context'

export const useProjectContextStore = defineStore('@advjs/editor:project-context', () => {
  const projectStore = useProjectStore()
  // Derive from the workspace snapshot so late connections and saves cannot leave stale context.
  const context = computed(() => collectProjectContext(projectStore.project))
  const isLoaded = computed(() => Boolean(projectStore.project))

  /** Export saved author material, including character cards and chapter sources. */
  function getMergedContext(): string {
    return context.value.sections.map(section => `# ${section.title}\n\n${section.content}`).join('\n\n---\n\n')
  }

  return {
    worldContent: computed(() => context.value.worldContent),
    outlineContent: computed(() => context.value.outlineContent),
    glossaryContent: computed(() => context.value.glossaryContent),
    chaptersReadme: computed(() => context.value.chaptersReadme),
    charsReadme: computed(() => context.value.charsReadme),
    scenesReadme: computed(() => context.value.scenesReadme),
    stats: computed(() => context.value.stats),
    sections: computed(() => context.value.sections),
    isLoaded,
    getMergedContext,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useProjectContextStore, import.meta.hot))
