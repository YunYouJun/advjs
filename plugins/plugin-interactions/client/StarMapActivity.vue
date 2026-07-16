<script setup lang="ts">
import type { AdvActivityRendererEmits, AdvActivityRendererProps } from '@advjs/client'
import { shallowRef, watch } from 'vue'
import './style.css'

const props = defineProps<AdvActivityRendererProps>()
const emit = defineEmits<AdvActivityRendererEmits>()

const score = shallowRef(initialScore())

watch(() => props.activity.id, () => {
  score.value = initialScore()
})

function initialScore(): number {
  const tolerance = props.activity.input.tolerance
  return typeof tolerance === 'number' ? clamp(tolerance) : 0.9
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
}

function complete(matched: boolean) {
  emit('complete', { matched, score: clamp(Number(score.value)) })
}
</script>

<template>
  <div class="interaction-activity">
    <h2 class="interaction-activity__title">
      星图比对
    </h2>
    <p class="interaction-activity__description">
      观察星点分布，然后提交比对结果。
    </p>
    <label class="interaction-activity__field">
      <span>相似度</span>
      <input v-model.number="score" type="range" min="0" max="1" step="0.01">
      <output>{{ Number(score).toFixed(2) }}</output>
    </label>
    <div class="interaction-activity__actions">
      <button type="button" @click="emit('back')">
        返回
      </button>
      <button type="button" @click="complete(false)">
        未匹配
      </button>
      <button type="button" @click="complete(true)">
        确认匹配
      </button>
    </div>
  </div>
</template>
