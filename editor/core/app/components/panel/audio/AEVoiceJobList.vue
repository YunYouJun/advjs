<script setup lang="ts">
import type { VoiceGenerationJob } from '@advjs/audio'
import type { EditorVoiceJobAction } from '../../../../../../packages/advjs/shared/editor-audio'
import AGUIDetails from '@advjs/gui/client/components/AGUIDetails.vue'
import AGUIButton from '@advjs/gui/client/components/button/AGUIButton.vue'

defineProps<{ jobs: VoiceGenerationJob[], pending: boolean }>()
const emit = defineEmits<{ command: [job: VoiceGenerationJob, action: EditorVoiceJobAction] }>()
const statusLabels: Record<string, string> = { queued: '已排队', running: '生成中', generated: '待登记', committed: '已登记 · 未自动选用', unknown: '结果未知', failed: '失败', blocked: '已阻断', cancelled: '已取消' }
function runnable(job: VoiceGenerationJob) {
  return !job.cancelled && job.tasks.some(task => ['queued', 'generated', 'blocked'].includes(task.status))
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
      <ul class="ae-job-tasks">
        <li v-for="task in job.tasks" :key="task.id" :data-task-status="task.status">
          <span>{{ task.speakerId }} · {{ task.locale }} · {{ task.model }}</span>
          <span>{{ statusLabels[task.status] }}<template v-if="task.errorCode"> · {{ task.errorCode }}</template></span>
        </li>
      </ul>
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
