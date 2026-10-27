<script setup lang="ts">
import type { VoiceReviewRow } from '@advjs/audio'
import { compareVoiceListeningCandidates, voiceListeningCandidate } from '@advjs/audio'
import AGUIProperty from '@advjs/gui/client/components/AGUIProperty.vue'
import AGUIButton from '@advjs/gui/client/components/button/AGUIButton.vue'
import AGUISelect from '@advjs/gui/client/components/select/AGUISelect.vue'
import { computed, shallowRef, watch } from 'vue'

const props = defineProps<{ row?: VoiceReviewRow, takeId: string, previewTakeId: string, loading: boolean, pending: boolean }>()
const emit = defineEmits<{ preview: [takeId: string], inspect: [takeId: string], stop: [] }>()
const leftId = shallowRef('')
const rightId = shallowRef('')
const comparison = computed(() => compareVoiceListeningCandidates((props.row?.takes ?? []).map(take => voiceListeningCandidate(props.row!, take.id))))
const group = computed(() => comparison.value.groups.find(group => group.candidates.some(candidate => candidate.takeId === props.takeId)))
const candidates = computed(() => group.value?.candidates.filter(candidate => !candidate.unavailable) ?? [])
const options = computed(() => candidates.value.map(candidate => ({ value: candidate.takeId, label: `${candidate.takeId === props.row?.selectedTake ? '已选 · ' : ''}${props.row?.takes.find(take => take.id === candidate.takeId)?.createdAt ?? candidate.takeId}${candidate.stale ? ' · 待复审' : ''}` })))
const canCompare = computed(() => candidates.value.length >= 2)
watch([() => props.row, () => props.takeId], () => {
  leftId.value = candidates.value.find(candidate => candidate.takeId === props.row?.selectedTake)?.takeId ?? candidates.value[0]?.takeId ?? ''
  rightId.value = candidates.value.find(candidate => candidate.takeId === props.takeId && candidate.takeId !== leftId.value)?.takeId ?? candidates.value.find(candidate => candidate.takeId !== leftId.value)?.takeId ?? ''
}, { immediate: true })
watch([leftId, rightId], () => emit('stop'))
</script>

<template>
  <section class="ae-voice-compare" aria-label="同文 A/B 配音对比">
    <p class="ae-compare-heading">
      同文 A/B 对比
    </p>
    <p v-if="!canCompare" class="ae-resource-caption" role="status">
      至少需要两份同对白、语言、说话人与实际口语文本的可用 take。不同文本的历史配音仍可单独试听。
    </p>
    <template v-else>
      <p class="ae-resource-caption">
        共 {{ candidates.length }} 份同文配音，分别试听后选择审核对象。
      </p>
      <div v-for="slot in ['A', 'B']" :key="slot" class="ae-compare-slot">
        <AGUIProperty :label="`候选 ${slot}`">
          <AGUISelect v-if="slot === 'A'" v-model="leftId" :options="options" label="对比候选 A" :disabled="pending" />
          <AGUISelect v-else v-model="rightId" :options="options" label="对比候选 B" :disabled="pending" />
        </AGUIProperty>
        <div class="ae-resource-actions">
          <AGUIButton :loading="loading && previewTakeId === (slot === 'A' ? leftId : rightId)" :disabled="pending || !(slot === 'A' ? leftId : rightId)" :data-testid="`compare-play-${slot.toLowerCase()}`" @click="emit('preview', slot === 'A' ? leftId : rightId)">
            试听 {{ slot }}
          </AGUIButton>
          <AGUIButton :disabled="pending" :data-testid="`compare-inspect-${slot.toLowerCase()}`" @click="emit('inspect', slot === 'A' ? leftId : rightId)">
            审核 {{ slot }}
          </AGUIButton>
        </div>
      </div>
      <p v-if="leftId === rightId" class="ae-resource-caption" role="status">
        A 与 B 当前为同一份配音；更换其中一个候选后比较。
      </p>
    </template>
  </section>
</template>

<style scoped>
.ae-voice-compare {
  min-width: 0;
  border-block: 1px solid var(--agui-c-divider);
  padding-block: var(--agui-space-2);
}
.ae-compare-heading {
  margin: 0;
  font-size: var(--agui-font-size-body);
  font-weight: 500;
}
.ae-compare-slot {
  min-width: 0;
  margin-block: var(--agui-space-2);
}
.ae-compare-slot .ae-resource-actions {
  margin-top: var(--agui-space-1);
}
</style>
