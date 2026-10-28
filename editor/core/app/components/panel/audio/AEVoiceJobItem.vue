<script setup lang="ts">
import type { VoiceGenerationJob } from '@advjs/audio'
import type { EditorVoiceJobAction } from '../../../../../../packages/advjs/shared/editor-audio'
import AGUIDetails from '@advjs/gui/client/components/AGUIDetails.vue'
import AGUIButton from '@advjs/gui/client/components/button/AGUIButton.vue'
import AGUITag from '@advjs/gui/client/components/tag/AGUITag.vue'
import { computed, shallowRef } from 'vue'
import AEVoiceJobTasks from './AEVoiceJobTasks.vue'
import { voiceJobBlockedReason } from './voice-job-labels'

const props = defineProps<{ job: VoiceGenerationJob, pending: boolean, batchSize?: number }>()
const emit = defineEmits<{ command: [job: VoiceGenerationJob, action: EditorVoiceJobAction] }>()
const expanded = shallowRef(props.job.tasks.length <= 5)
const completed = computed(() => props.job.tasks.filter(task => task.status === 'committed').length)
const failed = computed(() => props.job.tasks.filter(task => task.status === 'failed').length)
const unknown = computed(() => props.job.tasks.filter(task => task.status === 'unknown').length)
const blocked = computed(() => props.job.tasks.filter(task => task.status === 'blocked'))
const blockedReason = computed(() => voiceJobBlockedReason(blocked.value[0]?.errorCode))
const queued = computed(() => props.job.tasks.filter(task => task.status === 'queued').length)
const generating = computed(() => props.job.tasks.filter(task => task.status === 'running').length)
const registering = computed(() => props.job.tasks.filter(task => task.status === 'generated').length)
const context = computed(() => `${[...new Set(props.job.tasks.map(task => task.providerId))].join('、')} · ${[...new Set(props.job.tasks.map(task => task.locale))].join('、')}`)
const cancellable = computed(() => !props.job.cancelled && props.job.tasks.some(task => ['queued', 'running', 'generated', 'blocked'].includes(task.status)))
const created = computed(() => new Date(props.job.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }))
const currentWindow = computed(() => {
  const first = props.job.tasks.findIndex(task => task.status !== 'committed')
  return props.batchSize && first >= 0 ? props.job.tasks.slice(Math.floor(first / props.batchSize) * props.batchSize, (Math.floor(first / props.batchSize) + 1) * props.batchSize) : props.job.tasks
})
const runnable = computed(() => {
  if (props.job.cancelled || (props.batchSize && currentWindow.value.some(task => ['failed', 'unknown'].includes(task.status))))
    return false
  return currentWindow.value.some(task => ['queued', 'generated', 'blocked'].includes(task.status))
})
const batches = computed(() => {
  if (!props.batchSize)
    return undefined
  const total = Math.ceil(props.job.tasks.length / props.batchSize)
  const incomplete = props.job.tasks.findIndex(task => task.status !== 'committed')
  const done = incomplete < 0 ? total : Math.floor(incomplete / props.batchSize)
  return { total, completed: done, current: Math.min(done + 1, total), stopped: currentWindow.value.some(task => ['failed', 'unknown', 'blocked'].includes(task.status)) && !currentWindow.value.some(task => ['running', 'generated'].includes(task.status)) }
})
function command(action: EditorVoiceJobAction) {
  emit('command', props.job, action)
}
function toggle(event: Event) {
  expanded.value = (event.target as HTMLDetailsElement).open
}
</script>

