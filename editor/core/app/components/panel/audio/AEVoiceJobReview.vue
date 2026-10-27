<script setup lang="ts">
import type { EditorVoiceJobsReviewedPlan } from '../../../../../../packages/advjs/shared/editor-audio'
import AGUICheckbox from '@advjs/gui/client/components/AGUICheckbox.vue'
import AGUIButton from '@advjs/gui/client/components/button/AGUIButton.vue'
import AGUITag from '@advjs/gui/client/components/tag/AGUITag.vue'
import { computed } from 'vue'

const props = defineProps<{ review: EditorVoiceJobsReviewedPlan, pending: boolean, batchSize?: number }>()
const emit = defineEmits<{ enqueue: [] }>()
const approved = defineModel<boolean>('budgetReviewed', { required: true })
const plan = computed(() => props.review.plan)
const cost = computed(() => plan.value.summary.estimatedCost ? `${plan.value.summary.estimatedCost.currency} ${plan.value.summary.estimatedCost.amountMicros / 1000000}` : '无法估算')
const batchCount = computed(() => props.batchSize ? Math.ceil(plan.value.tasks.length / props.batchSize) : undefined)
</script>

<template>
  <div class="ae-job-review" data-testid="jobs-plan-review">
    <div class="ae-job-review-heading">
      <strong>{{ plan.summary.lines }} 句已纳入计划</strong>
      <AGUITag v-if="batchCount" tone="neutral">
        共 {{ batchCount }} 批
      </AGUITag>
    </div>
    <p v-if="review.selection" class="ae-job-review-hint">
      从 {{ review.selection.requestedLines }} 句中筛出 {{ plan.summary.lines }} 句，跳过 {{ review.selection.skippedLines }} 句。
    </p>
    <dl class="ae-job-review-details" aria-label="配音计划预算汇总">
      <div><dt>新生成字符</dt><dd>{{ plan.summary.characters }}</dd></div>
      <div><dt>缓存复用</dt><dd>{{ plan.summary.cacheHits }} 句</dd></div>
      <div><dt>新生成</dt><dd>{{ plan.summary.newGenerations }} 次</dd></div>
      <div><dt>费用估算</dt><dd>{{ cost }}</dd></div>
      <div><dt>总字符上限</dt><dd>{{ plan.budget.maxCharacters }}</dd></div>
      <div><dt>并发上限</dt><dd>{{ plan.budget.concurrency }}</dd></div>
    </dl>
    <AGUICheckbox v-model:checked="approved" class="ae-job-review-approval" label="我已审核范围、语言与预算；生成不会替换已选配音" :disabled="pending" data-testid="jobs-budget-reviewed" />
    <div class="ae-job-review-actions">
      <AGUIButton theme="primary" :disabled="pending || !approved" data-testid="jobs-enqueue" @click="emit('enqueue')">
        确认并入队
      </AGUIButton>
      <span>入队后，在下方开始生成。</span>
    </div>
  </div>
</template>

<style scoped>
.ae-job-review {
  display: grid;
  gap: var(--agui-space-2);
  margin-top: var(--agui-space-1);
  padding-top: var(--agui-space-3);
  border-top: 1px solid var(--agui-c-divider-light);
}
.ae-job-review-heading,
.ae-job-review-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--agui-space-2);
}
.ae-job-review-heading strong {
  font-size: var(--agui-font-size-title);
  font-weight: 600;
}
.ae-job-review-hint,
.ae-job-review-actions span {
  margin: 0;
  color: var(--agui-c-text-2);
  font-size: var(--agui-font-size-caption);
  line-height: var(--agui-line-height);
  overflow-wrap: anywhere;
}
.ae-job-review-details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--agui-space-1) var(--agui-space-4);
  margin: 0;
  padding: var(--agui-space-2) 0;
  border-block: 1px solid var(--agui-c-divider-light);
}
.ae-job-review-details > div {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0 var(--agui-space-2);
  min-width: 0;
}
.ae-job-review-details dt {
  color: var(--agui-c-text-2);
}
.ae-job-review-details dd {
  margin: 0;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.ae-job-review-approval {
  margin: 0;
  line-height: var(--agui-line-height);
}
.ae-job-review-approval :deep(.label) {
  line-height: var(--agui-line-height);
}
</style>
