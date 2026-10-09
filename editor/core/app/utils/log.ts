import type { ConsolaReporter } from 'consola'
import { consola, LogLevels } from 'consola'
import { onScopeDispose } from 'vue'

let subscribers = 0
let previousLevel = consola.level

/**
 * Forward preview logs for the lifetime of the view without wrapping global methods.
 */
export function proxyLog() {
  const consoleStore = useConsoleStore()

  if (subscribers++ === 0) {
    previousLevel = consola.level
    consola.level = LogLevels.debug
  }
  const reporter: ConsolaReporter = {
    log({ type, args }) {
      if (type === 'info' || type === 'debug')
        consoleStore[type](String(args[0] ?? ''), args[1])
    },
  }
  consola.addReporter(reporter)
  onScopeDispose(() => {
    consola.removeReporter(reporter)
    if (--subscribers === 0 && consola.level === LogLevels.debug)
      consola.level = previousLevel
  })
}
