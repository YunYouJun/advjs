<script setup lang="ts">
import type { VoiceDesignPreviewReview } from '@advjs/types'
import AGUICheckbox from '@advjs/gui/client/components/AGUICheckbox.vue'
import AGUIDetails from '@advjs/gui/client/components/AGUIDetails.vue'
import AGUIProperty from '@advjs/gui/client/components/AGUIProperty.vue'
import AGUIButton from '@advjs/gui/client/components/button/AGUIButton.vue'
import AGUIInput from '@advjs/gui/client/components/input/AGUIInput.vue'
import AGUISelect from '@advjs/gui/client/components/select/AGUISelect.vue'

defineProps<{ idPrefix: string, localeOptions: string[], providerOptions: Array<{ value: string, label: string }>, pending: boolean, canPlan: boolean, review?: VoiceDesignPreviewReview }>()
const emit = defineEmits<{ plan: [], execute: [] }>()
const locale = defineModel<string>('locale', { required: true })
const providerId = defineModel<string>('providerId', { required: true })
const text = defineModel<string>('text', { required: true })
const maxCharacters = defineModel<string>('maxCharacters', { required: true })
const allowUnknownCost = defineModel<boolean>('allowUnknownCost', { required: true })
const budgetReviewed = defineModel<boolean>('budgetReviewed', { required: true })
</script>

<template>
  <AGUIDetails title="生成与审核试听" open>
    <AGUIProperty :for="`${idPrefix}-preview-locale`" label="试听语言">
      <AGUISelect :id="`${idPrefix}-preview-locale`" v-model="locale" label="音色试听语言" :options="localeOptions" :disabled="pending" />
    </AGUIProperty>
    <AGUIProperty :for="`${idPrefix}-preview-provider`" label="试听供应商">
      <AGUISelect :id="`${idPrefix}-preview-provider`" v-model="providerId" label="音色试听供应商" :options="providerOptions" :disabled="pending" />
    </AGUIProperty>
    <AGUIProperty :for="`${idPrefix}-preview-text`" label="试听文本">
      <textarea :id="`${idPrefix}-preview-text`" v-model="text" class="agui-textarea ae-design-text" rows="3" :disabled="pending" />
    </AGUIProperty>
    <AGUIProperty :for="`${idPrefix}-preview-limit`" label="字符预算上限">
      <AGUIInput :id="`${idPrefix}-preview-limit`" v-model="maxCharacters" inputmode="numeric" :disabled="pending" />
    </AGUIProperty>
    <AGUICheckbox v-model:checked="allowUnknownCost" label="当前费用无法估算；我允许在字符预算内生成试听" :disabled="pending" data-testid="design-unknown-cost" />
    <div class="ae-resource-actions">
      <AGUIButton :disabled="!canPlan" :loading="pending" data-testid="design-plan" @click="emit('plan')">
        创建试听审核计划
      </AGUIButton>
    </div>
    <div v-if="review" class="ae-design-review" data-testid="design-review">
      <p class="ae-resource-caption">
        {{ review.characterCount }} 字符 · {{ review.model }} · {{ review.source }} · 预算上限 {{ review.budget.maxCharacters }} 字符
      </p>
      <p class="ae-resource-caption">
        费用未知。仅确认执行后调用插件，候选不自动采用。
      </p>
      <AGUICheckbox v-model:checked="budgetReviewed" :disabled="pending" label="我已核对音色、语言、试听文本与预算" data-testid="design-budget-reviewed" />
      <div class="ae-resource-actions">
        <AGUIButton theme="primary" :disabled="pending || !budgetReviewed" :loading="pending" data-testid="design-execute" @click="emit('execute')">
          确认并生成试听
        </AGUIButton>
      </div>
    </div>
  </AGUIDetails>
</template>

<style scoped>
.ae-design-review {
  margin-top: 8px;
  padding: 8px;
  border: 1px solid var(--agui-c-divider);
}
.ae-design-text {
  width: 100%;
  min-width: 0;
  resize: vertical;
}
</style>
