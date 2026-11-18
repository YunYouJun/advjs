import type { CreativeArtifact, CreativeMilestoneMerge } from '@advjs/agent'
import type { Ref } from 'vue'
import { creativeMilestoneConflicts } from '@advjs/agent'
import { computed, shallowRef, watch } from 'vue'

/** Local author drafts only; changing the exact input versions discards their resolutions. */
export function useCreativeMilestoneMerge(artifacts: Ref<readonly CreativeArtifact[]>) {
  const drafts = shallowRef<Record<string, { after: string | null, confirmed: boolean }>>({})
  const conflicts = computed(() => creativeMilestoneConflicts(artifacts.value))
  watch(() => JSON.stringify(artifacts.value.map(item => [item.id, item.fingerprint])), () => drafts.value = {}, { flush: 'sync' })
  const complete = computed(() => conflicts.value.every(item => item.editable && drafts.value[item.path]?.confirmed))
  const resolutions = computed<CreativeMilestoneMerge[]>(() => conflicts.value.filter(item => drafts.value[item.path]?.confirmed).map(item => ({ path: item.path, after: drafts.value[item.path]!.after })))
  function update(path: string, after: string | null, confirmed = false) {
    drafts.value = { ...drafts.value, [path]: { after, confirmed } }
  }
  return { conflicts, drafts: computed(() => drafts.value), complete, resolutions, update }
}
