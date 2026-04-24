<!--
  Template picker for Step 1 of the import wizard.
  Decoupled from route / wizard state — just takes a list of templates and
  a v-model, renders cards, supports a "recommended" badge on one template.

  Reusable wherever the user needs to pick a `TemplateDef`.
-->
<script setup lang="ts">
import type { TemplateDef } from '../../utils/templates/loadTemplate'
import { IonIcon } from '@ionic/vue'
import { bookOutline, briefcaseOutline, checkmarkCircle, heartOutline, sparklesOutline } from 'ionicons/icons'
import { computed } from 'vue'

const props = defineProps<{
  templates: TemplateDef[]
  modelValue: string | null
  /** Template id to highlight as "recommended". */
  recommendedId?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [id: string]
}>()

function iconFor(id: string) {
  if (id.includes('life'))
    return heartOutline
  if (id.includes('training') || id.includes('drill'))
    return briefcaseOutline
  if (id.includes('book'))
    return bookOutline
  return sparklesOutline
}

const selectedId = computed(() => props.modelValue)

function select(id: string) {
  emit('update:modelValue', id)
}
</script>

<template>
  <div class="template-picker" role="radiogroup" :aria-label="$t('importSource.pickTemplate')">
    <button
      v-for="tpl in templates"
      :key="tpl.id"
      class="template-picker__card"
      :class="{
        'is-selected': tpl.id === selectedId,
        'is-recommended': tpl.id === recommendedId,
      }"
      role="radio"
      :aria-checked="tpl.id === selectedId ? 'true' : 'false'"
      @click="select(tpl.id)"
    >
      <div class="template-picker__icon">
        <IonIcon :icon="iconFor(tpl.id)" />
      </div>
      <div class="template-picker__body">
        <div class="template-picker__title">
          {{ tpl.name }}
          <span v-if="tpl.id === recommendedId" class="template-picker__badge">
            {{ $t('importSource.recommendedBadge') }}
          </span>
        </div>
        <div class="template-picker__desc">
          {{ tpl.description }}
        </div>
      </div>
      <div v-if="tpl.id === selectedId" class="template-picker__check">
        <IonIcon :icon="checkmarkCircle" />
      </div>
    </button>
  </div>
</template>

<style scoped>
.template-picker {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--adv-space-md, 16px);
}

.template-picker__card {
  display: flex;
  align-items: flex-start;
  gap: var(--adv-space-md, 12px);
  padding: var(--adv-space-md, 16px);
  background: var(--adv-surface-card, var(--ion-background-color));
  border: 1px solid var(--adv-border-subtle, rgba(120, 120, 120, 0.15));
  border-radius: var(--adv-radius-lg, 12px);
  cursor: pointer;
  text-align: left;
  transition:
    transform var(--adv-duration-fast, 0.15s) ease-out,
    border-color var(--adv-duration-fast, 0.15s) ease-out,
    box-shadow var(--adv-duration-fast, 0.15s) ease-out;
}

.template-picker__card:hover {
  border-color: color-mix(in srgb, var(--ion-color-primary) 40%, transparent);
}

.template-picker__card.is-recommended {
  border-color: color-mix(in srgb, var(--ion-color-primary) 45%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--ion-color-primary) 20%, transparent) inset;
}

.template-picker__card.is-selected {
  border-color: var(--ion-color-primary);
  background: color-mix(in srgb, var(--ion-color-primary) 6%, var(--adv-surface-card, var(--ion-background-color)));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--ion-color-primary) 35%, transparent);
}

.template-picker__card:active {
  transform: scale(0.99);
}

.template-picker__icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--ion-color-primary) 12%, transparent);
  color: var(--ion-color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
}

.template-picker__body {
  flex: 1;
  min-width: 0;
}

.template-picker__title {
  font-weight: 600;
  font-size: 1rem;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.template-picker__badge {
  font-size: 0.65rem;
  font-weight: 500;
  padding: 2px 7px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--ion-color-primary) 15%, transparent);
  color: var(--ion-color-primary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.template-picker__desc {
  font-size: 0.8rem;
  color: var(--ion-color-medium, #92949c);
  line-height: 1.5;
}

.template-picker__check {
  font-size: 22px;
  color: var(--ion-color-primary);
  flex-shrink: 0;
}
</style>
