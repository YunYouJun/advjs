import type { AdvCharacterVisualReference } from '@advjs/types'
import type { ProjectWorkspace } from '../workspaces/project'
import { computed, shallowRef, watch } from 'vue'

interface ReferencePreview extends AdvCharacterVisualReference {
  src?: string
  error?: string
}

/** Own reference image URLs independently of the game's scene preview lifecycle. */
export function useCharacterVisualReferences(
  references: () => readonly AdvCharacterVisualReference[],
  workspace: () => ProjectWorkspace | undefined,
) {
  const previews = shallowRef<ReferencePreview[]>([])
  const source = computed(() => ({ references: references(), workspace: workspace() }))

  watch(source, async ({ references, workspace }, _, onCleanup) => {
    let active = true
    const urls: string[] = []
    onCleanup(() => {
      active = false
      urls.forEach(url => URL.revokeObjectURL(url))
    })
    previews.value = references.map(reference => ({ ...reference }))
    const result = await Promise.all(references.map(async (reference): Promise<ReferencePreview> => {
      try {
        if (/^(?:https?:|blob:|data:)/u.test(reference.path))
          return { ...reference, src: reference.path }
        if (!workspace?.readAsset)
          throw new Error('Open the project to preview its reference images.')
        const blob = await workspace.readAsset(reference.path)
        if (!active)
          return reference
        const src = URL.createObjectURL(blob)
        urls.push(src)
        return { ...reference, src }
      }
      catch (error) {
        return { ...reference, error: error instanceof Error ? error.message : String(error) }
      }
    }))
    if (active)
      previews.value = result
  }, { immediate: true })

  return { previews }
}
