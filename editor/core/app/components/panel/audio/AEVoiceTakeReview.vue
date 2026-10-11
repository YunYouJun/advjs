<script setup lang="ts">
import type { VoiceTake } from '@advjs/types'
import { normalizeSpokenText } from '@advjs/audio'
import AGUICheckbox from '@advjs/gui/client/components/AGUICheckbox.vue'
import AGUIDetails from '@advjs/gui/client/components/AGUIDetails.vue'
import AGUIButton from '@advjs/gui/client/components/button/AGUIButton.vue'
import { computed } from 'vue'

const props = defineProps<{ take?: VoiceTake, selectedTake?: string | null, displayText: string, spokenText?: string, pending: boolean, canSelect: boolean, writable: boolean, previewLoading: boolean }>()
const emit = defineEmits<{ preview: [], select: [], clear: [] }>()
const replace = defineModel<boolean>('replace', { default: false })
const stale = computed(() => props.take && props.take.spokenText !== normalizeSpokenText(props.displayText, { override: props.spokenText || undefined }))
const replacing = computed(() => Boolean(props.selectedTake && props.selectedTake !== props.take?.id))
</script>

<template>
  <div v-if="take" class="ae-take-review">
    <p class="ae-resource-caption" role="status">
      {{ selectedTake === take.id ? '当前已选 take' : '历史候选，尚未选用' }}
    </p>
    <p v-if="stale" class="ae-take-warning" role="status">
      台词已变化。此 take 保留原文，选用前请审核。
    </p>
    <p class="ae-take-prose">
      {{ take.spokenText }}
    </p>
    <div class="ae-resource-actions">
      <AGUIButton :loading="previewLoading" :disabled="pending" data-testid="take-preview" @click="emit('preview')">
        载入试听
      </AGUIButton>
      <AGUIButton :disabled="!canSelect" :loading="pending" data-testid="take-select" @click="emit('select')">
        选用此 take
      </AGUIButton>
    </div>
    <AGUICheckbox v-if="selectedTake" v-model:checked="replace" :disabled="pending || !writable" :label="replacing ? '明确替换当前已选配音' : '明确清除当前已选配音'" data-testid="take-replace" />
    <AGUIButton v-if="selectedTake" :disabled="!replace || pending || !writable" data-testid="take-clear" @click="emit('clear')">
      清除配音绑定
    </AGUIButton>
    <AGUIDetails title="不可变生成记录与权利信息">
      <dl class="ae-take-record">
        <dt>Take</dt><dd>{{ take.id }}</dd>
        <dt>音频资源</dt><dd>{{ take.assetId }}</dd>
        <dt>供应商</dt><dd>{{ take.providerId }} · {{ take.voiceId }}</dd>
        <dt>模型</dt><dd>{{ take.model }} · {{ take.modelRevision ?? '未记录版本' }}</dd>
        <dt>创建时间</dt><dd>{{ take.createdAt }}</dd>
        <dt>来源</dt><dd>{{ take.source }}</dd>
        <dt>SHA-256</dt><dd>{{ take.sha256 }}</dd>
        <dt>声音配置版本</dt><dd>{{ take.voiceProfileRevision }}</dd>
        <dt>输入指纹</dt><dd>{{ take.inputFingerprint }}</dd>
        <template v-if="take.rights">
          <dt>许可</dt><dd>{{ take.rights.license }}</dd><dt>权利主体</dt><dd>{{ take.rights.subject }}</dd><dt>同意记录</dt><dd>{{ take.rights.consentRecord }}</dd>
        </template>
      </dl>
    </AGUIDetails>
  </div>
</template>

<style scoped>
.ae-take-review {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.ae-take-prose {
  margin: 4px 0;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
}
.ae-take-warning {
  color: var(--agui-c-warning-text);
}
.ae-take-record {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  gap: 4px 8px;
  margin: 0;
}
.ae-take-record dt {
  color: var(--agui-c-text-2);
}
.ae-take-record dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
}
</style>
