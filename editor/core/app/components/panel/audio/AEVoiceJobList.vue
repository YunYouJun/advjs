<script setup lang="ts">
import type { VoiceGenerationJob } from '@advjs/audio'
import type { EditorVoiceJobAction } from '../../../../../../packages/advjs/shared/editor-audio'
import AEVoiceJobItem from './AEVoiceJobItem.vue'

defineProps<{ jobs: VoiceGenerationJob[], pending: boolean, batchSize?: number }>()
const emit = defineEmits<{ command: [job: VoiceGenerationJob, action: EditorVoiceJobAction] }>()
</script>

<template>
  <div class="ae-job-list" aria-label="持久配音任务">
    <p v-if="!jobs.length" class="ae-job-empty">
      尚无配音任务。先在上方创建并审核计划，再确认入队。
    </p>
    <AEVoiceJobItem v-for="job in jobs" :key="job.id" :job="job" :pending="pending" :batch-size="batchSize" @command="(value, action) => emit('command', value, action)" />
  </div>
</template>

<style scoped>
.ae-job-list {
  min-width: 0;
}
.ae-job-empty {
  margin: 0;
  padding: var(--agui-space-3);
  border: 1px dashed var(--agui-c-divider);
  border-radius: var(--agui-radius-sm);
  color: var(--agui-c-text-2);
  font-size: var(--agui-font-size-body);
  line-height: var(--agui-line-height);
  text-align: center;
}
</style>
