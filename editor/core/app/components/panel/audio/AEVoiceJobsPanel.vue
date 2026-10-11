<script setup lang="ts">
import AGUICheckbox from '@advjs/gui/client/components/AGUICheckbox.vue'
import AGUIDetails from '@advjs/gui/client/components/AGUIDetails.vue'
import AGUIButton from '@advjs/gui/client/components/button/AGUIButton.vue'
import AGUIToolbar from '@advjs/gui/client/components/toolbar/AGUIToolbar.vue'
import { reactive } from 'vue'
import { useVoiceJobs } from '../../../composables/useVoiceJobs'
import AEVoiceJobList from './AEVoiceJobList.vue'
import AEVoiceJobPlanForm from './AEVoiceJobPlanForm.vue'

const props = withDefaults(defineProps<{ visible?: boolean }>(), { visible: true })
const jobs = reactive(useVoiceJobs(() => props.visible))
</script>

<template>
  <section class="ae-voice-jobs" aria-label="配音生成任务" :aria-busy="jobs.loading || jobs.pending">
    <AGUIToolbar :items="[]" label="配音生成任务">
      <template #before-toolbar>
        <span>配音任务 · {{ jobs.jobs.length }}</span>
      </template>
      <template #after-toolbar>
        <AGUIButton :loading="jobs.loading" :disabled="jobs.pending || !jobs.hasTransport" data-testid="jobs-refresh" @click="jobs.reload">
          刷新任务
        </AGUIButton>
      </template>
    </AGUIToolbar>
    <div class="ae-job-workspace">
      <p v-if="!jobs.hasTransport" class="ae-resource-caption" role="status">
        当前工作区未配置配音任务服务。桌面或本地 Editor 使用受信任项目宿主；浏览器宿主需要显式注入已配置的服务。
      </p>
      <p v-else class="ae-resource-caption">
        默认预设：{{ jobs.snapshot?.defaultPreset ?? '尚未配置' }}。任务和调用状态保存在宿主应用数据中，关闭面板后仍可恢复。生成结果登记为未选 take，请在「对白配音」试听并采用。
      </p>
      <p v-if="jobs.unboundCount" class="ae-resource-caption">
        {{ jobs.unboundCount }} 句没有稳定 lineId，需先在剧本中登记才能生成配音。
      </p>
      <AGUIDetails title="创建与审核计划" open>
        <AEVoiceJobPlanForm v-model="jobs.draft" :providers="jobs.providerOptions" :locales="jobs.localeOptions" :lines="jobs.lines" :disabled="jobs.pending || !jobs.available" />
        <div class="ae-resource-actions">
          <AGUIButton :loading="jobs.pending" :disabled="!jobs.canPlan" data-testid="jobs-plan" @click="jobs.plan">
            创建审核计划
          </AGUIButton>
        </div>
      </AGUIDetails>
      <div v-if="jobs.review" class="ae-job-review" data-testid="jobs-plan-review">
        <p>
          {{ jobs.review.plan.summary.lines }} 句 · {{ jobs.review.plan.summary.characters }} 新生成字符 · {{ jobs.review.plan.summary.cacheHits }} 个缓存命中 · {{ jobs.review.plan.summary.newGenerations }} 次新生成
        </p>
        <p class="ae-resource-caption">
          费用：{{ jobs.review.plan.summary.estimatedCost ? `${jobs.review.plan.summary.estimatedCost.currency} ${jobs.review.plan.summary.estimatedCost.amountMicros / 1000000}` : '无法估算' }} · 字符上限 {{ jobs.review.plan.budget.maxCharacters }} · 并发上限 {{ jobs.review.plan.budget.concurrency }}
        </p>
        <AGUICheckbox v-model:checked="jobs.budgetReviewed" label="我已审核范围、语言与预算；生成不会替换已选配音" :disabled="jobs.pending" data-testid="jobs-budget-reviewed" />
        <div class="ae-resource-actions">
          <AGUIButton theme="primary" :disabled="jobs.pending || !jobs.budgetReviewed" data-testid="jobs-enqueue" @click="jobs.enqueue">
            确认并入队
          </AGUIButton>
        </div>
      </div>
      <p v-if="jobs.error" class="ae-resource-error" role="alert">
        {{ jobs.error }}
      </p>
      <p v-if="jobs.status" class="ae-resource-caption" role="status">
        {{ jobs.status }}
      </p>
      <AEVoiceJobList :jobs="jobs.jobs" :pending="jobs.pending" @command="jobs.command" />
    </div>
  </section>
</template>

<style scoped>
.ae-voice-jobs {
  height: 100%;
  min-height: 0;
}
.ae-job-workspace {
  display: grid;
  gap: 8px;
  padding: 8px;
}
.ae-job-review {
  border: 1px solid var(--agui-c-divider);
  padding: 8px;
}
.ae-job-review > p {
  margin: 0 0 6px;
}
</style>
