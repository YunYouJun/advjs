<script setup lang="ts">
import type { VoiceGenerationJob } from '@advjs/audio'
import AGUIButton from '@advjs/gui/client/components/button/AGUIButton.vue'
import { computed, shallowRef } from 'vue'
import { voiceJobErrorLabels } from './voice-job-labels'

const props = defineProps<{ job: VoiceGenerationJob }>()
const page = shallowRef(0)
const pageSize = 100
const pageCount = computed(() => Math.max(1, Math.ceil(props.job.tasks.length / pageSize)))
const visibleTasks = computed(() => props.job.tasks.slice(page.value * pageSize, (page.value + 1) * pageSize))
const statusLabels: Record<string, string> = { queued: '已排队', running: '生成中', generated: '待登记', committed: '已登记 · 未自动选用', unknown: '结果未知', failed: '失败', blocked: '已阻断', cancelled: '已取消' }
</script>

<template>
  <div>
    <ul class="ae-job-tasks">
      <li v-for="(task, index) in visibleTasks" :key="task.id" class="ae-job-task" :data-task-status="task.status">
        <span class="ae-job-task-identity"><span><strong class="ae-job-task-order">第 {{ page * pageSize + index + 1 }} 句</strong><span>{{ task.speakerId }}</span></span><span>{{ task.locale }} · {{ task.model }}</span></span>
        <span class="ae-job-task-state" :class="{ 'is-warning': task.status === 'unknown' || task.status === 'blocked', 'is-error': task.status === 'failed' }">{{ statusLabels[task.status] }}<template v-if="task.errorCode"> · {{ voiceJobErrorLabels[task.errorCode] ?? task.errorCode }}</template></span>
        <span class="ae-job-task-coordinate">行 ID <code class="ae-job-task-line-id" aria-label="稳定台词 ID">{{ task.lineId }}</code></span>
      </li>
    </ul>
    <div v-if="pageCount > 1" class="ae-job-result-pagination" aria-label="任务结果分页">
      <AGUIButton :disabled="page === 0" @click="page--">
        上一页结果
      </AGUIButton>
      <span>{{ page + 1 }} / {{ pageCount }} 页</span>
      <AGUIButton :disabled="page + 1 >= pageCount" @click="page++">
        下一页结果
      </AGUIButton>
    </div>
  </div>
</template>

<style scoped>
.ae-job-tasks {
  display: grid;
  gap: var(--agui-space-2);
  list-style: none;
  margin: 0;
  padding: 0;
}
.ae-job-task {
  display: grid;
  gap: var(--agui-space-1);
  min-width: 0;
  padding-bottom: var(--agui-space-2);
}
.ae-job-task + .ae-job-task {
  border-top: 1px solid var(--agui-c-divider-light);
  padding-top: var(--agui-space-2);
}
.ae-job-task-identity {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--agui-space-1) var(--agui-space-2);
  overflow-wrap: anywhere;
}
.ae-job-task-identity > span:last-child,
.ae-job-task-coordinate,
.ae-job-task-state {
  color: var(--agui-c-text-2);
  font-size: var(--agui-font-size-caption);
  overflow-wrap: anywhere;
}
.ae-job-task-order {
  margin-right: var(--agui-space-2);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.ae-job-task-coordinate {
  display: flex;
  flex-wrap: wrap;
  gap: var(--agui-space-1);
  align-items: baseline;
}
.ae-job-task-line-id {
  color: var(--agui-c-text-2);
  font-family: var(--agui-font-mono, monospace);
  font-size: var(--agui-font-size-caption);
  overflow-wrap: anywhere;
  user-select: text;
}
.ae-job-task-state.is-warning {
  color: var(--agui-c-warning-text);
}
.ae-job-task-state.is-error {
  color: var(--agui-c-danger-text);
}
.ae-job-result-pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--agui-space-1);
  color: var(--agui-c-text-2);
  font-size: var(--agui-font-size-caption);
}
</style>
