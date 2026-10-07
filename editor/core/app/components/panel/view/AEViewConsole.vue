<script setup lang="ts">
import { AGUIIconButton, AGUIInput, AGUISelect, AGUIToolbar } from '@advjs/gui'
import dayjs from 'dayjs'
import { describeReportValue } from '../../../../../../apps/desktop/src/error-report'
import AECopyErrorButton from '../../error/AECopyErrorButton.vue'
import AEConsoleLogData from './AEConsoleLogData.vue'

const consoleStore = useConsoleStore()
const { locale } = useI18n()
const zh = computed(() => locale.value === 'zh-CN')

const filteredLogList = computed(() => {
  const filterText = consoleStore.filterText.toLowerCase()
  return consoleStore.logList.filter((logItem) => {
    return (
      ['all', logItem.type].includes(consoleStore.filterType)
      && (
        logItem.message.toLowerCase().includes(filterText)
        || (logItem.data !== undefined && describeReportValue(logItem.data).toLowerCase().includes(filterText))
        || (logItem.stack && logItem.stack.toString().toLowerCase().includes(filterText))
      )
    )
  }).reverse()
})

const logTypes = [
  { type: 'success', icon: 'i-ri-check-line', color: 'console-success' },
  { type: 'error', icon: 'i-ri-error-warning-line', color: 'console-error' },
  { type: 'warn', icon: 'i-ri:alert-line', color: 'console-warning' },
  { type: 'info', icon: 'i-ri-information-line', color: '' },
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
  <div class="editor-console">
    <AGUIToolbar :items="[]" :wrap="false" :label="zh ? '控制台操作' : 'Console actions'" class="console-toolbar">
      <template #before-toolbar>
        <AGUIIconButton icon="i-ri-delete-bin-5-line" :title="zh ? '清空日志' : 'Clear logs'" @click="consoleStore.clear" />
        <div class="console-filter-type">
          <AGUISelect
            v-model="consoleStore.filterType"
            :options="logTypeOptions"
            :label="zh ? '日志类型' : 'Log type'"
          />
        </div>
        <div class="console-filter-text">
          <AGUIInput v-model="consoleStore.filterText" type="text" :aria-label="zh ? '筛选日志' : 'Filter logs'" :placeholder="zh ? '筛选日志…' : 'Filter logs...'" />
        </div>
      </template>
      <template #after-toolbar>
        <AECopyErrorButton
          compact source="Editor console" :logs="filteredLogList.toReversed()"
          :label="zh ? '复制日志给 AI' : 'Copy logs for AI'"
          :copied-label="zh ? '当前日志已复制，可粘贴给 AI' : 'Visible logs copied — paste into AI'"
          :disabled="!filteredLogList.length"
        />
      </template>
    </AGUIToolbar>

    <div class="console-logs">
      <div v-for="(logItem, i) in filteredLogList" :key="i" class="console-log">
        <template v-for="logType in logTypes" :key="logType.type">
          <div v-if="logItem.type === logType.type" class="console-log-icon" :class="logType.color">
            <div :class="logType.icon" />
          </div>
        </template>

        <div class="console-log-content">
          <div class="console-log-summary">
            <span v-if="logItem.time" class="log-time">[{{ dayjs(logItem.time).format('YYYY-MM-DD HH:mm:ss') }}]</span>
            <span>{{ logItem.message }}</span>
          </div>
          <AEConsoleLogData v-if="logItem.data !== undefined" :data="logItem.data" />
          <pre v-if="logItem.stack" class="console-log-details">{{ logItem.stack }}</pre>
        </div>
        <AECopyErrorButton
          v-if="logItem.type === 'error'" compact source="Editor console"
          :error="logItem.message" :details="logItem.data" :logs="[logItem]"
          :copied-label="zh ? '这条错误已复制，可粘贴给 AI' : 'Error details copied — paste into AI'"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-console {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  color: var(--agui-c-text-1);
  background: var(--agui-c-bg-panel);
}
.console-filter-type {
  min-width: 0;
}
.console-filter-text {
  min-width: 0;
}
.console-toolbar {
  display: grid;
  grid-template-columns: 24px minmax(80px, 100px) minmax(48px, 1fr) 24px;
  overflow: hidden;
  scrollbar-gutter: stable;
}
.console-logs {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  scrollbar-gutter: stable;
}
.console-log {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) 24px;
  gap: 4px;
  align-items: start;
  padding: 4px 6px;
  border-bottom: 1px solid var(--agui-c-divider);
  font-size: 12px;
}
.console-log:hover {
  background: var(--agui-c-bg-hover);
}
.console-log-content {
  min-width: 0;
  overflow-wrap: anywhere;
}
.console-log-icon {
  display: flex;
  align-items: center;
  min-height: 24px;
}
.console-log-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  min-height: 24px;
}
.console-log-details {
  margin: 4px 0 0;
  white-space: pre-wrap;
  color: var(--agui-c-text-2);
  font-size: 12px;
}
.log-time {
  white-space: nowrap;
  color: var(--agui-c-text-2);
}
.console-success {
  color: var(--agui-c-success-text);
}
.console-error {
  color: var(--agui-c-danger-text);
}
.console-warning {
  color: var(--agui-c-warning-text);
}
</style>
