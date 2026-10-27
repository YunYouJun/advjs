<script setup lang="ts">
import type { VoiceDesignPreview, VoiceDesignSample } from '@advjs/types'
import AGUICheckbox from '@advjs/gui/client/components/AGUICheckbox.vue'
import AGUIDetails from '@advjs/gui/client/components/AGUIDetails.vue'
import AGUIButton from '@advjs/gui/client/components/button/AGUIButton.vue'
import AGUITag from '@advjs/gui/client/components/tag/AGUITag.vue'
import { computed, shallowRef } from 'vue'
import AEAudioPlayer from './AEAudioPlayer.vue'
import AEVoiceTranscript from './AEVoiceTranscript.vue'

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
  'sample': [sample: VoiceDesignSample]
  'register': [preview: VoiceDesignPreview]
  'cancel': [preview: VoiceDesignPreview]
  'select': [assetId: string]
  'stop': []
  'playbackBlocked': []
  'update:replaceSelected': [value: boolean]
}>()
const playbackTime = shallowRef(0)
const savedPreviews = computed(() => new Set(props.previews.flatMap(preview => preview.registeredAssetId && props.samples.some(sample => sample.assetId === preview.registeredAssetId) ? [preview.id] : [])))
const playingSampleId = computed(() => props.previews.find(preview => preview.id === props.playingPreviewId)?.registeredAssetId ?? props.playingPreviewId)
const playingTranscript = computed(() => props.source ? props.samples.find(sample => sample.assetId === playingSampleId.value) ?? props.previews.find(preview => preview.id === props.playingPreviewId)?.candidate : undefined)
const statuses: Record<VoiceDesignPreview['status'], string> = { queued: '等待执行', running: '生成中', ready: '未登记候选', registered: '已登记样本', cancelled: '已取消', failed: '生成失败', unknown: '调用结果未知，须先查询' }
const sources: Record<VoiceDesignSample['source'], string> = { system: '系统音色', designed: '设计音色', cloned: '克隆音色' }
</script>

<template>
  <section class="ae-design-candidates" aria-label="音色候选与样本审核">
    <div v-if="source" class="ae-design-playback" :data-preview-id="playingPreviewId">
      <AEAudioPlayer :src="source" label="音色候选试听" title="音色试听" autoplay @timeupdate="playbackTime = $event" @playback-blocked="emit('playbackBlocked')">
        <AEVoiceTranscript v-if="playingTranscript" :text="playingTranscript.text" :alignment="playingTranscript.alignment" :time="playbackTime" follow />
      </AEAudioPlayer>
      <AGUIButton :disabled="pending" data-testid="design-stop-audition" @click="emit('stop')">
        停止试听
      </AGUIButton>
    </div>
    <p v-if="!previews.length && !samples.length" class="ae-resource-caption">
      生成后可直接试听未登记候选。登记样本、审核选用与应用角色分别确认。
    </p>
    <div v-for="preview in previews" :key="preview.id" class="ae-design-candidate" :data-testid="`design-preview-${preview.status}`">
      <p class="ae-design-candidate-title">
        <AGUITag :tone="preview.status === 'failed' || preview.status === 'unknown' ? 'warning' : preview.status === 'registered' ? 'success' : 'neutral'">
          {{ statuses[preview.status] }}
        </AGUITag>
      </p>
      <p v-if="preview.candidate && !savedPreviews.has(preview.id)" class="ae-resource-caption">
        {{ preview.candidate.model }} · {{ preview.candidate.durationSeconds.toFixed(2) }} 秒 · {{ preview.candidate.bytes }} 字节
      </p>
      <AEVoiceTranscript v-if="preview.candidate && !savedPreviews.has(preview.id) && !(source && playingPreviewId === preview.id && playingTranscript)" :text="preview.candidate.text" :alignment="preview.candidate.alignment" />
      <p v-if="preview.status === 'unknown'" class="ae-resource-caption" role="status">
        查询当前状态后再处理，重新打开面板不会再次调用供应商。
      </p>
      <div class="ae-resource-actions">
        <AGUIButton v-if="preview.status === 'ready' || (preview.status === 'registered' && !savedPreviews.has(preview.id))" :disabled="pending" :aria-label="`试听候选 ${preview.id}`" data-testid="design-audition" @click="emit('audition', preview)">
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
    <div v-if="samples.length" class="ae-design-samples">
      <AGUICheckbox v-if="selectedSample" :checked="replaceSelected" :disabled="pending" label="我确认替换当前语言／供应商的已选音色样本" data-testid="design-replace-sample" @update:checked="emit('update:replaceSelected', $event)" />
      <div v-for="sample in samples" :key="sample.assetId" class="ae-design-sample" data-testid="design-sample">
        <p class="ae-design-candidate-title">
          <span>音色样本 · {{ sample.locale }}</span>
          <AGUITag v-if="selectedSample?.assetId === sample.assetId" tone="success">
            当前选用
          </AGUITag>
        </p>
        <p class="ae-resource-caption">
          {{ sample.providerId }} · {{ sources[sample.source] }}
        </p>
        <AEVoiceTranscript v-if="!(source && playingSampleId === sample.assetId && playingTranscript)" :text="sample.text" :alignment="sample.alignment" />
        <div class="ae-resource-actions">
          <AGUIButton :disabled="pending" :aria-label="`试听音色样本 ${sample.assetId}`" data-testid="design-audition-sample" @click="emit('sample', sample)">
            试听已登记样本
          </AGUIButton>
          <AGUIButton :disabled="pending || selectedSample?.assetId === sample.assetId || (Boolean(selectedSample) && !replaceSelected)" :aria-label="`选用音色样本 ${sample.assetId}`" data-testid="design-select-sample" @click="emit('select', sample.assetId)">
            审核并选用样本
          </AGUIButton>
        </div>
        <AGUIDetails title="样本来源与校验信息">
          <p class="ae-resource-caption">
            {{ sample.assetId }}
          </p>
          <p class="ae-resource-caption">
            SHA-256: {{ sample.sha256 }}
          </p>
        </AGUIDetails>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ae-design-candidates,
.ae-design-samples {
  display: grid;
  gap: var(--agui-space-2);
  min-width: 0;
}
.ae-design-candidate,
.ae-design-sample {
  display: grid;
  gap: var(--agui-space-2);
  padding: var(--agui-space-3) 0;
  border-top: 1px solid var(--agui-c-divider-light);
  min-width: 0;
}
.ae-design-candidate-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--agui-space-2);
  margin: 0;
  font-size: var(--agui-font-size-title);
  font-weight: 600;
  overflow-wrap: anywhere;
}
.ae-design-playback {
  display: grid;
  gap: var(--agui-space-2);
}
</style>
