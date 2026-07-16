<script setup lang="ts">
import type { AdvActivityRendererEmits, AdvActivityRendererProps } from '@advjs/client'
import { computed, shallowRef, watch } from 'vue'
import './style.css'

const props = defineProps<AdvActivityRendererProps>()
const emit = defineEmits<AdvActivityRendererEmits>()

const name = shallowRef('')
const level = shallowRef(1)
const principle = shallowRef('curiosity')
const principles = computed(() => {
  const value = props.activity.input.principles
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item))
    : []
})

watch(() => props.activity.id, reset, { immediate: true })

function reset() {
  const input = props.activity.input
  name.value = typeof input.suggestedName === 'string' ? input.suggestedName : 'Seed'
  level.value = typeof input.defaultLevel === 'number' ? Math.max(1, Math.trunc(input.defaultLevel)) : 1
  principle.value = principles.value[0] ?? 'curiosity'
}

function submit() {
  emit('complete', {
    name: name.value.trim() || 'Seed',
    level: Math.max(1, Math.trunc(Number(level.value) || 1)),
    principle: principle.value,
  })
}
</script>

<template>
  <form class="interaction-activity" @submit.prevent="submit">
    <h2 class="interaction-activity__title">
      文明初始化
    </h2>
    <label class="interaction-activity__field">
      <span>名称</span>
      <input v-model="name" type="text" autocomplete="off">
    </label>
    <label class="interaction-activity__field">
      <span>等级</span>
      <input v-model.number="level" type="number" min="1">
    </label>
    <label class="interaction-activity__field">
      <span>核心原则</span>
      <select v-model="principle">
        <option v-for="item in principles" :key="item" :value="item">
          {{ item }}
        </option>
      </select>
    </label>
    <div class="interaction-activity__actions">
      <button type="button" @click="emit('back')">
        返回
      </button>
      <button type="submit">
        初始化
      </button>
    </div>
  </form>
</template>