<template>
  <article class="ae-job-item" :data-job-id="job.id">
    <header class="ae-job-item-heading">
      <div class="ae-job-item-title">
        <strong>{{ job.summary.lines }} 句配音</strong>
        <time :datetime="job.createdAt" :title="job.createdAt">{{ created }}</time>
      </div>
      <div class="ae-job-item-states">
        <AGUITag v-if="job.cancelled" tone="neutral">
          已取消
        </AGUITag>
        <AGUITag v-if="failed" tone="danger">
          {{ failed }} 句失败
        </AGUITag>
        <AGUITag v-if="unknown" tone="warning">
          {{ unknown }} 句结果未知
        </AGUITag>
        <AGUITag v-if="blocked.length" tone="warning">
          {{ blocked.length }} 句已阻断
        </AGUITag>
      </div>
    </header>
    <p class="ae-job-context">
      {{ context }}
    </p>
    <div class="ae-job-live-status" aria-label="任务执行状态" role="status">
      <AGUITag v-if="generating" tone="info">
        生成中 {{ generating }} 句
      </AGUITag>
      <span v-if="registering">待登记 {{ registering }} 句</span>
      <span v-if="queued">排队 {{ queued }} 句</span>
      <AGUITag v-if="completed === job.tasks.length" tone="success">
        全部已登记
      </AGUITag>
    </div>
    <div class="ae-job-progress-heading">
      <span><strong>{{ completed }}</strong> / {{ job.tasks.length }} 句已登记</span>
      <span v-if="batches" data-testid="jobs-batch-progress">第 {{ batches.current }} / {{ batches.total }} 批 · 已完成 {{ batches.completed }} 批 · 每批最多 {{ batchSize }} 句</span>
    </div>
    <progress class="ae-job-progress" :value="completed" :max="job.tasks.length" :aria-label="`${job.summary.lines}句配音已登记进度`" />
    <p class="ae-job-meta">
      <span>{{ job.chargedCharacters }} / {{ job.budget.maxCharacters }} 字符已预留</span><span>并发 {{ job.budget.concurrency }}</span><span>保留 {{ job.retentionDays }} 天</span>
    </p>
    <div v-if="unknown || blocked.length || (batches?.stopped && !job.cancelled)" class="ae-job-warning" role="status">
      <p v-if="blocked.length" data-testid="jobs-blocked-reason">
        {{ blockedReason }}
      </p>
      <p v-if="unknown">
        供应商调用结果未知，预算预留仍保留。当前插件未提供结果查询，禁止自动重试或重复计费。
      </p>
      <p v-if="batches?.stopped && !job.cancelled">
        当前批次尚未完成，后续批次保持排队。先处理已阻断、失败或未知结果，再继续执行。
      </p>
    </div>
    <div class="ae-job-item-actions">
      <AGUIButton :theme="runnable ? 'primary' : 'default'" :disabled="pending || !runnable" data-testid="jobs-run" @click="command('run')">
        开始 / 继续执行
      </AGUIButton>
      <AGUIButton variant="text" :disabled="pending || !cancellable" data-testid="jobs-cancel" @click="command('cancel')">
        取消
      </AGUIButton>
      <AGUIButton v-if="job.cancelled" theme="primary" :disabled="pending" data-testid="jobs-resume" @click="command('resume')">
        恢复排队
      </AGUIButton>
      <AGUIButton :disabled="pending || !failed" data-testid="jobs-retry" @click="command('retry')">
        重试已知失败
      </AGUIButton>
    </div>
    <AGUIDetails class="ae-job-results" :title="`逐句结果 · ${job.tasks.length} 句`" :open="expanded" data-testid="jobs-results" @toggle="toggle">
      <AEVoiceJobTasks v-if="expanded" :job="job" />
    </AGUIDetails>
  </article>
</template>

<style scoped>
.ae-job-item {
  display: grid;
  gap: var(--agui-space-2);
  min-width: 0;
  padding-block: var(--agui-space-3);
}
.ae-job-item:first-child {
  padding-top: 0;
}
.ae-job-item + .ae-job-item {
  border-top: 1px solid var(--agui-c-divider-light);
}
.ae-job-item-heading,
.ae-job-item-title,
.ae-job-item-states,
.ae-job-progress-heading,
.ae-job-live-status,
.ae-job-item-actions,
.ae-job-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--agui-space-1) var(--agui-space-2);
  min-width: 0;
}
.ae-job-item-heading,
.ae-job-progress-heading {
  justify-content: space-between;
}
.ae-job-item-title strong {
  font-size: var(--agui-font-size-title);
  font-weight: 600;
}
.ae-job-item-title time,
.ae-job-progress-heading,
.ae-job-context,
.ae-job-live-status,
.ae-job-meta {
  color: var(--agui-c-text-2);
  font-size: var(--agui-font-size-caption);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.ae-job-progress-heading strong {
  color: var(--agui-c-text-1);
  font-size: var(--agui-font-size-body);
  font-weight: 600;
}
.ae-job-progress {
  display: block;
  width: 100%;
  height: 4px;
  border: 0;
  border-radius: var(--agui-radius-sm);
  overflow: hidden;
  background: var(--agui-c-control);
  accent-color: var(--agui-c-primary);
}
.ae-job-progress::-webkit-progress-bar {
  background: var(--agui-c-control);
}
.ae-job-progress::-webkit-progress-value {
  background: var(--agui-c-primary);
}
.ae-job-progress::-moz-progress-bar {
  background: var(--agui-c-primary);
}
.ae-job-meta {
  margin: 0;
}
.ae-job-context {
  margin: 0;
}
.ae-job-warning {
  display: grid;
  gap: var(--agui-space-1);
  margin: 0;
  padding: var(--agui-space-2);
  border-radius: var(--agui-radius-sm);
  background: var(--agui-c-warning-soft);
  color: var(--agui-c-warning-text);
  font-size: var(--agui-font-size-caption);
  line-height: var(--agui-line-height);
  overflow-wrap: anywhere;
}
.ae-job-warning > p {
  margin: 0;
}
.ae-job-results {
  border: 1px solid var(--agui-c-divider-light);
  border-radius: var(--agui-radius-sm);
  overflow: hidden;
}
</style>
