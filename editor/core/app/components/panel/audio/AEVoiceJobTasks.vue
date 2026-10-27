<script setup lang="ts">
import type { VoiceGenerationJob } from '@advjs/audio'
import AGUIButton from '@advjs/gui/client/components/button/AGUIButton.vue'
import { computed, shallowRef } from 'vue'

const props = defineProps<{ job: VoiceGenerationJob, batchSize?: number }>()
const page = shallowRef(0)
const pageSize = 100
const pageCount = computed(() => Math.max(1, Math.ceil(props.job.tasks.length / pageSize)))
const visibleTasks = computed(() => props.job.tasks.slice(page.value * pageSize, (page.value + 1) * pageSize))
const statusLabels: Record<string, string> = { queued: '已排队', running: '生成中', generated: '待登记', committed: '已登记 · 未自动选用', unknown: '结果未知', failed: '失败', blocked: '已阻断', cancelled: '已取消' }
const errorLabels: Record<string, string> = { STORE_CAPACITY_EXCEEDED: '恢复记录空间不足，尚未调用模型' }
const batches = computed(() => {
  if (!props.batchSize)
    return undefined
  const total = Math.ceil(props.job.tasks.length / props.batchSize)
  const incomplete = props.job.tasks.findIndex(task => task.status !== 'committed')
  const completed = incomplete < 0 ? total : Math.floor(incomplete / props.batchSize)
  const window = props.job.tasks.slice(completed * props.batchSize, (completed + 1) * props.batchSize)
  return { total, completed, current: Math.min(completed + 1, total), stopped: window.some(task => ['failed', 'unknown', 'blocked'].includes(task.status)) && !window.some(task => ['running', 'generated'].includes(task.status)) }
})
</script>

<template>
  <div>
    <p v-if="batches" class="ae-resource-caption" data-testid="jobs-batch-progress">
      第 {{ batches.current }} / {{ batches.total }} 批 · 已完成 {{ batches.completed }} 批 · 每批最多 {{ batchSize }} 句
    </p>
    <p v-if="batches?.stopped && !job.cancelled" class="ae-resource-caption" role="status">
      当前批次尚未完成，后续批次保持排队。先处理失败或未知结果，再继续执行。
    </p>
    <ul class="ae-job-tasks">
      <li v-for="task in visibleTasks" :key="task.id" :data-task-status="task.status">
        <span>{{ task.speakerId }} · {{ task.locale }} · {{ task.model }}</span>
        <span>{{ statusLabels[task.status] }}<template v-if="task.errorCode"> · {{ errorLabels[task.errorCode] ?? task.errorCode }}</template></span>
      </li>
    </ul>
    <div v-if="pageCount > 1" class="ae-resource-actions" aria-label="任务结果分页">
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
  gap: 6px;
  list-style: none;
  margin: 8px 0;
  padding: 0;
}
.ae-job-tasks li {
  display: grid;
  gap: 2px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--agui-c-divider-light);
}
.ae-job-tasks li > span:last-child {
  color: var(--agui-c-text-2);
  font-size: 12px;
}
</style>
