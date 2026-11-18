import type { CreativeTeamRun } from '@advjs/agent'
import type { CreativeArtCoverage } from '../utils/creativeArtCoverage'
import type { CreativeArtImportHost } from './useCreativeArtImport'
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import { readCreativeArtCoverage } from '../utils/creativeArtCoverage'
import { subscribeStudioFileMutations } from '../utils/fs/mutations'

/** An inspection is invalidated by project writes, run changes or returning to the window. */
export function useCreativeArtCoverage(options: { scope: () => string, run: () => CreativeTeamRun, host: () => Promise<CreativeArtImportHost> }) {
  const result = shallowRef<CreativeArtCoverage>()
  const loading = shallowRef(false)
  const error = shallowRef(false)
  const issues = computed(() => result.value?.rows.filter(row => row.status !== 'ready').length ?? 0)
  let epoch = 0
  let unsubscribe: (() => void) | undefined
  function invalidate() {
    epoch++
    unsubscribe?.()
    unsubscribe = undefined
    result.value = undefined
    loading.value = false
    error.value = false
  }
  watch(options.scope, invalidate, { flush: 'sync' })
  const resume = () => {
    if (document.visibilityState !== 'hidden')
      invalidate()
  }
  onMounted(() => {
    window.addEventListener('focus', resume)
    window.addEventListener('pageshow', resume)
    document.addEventListener('visibilitychange', resume)
  })
  onBeforeUnmount(() => {
    invalidate()
    window.removeEventListener('focus', resume)
    window.removeEventListener('pageshow', resume)
    document.removeEventListener('visibilitychange', resume)
  })
  async function load() {
    invalidate()
    const turn = epoch
    const scope = options.scope()
    const run = options.run()
    loading.value = true
    try {
      const host = await options.host()
      const check = () => {
        host.assertCurrent()
        if (turn !== epoch || scope !== options.scope())
          throw new Error('CREATIVE_ART_SCOPE_CHANGED')
      }
      check()
      unsubscribe = subscribeStudioFileMutations(host.fs, invalidate)
      const value = await readCreativeArtCoverage(host.fs, run, check)
      check()
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
  return { result, loading, error, issues, load }
}
