<script setup lang="ts">
import AGUISlider from '@advjs/gui/client/components/AGUISlider.vue'
import AGUIButton from '@advjs/gui/client/components/button/AGUIButton.vue'
import AGUIPopover from '@advjs/gui/client/components/popover/AGUIPopover.vue'
import { computed, nextTick, onBeforeUnmount, shallowRef, useTemplateRef, watch } from 'vue'

const props = defineProps<{ label: string, volume: number, muted: boolean, compact: boolean, resetKey?: string }>()
const emit = defineEmits<{ volume: [value: number], mute: [] }>()
const root = useTemplateRef<HTMLElement>('root')
const panel = useTemplateRef<HTMLElement>('panel')
const open = shallowRef(false)
const percent = computed(() => props.muted ? 0 : Math.round(props.volume * 100))
const icon = computed(() => props.muted || props.volume === 0 ? 'i-ri-volume-mute-line' : 'i-ri-volume-up-line')
const muteLabel = computed(() => `${props.muted ? '取消静音' : '静音'}${props.label}`)
let disposed = false
let focusTransition = 0

function setVolume(value: number) {
  emit('volume', value / 100)
}
function closeAutoFocus(event: Event) {
  if (!props.compact || disposed)
    event.preventDefault()
}
watch(() => props.compact, async () => {
  const current = ++focusTransition
  const active = document.activeElement
  const restore = Boolean(active && (root.value?.contains(active) || panel.value?.contains(active)))
  open.value = false
  await nextTick()
  if (!disposed && current === focusTransition && restore)
    root.value?.querySelector('button')?.focus()
})
watch(() => props.resetKey, () => open.value = false)
onBeforeUnmount(() => disposed = true)
</script>

<template>
  <div ref="root" class="ae-audio-volume" :class="{ 'is-compact': compact }">
    <AGUIPopover v-if="compact" v-model:open="open" :label="`${label}音量设置`" @close-auto-focus="closeAutoFocus">
      <template #trigger>
        <AGUIButton variant="text" :icon="icon" :aria-label="`${label}音量设置`" :title="`音量 ${percent}%，点击调整`" data-testid="player-volume-trigger" />
      </template>
      <div ref="panel" class="ae-volume-panel">
        <span class="ae-volume-percent" aria-hidden="true">{{ percent }}%</span>
        <AGUISlider variant="media" orientation="vertical" :model-value="percent" :min="0" :max="100" :step="1" :label="`${label}音量`" :aria-valuetext="`${percent}%`" @update:model-value="setVolume" />
        <AGUIButton variant="text" :icon="icon" :aria-label="muteLabel" :aria-pressed="muted" @click="emit('mute')">
          {{ muted ? '恢复声音' : '静音' }}
        </AGUIButton>
      </div>
    </AGUIPopover>
    <template v-else>
      <AGUIButton variant="text" :icon="icon" :aria-label="muteLabel" :aria-pressed="muted" @click="emit('mute')" />
      <AGUISlider class="ae-volume-inline" variant="media" :model-value="percent" :min="0" :max="100" :step="1" :label="`${label}音量`" :aria-valuetext="`${percent}%`" @update:model-value="setVolume" />
    </template>
  </div>
</template>

<style scoped>
.ae-audio-volume {
  display: flex;
  align-items: center;
  gap: var(--agui-space-2);
  min-width: 144px;
}
.ae-audio-volume.is-compact {
  min-width: 0;
}
.ae-volume-inline {
  flex: 1 1 112px;
  width: auto;
  min-width: 112px;
}
.ae-volume-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--agui-space-2);
}
.ae-volume-percent {
  color: var(--agui-c-text-2);
  font-size: var(--agui-font-size-caption);
  font-variant-numeric: tabular-nums;
}
</style>
