<script setup lang="ts">
import type { VoiceAlignment } from '@advjs/types'
import { voiceAlignmentUnitAt, voiceAlignmentUnresolvedCharacters } from '@advjs/audio'
import { computed } from 'vue'

const props = defineProps<{ text: string, alignment?: VoiceAlignment, time?: number }>()
const parts = computed(() => {
  let start = 0
  return [...props.text].map((text) => {
    const part = { text, start, end: start + text.length }
    start = part.end
    return part
  })
})
const active = computed(() => props.alignment?.text === props.text && props.time !== undefined ? voiceAlignmentUnitAt(props.alignment, props.time) : undefined)
const unresolved = computed(() => props.alignment?.text === props.text ? voiceAlignmentUnresolvedCharacters(props.alignment) : 0)
</script>

<template>
  <p class="ae-voice-transcript" :data-alignment="alignment ? 'available' : undefined" aria-label="配音文本">
    <span v-for="part in parts" :key="part.start" :class="{ active: active && part.start >= active.start && part.start < active.end }" :data-voice-active="active && part.start >= active.start && part.start < active.end || undefined">{{ part.text }}</span>
    <small v-if="unresolved" class="ae-voice-timing-note">{{ unresolved }} 个字未精确定位，其余按实际时间高亮</small>
  </p>
</template>

<style scoped>
.ae-voice-transcript {
  font-size: 13px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.6;
}
.active {
  background: var(--agui-c-selection);
  color: var(--agui-c-selection-text);
  text-decoration: underline;
  text-underline-offset: 0.15em;
}
.ae-voice-timing-note {
  display: block;
  margin-top: 6px;
  color: var(--agui-c-text-2);
  font-size: 11px;
}
</style>
