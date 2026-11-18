<script setup lang="ts">
import AGUISection from '@advjs/gui/client/components/AGUISection.vue'
import AGUIButton from '@advjs/gui/client/components/button/AGUIButton.vue'
import AGUITag from '@advjs/gui/client/components/tag/AGUITag.vue'
import AGUIToolbar from '@advjs/gui/client/components/toolbar/AGUIToolbar.vue'
import { reactive } from 'vue'
import { useVoiceJobs } from '../../../composables/useVoiceJobs'
import AEVoiceJobBudget from './AEVoiceJobBudget.vue'
import AEVoiceJobList from './AEVoiceJobList.vue'
import AEVoiceJobPlanForm from './AEVoiceJobPlanForm.vue'
import AEVoiceJobReview from './AEVoiceJobReview.vue'

const props = withDefaults(defineProps<{ visible?: boolean }>(), { visible: true })
const jobs = reactive(useVoiceJobs(() => props.visible))
</script>

<template>
  <section class="ae-voice-jobs" aria-label="配音生成任务" :aria-busy="jobs.loading || jobs.pending">
    <AGUIToolbar :items="[]" label="配音生成任务">
      <template #before-toolbar>
        <span class="ae-job-toolbar-title">批量配音</span>
      </template>
      <template #after-toolbar>
        <AGUIButton :loading="jobs.loading" :disabled="jobs.pending || !jobs.hasTransport" data-testid="jobs-refresh" @click="jobs.reload">
          刷新任务
        </AGUIButton>
      </template>
    </AGUIToolbar>
    <div class="ae-job-workspace">
      <p v-if="!jobs.hasTransport" class="ae-job-notice" role="status">
        当前工作区未配置配音任务服务。桌面或本地 Editor 使用受信任项目宿主；浏览器宿主需要显式注入已配置的服务。
      </p>
      <p v-else class="ae-job-intro">
        默认预设：{{ jobs.snapshot?.defaultPreset ?? '尚未配置' }}。先选择范围，再审核整个计划的预算。
      </p>
      <AGUISection title="选择范围" step="1" description="选择章节、语言与合成插件，再勾选需要配音的台词。" data-testid="jobs-scope-section">
        <template #actions>
          <AGUITag tone="neutral">
            最多 {{ jobs.maxLines }} 句
          </AGUITag>
          <AGUITag v-if="jobs.batchSize" tone="neutral">
            每批 {{ jobs.batchSize }} 句
          </AGUITag>
        </template>
        <AEVoiceJobPlanForm v-model="jobs.draft" :providers="jobs.providerOptions" :locales="jobs.localeOptions" :lines="jobs.lines" :chapters="jobs.chapterOptions" :max-lines="jobs.maxLines" :batch-size="jobs.batchSize" :disabled="jobs.pending || !jobs.available" />
        <template v-if="jobs.unboundCount" #footer>
          <p class="ae-job-caption">
            {{ jobs.unboundCount }} 句没有稳定 lineId，需先在剧本中登记才能生成配音。
          </p>
        </template>
      </AGUISection>
      <AGUISection title="审核预算" step="2" description="所有批次共用同一份总预算，确认计划后才可入队。" data-testid="jobs-budget-section">
        <AEVoiceJobBudget v-model="jobs.draft" :disabled="jobs.pending || !jobs.available" />
        <div class="ae-job-plan-actions">
          <AGUIButton :theme="jobs.review ? 'default' : 'primary'" :loading="jobs.pending" :disabled="!jobs.canPlan" data-testid="jobs-plan" @click="jobs.plan">
            创建审核计划
          </AGUIButton>
          <span v-if="!jobs.review" class="ae-job-caption" data-testid="jobs-next-step">{{ jobs.draft.lineIds.length ? '先核对总预算并创建计划，此步骤不会调用模型。' : '先在上方勾选台词，再创建审核计划。' }}</span>
        </div>
        <AEVoiceJobReview v-if="jobs.review" v-model:budget-reviewed="jobs.budgetReviewed" :review="jobs.review" :batch-size="jobs.batchSize" :pending="jobs.pending" @enqueue="jobs.enqueue" />
        <p v-if="jobs.error" class="ae-job-error" role="alert">
          {{ jobs.error }}
        </p>
      </AGUISection>
      <AGUISection title="生成进度" step="3" description="开始任务后按批次生成；完成后到「对白配音」试听并采用。" data-testid="jobs-progress-section">
        <template #actions>
          <AGUITag tone="neutral">
            {{ jobs.jobs.length }} 个任务
          </AGUITag>
        </template>
        <p v-if="jobs.status" class="ae-job-notice" role="status">
          {{ jobs.status }}
        </p>
        <AEVoiceJobList :jobs="jobs.jobs" :pending="jobs.pending" :batch-size="jobs.batchSize" @command="jobs.command" />
        <template #footer>
          <p class="ae-job-caption">
            任务和调用状态保存在宿主应用数据中，关闭面板后仍可恢复。生成结果登记为未选 take，不会替换已选配音。
          </p>
        </template>
      </AGUISection>
    </div>
  </section>
</template>

<style scoped>
.ae-voice-jobs {
  height: 100%;
  min-height: 0;
}
.ae-job-toolbar-title {
  font-weight: 500;
}
.ae-job-workspace {
  display: grid;
  gap: var(--agui-space-3);
  min-width: 0;
  padding: var(--agui-space-3);
  font-size: var(--agui-font-size-body);
  line-height: var(--agui-line-height);
}
.ae-job-intro,
.ae-job-caption {
  margin: 0;
  color: var(--agui-c-text-2);
  font-size: var(--agui-font-size-caption);
  line-height: var(--agui-line-height);
  overflow-wrap: anywhere;
}
.ae-job-plan-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--agui-space-2);
}
.ae-job-notice,
.ae-job-error {
  margin: 0;
  padding: var(--agui-space-2);
  border-radius: var(--agui-radius-sm);
  line-height: var(--agui-line-height);
  overflow-wrap: anywhere;
}
.ae-job-notice {
  background: var(--agui-c-bg-soft);
  color: var(--agui-c-text-2);
}
.ae-job-error {
  background: var(--agui-c-danger-soft);
  color: var(--agui-c-danger-text);
}
</style>
