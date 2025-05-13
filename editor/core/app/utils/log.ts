import { consola, LogLevels } from 'consola'

/**
 * 代理日志
 */
export function proxyLog() {
  const consoleStore = useConsoleStore()

  /**
   * debug
   */
  consola.level = LogLevels.debug

  const oldConsolaInfo = consola.info
  const oldConsolaDebug = consola.debug
  // @ts-expect-error override old consola
  consola.info = (...args: any[]) => {
  // @ts-expect-error override old consola
    oldConsolaInfo(...args)
    consoleStore.info(args[0], ...args.slice(1))
  }
  // @ts-expect-error override old consola
  consola.debug = (...args: any[]) => {
  // @ts-expect-error override old consola
    oldConsolaDebug(...args)
    consoleStore.debug(args[0], ...args.slice(1))
  }
}
