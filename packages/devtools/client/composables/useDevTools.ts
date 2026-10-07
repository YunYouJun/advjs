import type { DevframeRpcClient } from 'devframe/client'
import type { JsonHighlightToken } from '../../../shared/json-highlight'
import type { DevToolsReport } from '../../src/types'
import { getDevframeRpcClient } from 'devframe/client'
import { onMounted, onUnmounted, shallowRef } from 'vue'
import { canHighlightJson } from '../../../shared/json-highlight'

export function useDevTools() {
  const report = shallowRef<DevToolsReport>()
  const error = shallowRef('')
  const connected = shallowRef(false)
  let rpc: DevframeRpcClient | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let disposed = false
  const highlights = new Map<string, Promise<JsonHighlightToken[] | undefined>>()
  function highlightJson(code: string) {
    if (!rpc || !connected.value || !canHighlightJson(code))
      return Promise.resolve(undefined)
    const cached = highlights.get(code)
    if (cached) {
      highlights.delete(code)
      highlights.set(code, cached)
      return cached
    }
    const result = rpc.call('advjs-devtools:highlight-json', code).catch(() => undefined)
    highlights.set(code, result)
    if (highlights.size > 128)
      highlights.delete(highlights.keys().next().value!)
    void result.then((tokens) => {
      if (!tokens && highlights.get(code) === result)
        highlights.delete(code)
    })
    return result
  }
  const poll = async () => {
    try {
      report.value = await rpc!.call('advjs-devtools:inspect') as DevToolsReport
      connected.value = true
      error.value = ''
    }
    catch (cause) {
      connected.value = false
      error.value = cause instanceof Error ? cause.message : String(cause)
    }
    finally {
      if (!disposed)
        timer = setTimeout(poll, 750)
    }
  }
  const connect = async () => {
    clearTimeout(timer)
    rpc?.close?.()
    connected.value = false
    highlights.clear()
    error.value = ''
    try {
      const next = await getDevframeRpcClient({
        baseURL: new URL('.', location.href).href,
        cacheOptions: false,
        simpleAuth: false,
        webmcp: false,
        callTimeout: 3000,
      })
      if (disposed) {
        next.close?.()
        return
      }
      rpc = next
      await poll()
    }
    catch (cause) {
      connected.value = false
      error.value = cause instanceof Error ? cause.message : String(cause)
    }
  }
  onMounted(connect)
  onUnmounted(() => {
    disposed = true
    clearTimeout(timer)
    rpc?.close?.()
    highlights.clear()
  })
  return { report, error, connected, connect, highlightJson }
}
