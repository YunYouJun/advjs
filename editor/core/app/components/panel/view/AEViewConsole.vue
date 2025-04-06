<script setup lang="ts">
import dayjs from 'dayjs'

const consoleStore = useConsoleStore()

const filteredLogList = computed(() => {
  const filterText = consoleStore.filterText.toLowerCase()
  return consoleStore.logList.filter((logItem) => {
    return (
      logItem.message.toLowerCase().includes(filterText)
      || (logItem.data && logItem.data.toString().toLowerCase().includes(filterText))
      || (logItem.stack && logItem.stack.toString().toLowerCase().includes(filterText))
    )
  })
})
</script>

<template>
  <div class="flex flex-col">
    <div class="flex items-center gap-1 p-0.5">
      <!-- clear -->
      <div>
        <div i-ri-delete-bin-5-line class="cursor-pointer text-white/50 hover:text-white" @click="consoleStore.clear" />
      </div>

      <AGUIInput
        v-model="consoleStore.filterText"
        type="text"
        placeholder="Filter logs..."
        class="w-full"
      />
    </div>

    <div class="flex flex-col">
      <div v-for="(logItem, i) in filteredLogList" :key="i" class="flex items-center gap-1 bg-dark-600 p-1 text-xs hover:bg-dark-500">
        <div v-if="logItem.type === 'error'" i-ri-error-warning-line class="text-red" />
        <div v-else-if="logItem.type === 'success'" i-ri-check-line class="text-green" />
        <div v-else-if="logItem.type === 'warn'" i-ri-alert-triangle-line class="text-yellow" />
        <div v-else-if="logItem.type === 'info'" i-ri-information-line class="text-blue" />
        <div v-else-if="logItem.type === 'debug'" i-ri-bug-line />

        <div class="log-time">
          <span v-if="logItem.time" class="text-white/50">[{{ dayjs(logItem.time).format('YYYY-MM-DD HH:mm:ss') }}]</span>
        </div>

        <span class="text-white/80">{{ logItem.message }}</span>

        <span v-if="logItem.data" class="text-xs text-white/50">{{ logItem.data }}</span>
        <span v-if="logItem.stack" class="text-xs text-gray-400">{{ logItem.stack }}</span>
      </div>
    </div>
  </div>
</template>
