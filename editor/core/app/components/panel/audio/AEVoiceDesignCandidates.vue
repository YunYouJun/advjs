<script setup lang="ts">
import type { VoiceDesignPreview, VoiceDesignSample } from '@advjs/types'
import AGUICheckbox from '@advjs/gui/client/components/AGUICheckbox.vue'
import AGUIButton from '@advjs/gui/client/components/button/AGUIButton.vue'
import { nextTick, onBeforeUnmount, useTemplateRef, watch } from 'vue'

const props = defineProps<{
  previews: VoiceDesignPreview[]
  samples: VoiceDesignSample[]
  selectedSample?: { assetId: string, sha256: string }
  source: string
  playingPreviewId: string
  pending: boolean
  replaceSelected: boolean
}>()
const emit = defineEmits<{
  'audition': [preview: VoiceDesignPreview]
  'register': [preview: VoiceDesignPreview]
  'cancel': [preview: VoiceDesignPreview]
  'select': [assetId: string]
  'stop': []
  'playbackBlocked': []
  'update:replaceSelected': [value: boolean]
}>()
const audio = useTemplateRef<HTMLAudioElement>('audio')
const statuses: Record<VoiceDesignPreview['status'], string> = { queued: '等待执行', running: '生成中', ready: '未登记候选', registered: '已登记样本', cancelled: '已取消', failed: '生成失败', unknown: '调用结果未知，须先查询' }
watch(() => props.source, async (source) => {
  audio.value?.pause()
  await nextTick()
  if (source && props.source === source)
    await audio.value?.play().catch(() => emit('playbackBlocked'))
})
onBeforeUnmount(() => audio.value?.pause())
</script>

<template>
  <section class="ae-design-candidates" aria-label="音色候选与样本审核">
    <p v-if="!previews.length && !samples.length" class="ae-resource-caption">
      生成后可直接试听未登记候选。登记样本、审核选用与应用角色分别确认。
    </p>
    <div v-for="preview in previews" :key="preview.id" class="ae-design-candidate" :data-testid="`design-preview-${preview.status}`">
      <p class="ae-design-candidate-title">
        {{ statuses[preview.status] }}
      </p>
      <p v-if="preview.candidate" class="ae-resource-caption">
        {{ preview.candidate.model }} · {{ preview.candidate.durationSeconds.toFixed(2) }} 秒 · {{ preview.candidate.bytes }} 字节
      </p>
      <p v-if="preview.status === 'unknown'" class="ae-resource-caption" role="status">
        查询当前状态后再处理，重新打开面板不会再次调用供应商。
      </p>
      <div class="ae-resource-actions">
        <AGUIButton v-if="preview.status === 'ready' || preview.status === 'registered'" :disabled="pending" :aria-label="`试听候选 ${preview.id}`" data-testid="design-audition" @click="emit('audition', preview)">
          试听候选
        </AGUIButton>
        <AGUIButton v-if="preview.status === 'ready'" :disabled="pending" :aria-label="`登记候选 ${preview.id}`" data-testid="design-register" @click="emit('register', preview)">
          登记为音色样本
        </AGUIButton>
        <AGUIButton v-if="preview.status === 'queued' || preview.status === 'running'" :disabled="pending" :aria-label="`取消候选 ${preview.id}`" @click="emit('cancel', preview)">
          取消生成
        </AGUIButton>
      </div>
    </div>
    <div v-if="source" class="ae-design-playback" :data-preview-id="playingPreviewId">
      <audio ref="audio" :src="source" controls preload="none" class="ae-design-audio" aria-label="音色候选试听" />
      <AGUIButton :disabled="pending" data-testid="design-stop-audition" @click="emit('stop')">
        停止试听
      </AGUIButton>
    </div>
    <div v-if="samples.length" class="ae-design-samples">
      <AGUICheckbox v-if="selectedSample" :checked="replaceSelected" :disabled="pending" label="我确认替换当前语言／供应商的已选音色样本" data-testid="design-replace-sample" @update:checked="emit('update:replaceSelected', $event)" />
      <div v-for="sample in samples" :key="sample.assetId" class="ae-design-sample" data-testid="design-sample">
        <p class="ae-design-candidate-title">
          {{ sample.assetId }}
        </p>
        <p class="ae-resource-caption">
          {{ sample.locale }} · {{ sample.providerId }} · {{ sample.source }}
          <span v-if="selectedSample?.assetId === sample.assetId"> · 当前选用</span>
        </p>
        <AGUIButton :disabled="pending || selectedSample?.assetId === sample.assetId || (Boolean(selectedSample) && !replaceSelected)" :aria-label="`选用音色样本 ${sample.assetId}`" data-testid="design-select-sample" @click="emit('select', sample.assetId)">
          审核并选用样本
        </AGUIButton>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ae-design-candidates,
.ae-design-samples {
  display: grid;
  gap: 8px;
  min-width: 0;
}
.ae-design-candidate,
.ae-design-sample {
  padding: 8px 0;
  border-top: 1px solid var(--agui-c-divider-light);
  min-width: 0;
}
.ae-design-candidate-title {
  margin: 0 0 4px;
  font-size: 12px;
  overflow-wrap: anywhere;
}
.ae-design-audio {
  display: block;
  margin: 8px 0;
  width: 100%;
  min-width: 0;
  height: 32px;
}
</style>
