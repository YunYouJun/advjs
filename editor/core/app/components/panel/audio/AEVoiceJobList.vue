<script setup lang="ts">
import type { VoiceGenerationJob } from '@advjs/audio'
import type { EditorVoiceJobAction } from '../../../../../../packages/advjs/shared/editor-audio'
import AGUIDetails from '@advjs/gui/client/components/AGUIDetails.vue'
import AGUIButton from '@advjs/gui/client/components/button/AGUIButton.vue'
import AEVoiceJobTasks from './AEVoiceJobTasks.vue'

const props = defineProps<{ jobs: VoiceGenerationJob[], pending: boolean, batchSize?: number }>()
const emit = defineEmits<{ command: [job: VoiceGenerationJob, action: EditorVoiceJobAction] }>()
function runnable(job: VoiceGenerationJob) {
  if (job.cancelled)
    return false
  const first = job.tasks.findIndex(task => task.status !== 'committed')
  const window = props.batchSize && first >= 0 ? job.tasks.slice(Math.floor(first / props.batchSize) * props.batchSize, (Math.floor(first / props.batchSize) + 1) * props.batchSize) : job.tasks
  if (props.batchSize && window.some(task => ['failed', 'unknown'].includes(task.status)))
    return false
  return window.some(task => ['queued', 'generated', 'blocked'].includes(task.status))
}
</script>

<template>
  <div class="ae-job-list" aria-label="持久配音任务">
    <p v-if="!jobs.length" class="ae-resource-empty">
      尚无配音任务。创建并审核计划后入队。
    </p>
    <AGUIDetails v-for="job in jobs" :key="job.id" :title="`${job.createdAt} · ${job.summary.lines} 句 · ${job.cancelled ? '已取消' : `${job.tasks.filter(task => task.status === 'committed').length} 句已登记`}`" open :data-job-id="job.id">
      <p class="ae-resource-caption">
        {{ job.chargedCharacters }} / {{ job.budget.maxCharacters }} 字符已预留 · 并发 {{ job.budget.concurrency }} · 保留 {{ job.retentionDays }} 天
      </p>
      <p v-if="job.tasks.some(task => task.status === 'unknown')" class="ae-resource-caption" role="status">
        供应商调用结果未知，预算预留仍保留。当前插件未提供结果查询，禁止自动重试或重复计费。
      </p>
      <AEVoiceJobTasks :job="job" :batch-size="batchSize" />
      <div class="ae-resource-actions">
        <AGUIButton :disabled="pending || !runnable(job)" data-testid="jobs-run" @click="emit('command', job, 'run')">
          开始 / 继续执行
        </AGUIButton>
        <AGUIButton :disabled="pending || job.cancelled || !job.tasks.some(task => ['queued', 'running', 'generated', 'blocked'].includes(task.status))" data-testid="jobs-cancel" @click="emit('command', job, 'cancel')">
          取消
        </AGUIButton>
        <AGUIButton v-if="job.cancelled" :disabled="pending" data-testid="jobs-resume" @click="emit('command', job, 'resume')">
          恢复排队
        </AGUIButton>
        <AGUIButton :disabled="pending || !job.tasks.some(task => task.status === 'failed')" data-testid="jobs-retry" @click="emit('command', job, 'retry')">
          重试已知失败
        </AGUIButton>
      </div>
    </AGUIDetails>
  </div>
</template>

<style scoped>
.ae-job-list {
  border-top: 1px solid var(--agui-c-divider);
}
</style>
