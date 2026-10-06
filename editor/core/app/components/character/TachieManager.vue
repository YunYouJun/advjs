<script setup lang="ts">
import type { AdvCharacter, AdvTachie } from '@advjs/types'
import { computed, ref, useId, watch } from 'vue'
import '../../styles/resource-panel.scss'

const props = defineProps<{ character: AdvCharacter }>()
const emit = defineEmits<{ update: [tachies: Record<string, AdvTachie>] }>()
const fieldId = useId()
const newTachieName = ref('')
const newTachieSrc = ref('')
const tachies = computed(() => props.character.tachies ?? {})
const duplicate = computed(() => Object.hasOwn(tachies.value, newTachieName.value.trim()))
const canAdd = computed(() => !!newTachieName.value.trim() && !!newTachieSrc.value.trim() && !duplicate.value)
watch(() => props.character.id, () => {
  newTachieName.value = ''
  newTachieSrc.value = ''
})

function addTachie() {
  if (!canAdd.value)
    return
  emit('update', { ...tachies.value, [newTachieName.value.trim()]: { src: newTachieSrc.value.trim() } })
  newTachieName.value = ''
  newTachieSrc.value = ''
}
function removeTachie(key: string) {
  const next = { ...tachies.value }
  delete next[key]
  emit('update', next)
}
</script>

<template>
  <AGUIDetails class="ae-resource-panel" :title="$t('characters.detail.tachies')" open>
    <ul v-if="Object.keys(tachies).length" class="ae-resource-list">
      <li v-for="(tachie, key) in tachies" :key="key" class="ae-resource-row">
        <img v-if="tachie" class="ae-resource-thumb" :src="tachie.src" :alt="String(key)" loading="lazy">
        <div class="ae-resource-meta">
          <div class="ae-resource-name">
            {{ key }}
          </div>
          <div class="ae-resource-caption">
            {{ tachie?.src }}
          </div>
        </div>
        <AGUIIconButton icon="i-ri-delete-bin-line" :title="$t('characters.tachie.remove', { name: key })" @click="removeTachie(String(key))" />
      </li>
    </ul>
    <p v-else class="ae-resource-empty">
      {{ $t('characters.tachie.empty') }}
    </p>
    <form class="ae-resource-form" @submit.prevent="addTachie">
      <AGUIProperty :for="`${fieldId}-name`" :label="$t('characters.tachie.name')">
        <AGUIInput :id="`${fieldId}-name`" v-model="newTachieName" :aria-invalid="duplicate || undefined" :aria-describedby="duplicate ? `${fieldId}-error` : undefined" placeholder="normal, angry, smile" />
      </AGUIProperty>
      <AGUIProperty :for="`${fieldId}-src`" :label="$t('characters.tachie.src')">
        <AGUIInput :id="`${fieldId}-src`" v-model="newTachieSrc" placeholder="/tachies/normal.png" />
      </AGUIProperty>
      <p v-if="duplicate" :id="`${fieldId}-error`" class="ae-resource-error" role="alert">
        {{ $t('characters.tachie.duplicate') }}
      </p>
      <div class="ae-resource-actions">
        <AGUIButton type="submit" icon="i-ri-add-line" :disabled="!canAdd">
          {{ $t('characters.tachie.add') }}
        </AGUIButton>
      </div>
    </form>
  </AGUIDetails>
</template>
