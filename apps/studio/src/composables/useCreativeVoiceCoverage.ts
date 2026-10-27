import type { CreativeVoiceCoverage } from '../utils/creativeVoiceCoverage'
import type { CreativeArtImportHost } from './useCreativeArtImport'
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue'
import { readCreativeVoiceCoverage } from '../utils/creativeVoiceCoverage'

export function useCreativeVoiceCoverage(options: { scope: () => string, projectId: () => string, host: () => Promise<CreativeArtImportHost> }) {
  const result = shallowRef<CreativeVoiceCoverage>()
  const loading = shallowRef(false)
  const error = shallowRef(false)
  const filter = shallowRef('issues')
  const query = shallowRef('')
  const rows = computed(() => result.value?.rows.filter(row => (filter.value === 'all' || (filter.value === 'issues' ? row.status !== 'ready' : row.status === filter.value))
    && (!query.value.trim() || [row.speakerId, row.text, row.path, row.lineId, row.address].some(value => value?.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase())))) ?? [])
  const issues = computed(() => result.value?.rows.filter(row => row.status !== 'ready').length ?? 0)
  let epoch = 0
  watch(options.scope, () => {
    epoch++
    result.value = undefined
    loading.value = false
    error.value = false
  })
  onBeforeUnmount(() => epoch++)
  async function load() {
    const turn = ++epoch
    const scope = options.scope()
    loading.value = true
    error.value = false
    result.value = undefined
    try {
      const host = await options.host()
      const value = await readCreativeVoiceCoverage(host.fs, options.projectId(), () => {
        host.assertCurrent()
        if (turn !== epoch || options.scope() !== scope)
          throw new Error('CREATIVE_VOICE_SCOPE_CHANGED')
      })
      if (turn === epoch)
        result.value = value
    }
    catch {
      if (turn === epoch)
        error.value = true
    }
    finally {
      if (turn === epoch)
        loading.value = false
    }
  }
  return { result, loading, error, filter, query, rows, issues, load }
}
