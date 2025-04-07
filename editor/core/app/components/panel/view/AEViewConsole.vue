<script setup lang="ts">
import { AGUISelect } from '@advjs/gui'
import dayjs from 'dayjs'

const consoleStore = useConsoleStore()

const filteredLogList = computed(() => {
  const filterText = consoleStore.filterText.toLowerCase()
  return consoleStore.logList.filter((logItem) => {
    return (
      ['all', logItem.type].includes(consoleStore.filterType)
      && (
        logItem.message.toLowerCase().includes(filterText)
        || (logItem.data && logItem.data.toString().toLowerCase().includes(filterText))
        || (logItem.stack && logItem.stack.toString().toLowerCase().includes(filterText))
      )
    )
  }).reverse()
})

const logTypes = [
  { type: 'success', icon: 'i-ri-check-line', color: 'text-green' },
  { type: 'error', icon: 'i-ri-error-warning-line', color: 'text-red' },
  { type: 'warn', icon: 'i-ri:alert-line', color: 'text-yellow' },
  { type: 'info', icon: 'i-ri-information-line', color: 'text-blue' },
  { type: 'debug', icon: 'i-ri-bug-line', color: '' },
]

const logTypeOptions: {
  label: string
  value: string
  icon?: string
}[] = [
  { label: 'All', value: 'all' },
  { label: 'Error', value: 'error' },
  { label: 'Success', value: 'success' },
  { label: 'Warn', value: 'warn' },
  { label: 'Info', value: 'info' },
  { label: 'Debug', value: 'debug' },
]

logTypeOptions.forEach((option) => {
  option.icon = logTypes.find(logType => logType.type === option.value)?.icon
})
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex items-center gap-1 p-0.5">
      <!-- clear -->
      <div>
        <div i-ri-delete-bin-5-line class="cursor-pointer text-white/50 hover:text-white" @click="consoleStore.clear" />
      </div>

      <div class="w-25">
        <AGUISelect
          v-model="consoleStore.filterType"
          :options="logTypeOptions"
        />
      </div>

      <AGUIInput
        v-model="consoleStore.filterText"
        type="text"
        placeholder="Filter logs..."
        class="w-full"
      />
    </div>

    <!-- reverse -->
    <div class="flex flex-col overflow-auto">
      <div v-for="(logItem, i) in filteredLogList" :key="i" class="flex items-start gap-1 bg-dark-600 p-1 text-xs hover:bg-dark-500">
        <template v-for="logType in logTypes" :key="logType.type">
          <div v-if="logItem.type === logType.type" :class="logType.color">
            <div :class="logType.icon" />
          </div>
        </template>

        <div v-if="logItem.time" class="log-time flex whitespace-nowrap break-keep text-white/60">
          [{{ dayjs(logItem.time).format('YYYY-MM-DD HH:mm:ss') }}]
        </div>

        <span class="text-white/80">{{ logItem.message }}</span>

        <span v-if="logItem.data" class="text-xs text-white/50">{{ logItem.data }}</span>
        <span v-if="logItem.stack" class="text-xs text-gray-400">{{ logItem.stack }}</span>
      </div>
    </div>
  </div>
</template>
