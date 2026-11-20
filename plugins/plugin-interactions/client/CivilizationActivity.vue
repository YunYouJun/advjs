<script setup lang="ts">
import type { AdvActivityRendererEmits, AdvActivityRendererProps } from '@advjs/client'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { activityMessages } from './messages'
import './style.css'

const props = defineProps<AdvActivityRendererProps>()
const emit = defineEmits<AdvActivityRendererEmits>()
const { locale, t } = useI18n({ useScope: 'local', messages: activityMessages })
const name = ref('')
const level = ref(1)
const principle = ref('curiosity')
const principles = computed(() => {
  const value = props.activity.input.principles
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item))
    : []
})
function principleLabel(value: string) {
  return Object.hasOwn(activityMessages.en.civilization.labels, value)
    ? t(`civilization.labels.${value}`)
    : value
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
  <form class="interaction-activity civilization-activity" :lang="locale" @submit.prevent="submit">
    <header class="interaction-activity__header">
      <div>
        <p class="interaction-activity__eyebrow">
          {{ t('civilization.instrument') }}
        </p>
        <h2 class="interaction-activity__title">
          {{ t('civilization.title') }}
        </h2>
      </div>
      <span class="civilization-activity__level">{{ t('civilization.levelBadge', { level }) }}</span>
    </header>

    <div class="civilization-activity__body">
      <div class="civilization-activity__form">
        <label class="interaction-activity__field">
          <span>{{ t('civilization.name') }}</span>
          <input v-model="name" type="text" autocomplete="off" maxlength="24">
        </label>

        <fieldset>
          <legend>{{ t('civilization.principles') }}</legend>
          <div class="civilization-activity__principles">
            <button
              v-for="item in principles"
              :key="item"
              type="button"
              :class="{ active: principle === item }"
              :aria-pressed="principle === item"
              @click="principle = item"
            >
              <b>{{ principleLabel(item) }}</b>
            </button>
          </div>
        </fieldset>

        <label class="interaction-activity__field">
          <span>{{ t('civilization.level') }}</span>
          <input v-model.number="level" type="number" min="1" max="9">
        </label>
      </div>

      <aside class="civilization-activity__preview">
        <span>{{ t('civilization.preview') }}</span>
        <div class="civilization-activity__orb" />
        <h3>{{ name || 'Seed' }}</h3>
        <p>{{ t('civilization.previewDetails', { principle: principleLabel(principle), level }) }}</p>
      </aside>
    </div>

    <div class="interaction-activity__actions">
      <button type="button" class="secondary" @click="emit('back')">
        {{ t('back') }}
      </button>
      <button type="submit">
        {{ t('civilization.initialize') }}
      </button>
    </div>
  </form>
</template>
