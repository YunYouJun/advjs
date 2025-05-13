export interface LogItem {
  type: 'success' | 'warn' | 'error' | 'info' | 'debug'
  message: string
  time: number
  stack?: string
  data?: any
}

/**
 * for runtime
 */
export const useConsoleStore = defineStore('@advjs/editor/console', () => {
  const logList = ref<LogItem[]>([])
  const filterText = ref<string>('')
  const filterType = ref<LogItem['type'] | 'all'>('all')

  const log = (type: LogItem['type'], message: string, data?: any) => {
    const logItem: LogItem = {
      type,
      message,
      time: Date.now(),
      data,
    }
    logList.value = [...(logList.value || []), logItem]
  }
  const success = (message: string, data?: any) => {
    log('success', message, data)
  }
  const info = (message: string, data?: any) => {
    log('info', message, data)
  }
  const warn = (message: string, data?: any) => {
    log('warn', message, data)
  }
  const error = (message: string, data?: any) => {
    log('error', message, data)
  }
  const debug = (message: string, data?: any) => {
    log('debug', message, data)
  }

  const clear = () => {
    logList.value = []
  }
  const getLogList = () => {
    return logList.value || []
  }
  const getLogListByType = (type: LogItem['type']) => {
    return logList.value?.filter(item => item.type === type) || []
  }
  const getLogListByTime = (start: number, end: number) => {
    return logList.value?.filter(item => item.time >= start && item.time <= end) || []
  }

  return {
    logList,
    filterText,
    filterType,

    log,

    success,
    info,
    warn,
    error,
    debug,

    clear,
    getLogList,
    getLogListByType,
    getLogListByTime,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useConsoleStore, import.meta.hot))
