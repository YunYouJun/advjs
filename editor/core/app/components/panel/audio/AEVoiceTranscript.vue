<script setup lang="ts">
import type { VoiceAlignment } from '@advjs/types'
import { voiceAlignmentUnitAt, voiceAlignmentUnresolvedCharacters } from '@advjs/audio'
import { computed, useTemplateRef, watch } from 'vue'

const props = defineProps<{ text: string, alignment?: VoiceAlignment, time?: number, follow?: boolean }>()
const transcript = useTemplateRef<HTMLParagraphElement>('transcript')
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
watch([active, () => props.follow], () => {
  const element = transcript.value
  const current = element?.querySelector<HTMLElement>('[data-voice-active]')
  if (!props.follow || !element || !current)
    return
  const bounds = element.getBoundingClientRect()
  const word = current.getBoundingClientRect()
  if (word.top < bounds.top)
    element.scrollTop -= bounds.top - word.top
  else if (word.bottom > bounds.top + element.clientHeight)
    element.scrollTop += word.bottom - bounds.top - element.clientHeight
}, { flush: 'post' })
</script>

<template>
  <p ref="transcript" class="ae-voice-transcript" :class="{ 'ae-voice-transcript--follow': follow }" :data-alignment="alignment ? 'available' : undefined" :tabindex="follow ? 0 : undefined" aria-label="配音文本">
    <span v-for="part in parts" :key="part.start" :class="{ active: active && part.start >= active.start && part.start < active.end }" :data-voice-active="active && part.start >= active.start && part.start < active.end || undefined">{{ part.text }}</span>
    <small v-if="unresolved" class="ae-voice-timing-note">{{ unresolved }} 个字未精确定位，其余按实际时间高亮</small>
  </p>
</template>

<style scoped>
.ae-voice-transcript {
  margin: 0;
  font-size: var(--agui-font-size-reading);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: var(--agui-line-height-reading);
}
.ae-voice-transcript--follow {
  max-height: 12.25em;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}
.ae-voice-transcript--follow:focus-visible {
  outline: 2px solid var(--agui-c-focus);
  outline-offset: 2px;
}
.active {
  background: var(--agui-c-selection);
  color: var(--agui-c-selection-text);
  text-decoration: underline;
  text-underline-offset: 0.15em;
}
.ae-voice-timing-note {
  display: block;
  margin-top: var(--agui-space-2);
  color: var(--agui-c-text-2);
  font-size: var(--agui-font-size-caption);
}
</style>
