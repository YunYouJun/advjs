<script setup lang="ts">
import type { ErrorToastData } from '../../composables/useEditorNotifications'
import { AGUIToast, toastRef } from '@advjs/gui'
import { useEditorNotifications } from '../../composables/useEditorNotifications'
import { useEditorLayoutState } from '../../extensions/layout-state'
import AECopyErrorButton from './AECopyErrorButton.vue'

const { locale } = useI18n()
const console = useConsoleStore()
const layout = useEditorLayoutState()
const router = useRouter()
const { notifyError } = useEditorNotifications()
let lastLog: object | undefined
watch(() => console.logList, (logs) => {
  const start = lastLog ? logs.indexOf(lastLog as typeof logs[number]) + 1 : 0
  for (const log of logs.slice(start)) {
    if (log.type === 'error')
      notifyError({ source: log.message, error: log.data?.error ?? log.message, details: log.data, logs: log.data?.logs }, undefined, log.data?.report)
  }
  lastLog = logs.at(-1)
})
function report(data: unknown) {
  const value = data as ErrorToastData | undefined
  return value?.kind === 'editor-error' ? value.report : undefined
}
async function showLogs() {
  await router.push('/')
  layout.select('bottom', 'advjs.core/console')
}
</script>

<template>
  <AGUIToast ref="toastRef">
    <template #actions="{ item }">
      <template v-if="report(item.data)">
        <AECopyErrorButton :source="item.title" :report="report(item.data)" :label="locale === 'zh-CN' ? '复制信息给 AI' : 'Copy details for AI'" />
        <AGUIButton @click="showLogs">
          {{ locale === 'zh-CN' ? '查看日志' : 'View logs' }}
        </AGUIButton>
      </template>
    </template>
  </AGUIToast>
</template>
