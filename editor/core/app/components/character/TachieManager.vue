<script setup lang="ts">
import type { AdvCharacter, AdvTachie } from '@advjs/types'

const props = defineProps<{
  character: AdvCharacter
}>()

const emit = defineEmits<{
  update: [tachies: Record<string, AdvTachie>]
}>()

const tachies = ref<Record<string, AdvTachie>>({ ...props.character.tachies })
const newTachieName = ref('')
const newTachieSrc = ref('')

function addTachie() {
  if (!newTachieName.value || !newTachieSrc.value)
    return

  tachies.value[newTachieName.value] = {
    src: newTachieSrc.value,
  }
  emit('update', { ...tachies.value })
  newTachieName.value = ''
  newTachieSrc.value = ''
}

function removeTachie(key: string) {
  delete tachies.value[key]
  tachies.value = { ...tachies.value }
  emit('update', { ...tachies.value })
}
</script>

<template>
  <div class="tachie-manager flex flex-col gap-3">
    <h3 class="text-sm font-bold op-60">
      {{ $t('characters.tachie.title') }}
    </h3>

    <!-- Existing tachies -->
    <div v-if="Object.keys(tachies).length" class="flex flex-col gap-2">
      <div
        v-for="(tachie, key) in tachies"
        :key="key"
        class="p-2 rounded bg-dark-400 flex gap-3 items-center"
      >
        <img v-if="tachie" class="h-16 object-contain" :src="tachie.src" :alt="String(key)">
        <div class="flex-1">
          <div class="text-sm font-bold">
            {{ key }}
          </div>
          <div class="text-xs op-50">
            {{ tachie?.src }}
          </div>
        </div>
        <AGUIButton theme="danger" variant="text" icon="i-ri-delete-bin-line" @click="removeTachie(String(key))" />
      </div>
    </div>

    <div v-else class="text-sm op-40">
      {{ $t('characters.tachie.empty') }}
    </div>

    <!-- Add new tachie -->
    <div class="flex gap-2 items-end">
      <div class="flex-1">
        <div class="text-xs mb-1 op-50">
          {{ $t('characters.form.name') }}
        </div>
        <AGUIInput v-model="newTachieName" :placeholder="$t('characters.tachie.namePlaceholder')" />
      </div>
      <div class="flex-2">
        <div class="text-xs mb-1 op-50">
          {{ $t('characters.tachie.image') }}
        </div>
        <AGUIInput v-model="newTachieSrc" placeholder="https://..." />
      </div>
      <AGUIButton theme="primary" icon="i-ri-add-line" :disabled="!newTachieName || !newTachieSrc" @click="addTachie" />
    </div>
  </div>
</template>
