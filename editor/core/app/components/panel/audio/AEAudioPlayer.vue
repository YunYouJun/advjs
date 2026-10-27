<script setup lang="ts">
import AGUISlider from '@advjs/gui/client/components/AGUISlider.vue'
import AGUIButton from '@advjs/gui/client/components/button/AGUIButton.vue'
import AGUISelect from '@advjs/gui/client/components/select/AGUISelect.vue'
import AGUITag from '@advjs/gui/client/components/tag/AGUITag.vue'
import { nextTick, reactive, useId, useTemplateRef, watch } from 'vue'
import { useAudioTransport } from '../../../composables/useAudioTransport'

const props = withDefaults(defineProps<{ src: string, label: string, title?: string, autoplay?: boolean }>(), { title: '配音试听', autoplay: false })
const emit = defineEmits<{ timeupdate: [seconds: number], error: [], playbackBlocked: [] }>()
const audio = useTemplateRef<HTMLAudioElement>('audio')
const transport = reactive(useAudioTransport(audio))
const id = useId()
const speeds = [0.75, 1, 1.25, 1.5, 2].map(value => ({ value, label: `${value}×` }))
const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
async function play() {
  if (!await transport.play() && transport.error)
    emit('playbackBlocked')
}
function toggle() {
  if (transport.paused)
    void play()
  else
    transport.pause()
}
watch(() => transport.time, seconds => emit('timeupdate', seconds), { immediate: true })
watch(() => props.src, async (source) => {
  transport.reset()
  emit('timeupdate', 0)
  await nextTick()
  if (source && props.src === source && props.autoplay)
    await play()
}, { immediate: true })
defineExpose({ play, pause: transport.pause })
</script>

<template>
  <section class="ae-audio-player" role="group" :aria-label="`${label}播放控制`">
    <audio :id="id" ref="audio" :src="src" :aria-label="label" preload="metadata" @error="emit('error')" />
    <div class="ae-player-heading">
      <span class="ae-player-title">{{ title }}</span>
      <AGUITag :tone="transport.waiting || !transport.paused ? 'info' : 'neutral'">
        {{ transport.waiting ? '正在载入' : transport.paused ? '已暂停' : '正在播放' }}
      </AGUITag>
    </div>
    <div v-if="$slots.default" class="ae-player-transcript">
      <slot />
    </div>
    <AGUISlider variant="media" :model-value="transport.time" :min="0" :max="transport.duration || 1" :step="0.01" :disabled="!transport.duration" :label="`${label}播放进度（秒）`" :aria-describedby="`${id}-time`" @update:model-value="transport.seek" />
    <div :id="`${id}-time`" class="ae-player-time">
      <span>{{ formatTime(transport.time) }}</span>
      <span>{{ transport.duration ? formatTime(transport.duration) : '—:—' }}</span>
    </div>
    <div class="ae-player-controls">
      <div class="ae-player-transport">
        <AGUIButton variant="text" icon="i-ri-replay-5-line" :aria-label="`${label}后退5秒`" :disabled="!transport.duration" @click="transport.skip(-5)" />
        <AGUIButton class="ae-player-play" theme="primary" :icon="transport.paused ? 'i-ri-play-fill' : 'i-ri-pause-fill'" :aria-label="`${transport.paused ? '播放' : '暂停'}${label}`" :aria-controls="id" :disabled="!src" @click="toggle" />
        <AGUIButton variant="text" icon="i-ri-forward-5-line" :aria-label="`${label}前进5秒`" :disabled="!transport.duration" @click="transport.skip(5)" />
      </div>
      <div class="ae-player-options">
        <AGUIButton variant="text" :icon="transport.muted || transport.volume === 0 ? 'i-ri-volume-mute-line' : 'i-ri-volume-up-line'" :aria-label="`${transport.muted ? '取消静音' : '静音'}${label}`" :aria-pressed="transport.muted" @click="transport.toggleMute" />
        <AGUISlider class="ae-player-volume" variant="media" :model-value="transport.muted ? 0 : transport.volume" :min="0" :max="1" :step="0.05" :label="`${label}音量`" @update:model-value="transport.setVolume" />
        <AGUISelect class="ae-player-speed" :model-value="transport.rate" :options="speeds" :label="`${label}播放速度`" @update:model-value="transport.setRate" />
      </div>
    </div>
    <p v-if="transport.error" class="ae-player-error" role="status">
      {{ transport.error }}
    </p>
  </section>
</template>

<style scoped>
.ae-audio-player {
  container: audio-player / inline-size;
  min-width: 0;
  padding: var(--agui-space-3);
  border: 1px solid var(--agui-c-divider-light);
  border-radius: var(--agui-radius-md);
  background: var(--agui-c-field);
  color: var(--agui-c-text-1);
}
.ae-player-heading,
.ae-player-time,
.ae-player-controls,
.ae-player-transport,
.ae-player-options {
  display: flex;
  align-items: center;
}
.ae-player-heading,
.ae-player-time,
.ae-player-controls {
  justify-content: space-between;
  gap: var(--agui-space-2);
}
.ae-player-title {
  font-size: var(--agui-font-size-title);
  font-weight: 600;
}
.ae-player-transcript {
  margin-block: var(--agui-space-3) var(--agui-space-2);
}
.ae-player-time {
  color: var(--agui-c-text-2);
  font-size: var(--agui-font-size-caption);
}
.ae-player-time {
  font-variant-numeric: tabular-nums;
  margin-top: -2px;
}
.ae-player-controls {
  margin-top: var(--agui-space-2);
  flex-wrap: wrap;
}
.ae-player-transport {
  gap: var(--agui-space-2);
}
.ae-player-play {
  --border-radius: 50%;
  width: 40px;
  height: 40px;
  padding: 0;
}
.ae-player-play :deep(.agui-button-icon) {
  width: 20px;
  height: 20px;
}
.ae-player-options {
  gap: var(--agui-space-1);
}
.ae-player-volume {
  width: 72px;
}
.ae-player-speed {
  width: 62px;
  min-width: 62px;
}
.ae-player-error {
  font-size: var(--agui-font-size-body);
  color: var(--agui-c-warning-text);
  margin: var(--agui-space-2) 0 0;
}
@container audio-player (max-width: 300px) {
  .ae-player-volume {
    display: none;
  }
}
</style>
