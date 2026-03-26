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
      Tachie Management
    </h3>

    <!-- Existing tachies -->
    <div v-if="Object.keys(tachies).length" class="flex flex-col gap-2">
      <div
        v-for="(tachie, key) in tachies"
        :key="key"
        class="flex items-center gap-3 rounded bg-dark-400 p-2"
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
      No tachies yet
    </div>

    <!-- Add new tachie -->
    <div class="flex items-end gap-2">
      <div class="flex-1">
        <div class="mb-1 text-xs op-50">
          Name
        </div>
        <AGUIInput v-model="newTachieName" placeholder="e.g. normal, angry, smile" />
      </div>
      <div class="flex-2">
        <div class="mb-1 text-xs op-50">
          Image URL
        </div>
        <AGUIInput v-model="newTachieSrc" placeholder="https://..." />
      </div>
      <AGUIButton theme="primary" icon="i-ri-add-line" :disabled="!newTachieName || !newTachieSrc" @click="addTachie" />
    </div>
  </div>
</template>
