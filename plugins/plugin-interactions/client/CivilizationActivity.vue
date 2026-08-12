<script setup lang="ts">
import type { AdvActivityRendererEmits, AdvActivityRendererProps } from '@advjs/client'
import { computed, ref, watch } from 'vue'
import './style.css'

const props = defineProps<AdvActivityRendererProps>()
const emit = defineEmits<AdvActivityRendererEmits>()
const name = ref('')
const level = ref(1)
const principle = ref('curiosity')
const principles = computed(() => {
  const value = props.activity.input.principles
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item))
    : []
})
const principleLabels: Record<string, string> = {
  curiosity: '好奇',
  memory: '记忆',
  empathy: '共情',
  survival: '生存',
  cooperation: '协作',
}

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
  <form class="interaction-activity civilization-activity" @submit.prevent="submit">
    <header class="interaction-activity__header">
      <div>
        <p class="interaction-activity__eyebrow">
          CREATURE PROTOCOL
        </p>
        <h2 class="interaction-activity__title">
          文明播种协议
        </h2>
      </div>
      <span class="civilization-activity__level">LV.{{ level }}</span>
    </header>

    <div class="civilization-activity__body">
      <div class="civilization-activity__form">
        <label class="interaction-activity__field">
          <span>文明名称</span>
          <input v-model="name" type="text" autocomplete="off" maxlength="24">
        </label>

        <fieldset>
          <legend>核心原则</legend>
          <div class="civilization-activity__principles">
            <button
              v-for="item in principles"
              :key="item"
              type="button"
              :class="{ active: principle === item }"
              @click="principle = item"
            >
              <b>{{ principleLabels[item] || item }}</b>
              <small>{{ item }}</small>
            </button>
          </div>
        </fieldset>

        <label class="interaction-activity__field">
          <span>初始演化等级</span>
          <input v-model.number="level" type="number" min="1" max="9">
        </label>
      </div>

      <aside class="civilization-activity__preview">
        <span>SEED PREVIEW</span>
        <div class="civilization-activity__orb" />
        <h3>{{ name || 'Seed' }}</h3>
        <p>{{ principleLabels[principle] || principle }} · 等级 {{ level }}</p>
      </aside>
    </div>

    <div class="interaction-activity__actions">
      <button type="button" class="secondary" @click="emit('back')">
        返回
      </button>
      <button type="submit">
        执行初始化
      </button>
    </div>
  </form>
</template>
