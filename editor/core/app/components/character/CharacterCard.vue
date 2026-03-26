<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'

const props = defineProps<{
  character: AdvCharacter
}>()

defineEmits<{
  click: [character: AdvCharacter]
}>()
</script>

<template>
  <div
    class="character-card relative flex flex-col cursor-pointer gap-2 rounded-lg bg-dark-400 p-3 shadow transition-all hover:bg-dark-300 hover:shadow-lg"
    @click="$emit('click', props.character)"
  >
    <div v-if="character.avatar" class="m-auto">
      <img class="size-24 rounded-lg object-cover" :src="character.avatar" :alt="character.name">
    </div>
    <div v-else class="m-auto size-24 flex items-center justify-center rounded-lg bg-dark-200">
      <div class="i-ri-user-3-line text-3xl op-40" />
    </div>

    <div class="text-center text-sm font-bold">
      {{ character.name }}
    </div>

    <div v-if="character.faction" class="text-center text-xs op-60">
      {{ character.faction }}
    </div>

    <div v-if="character.tags?.length" class="flex flex-wrap justify-center gap-1">
      <AGUITag
        v-for="tag in character.tags.slice(0, 3)"
        :key="tag"
      >
        {{ tag }}
      </AGUITag>
    </div>

    <div v-if="character.personality" class="line-clamp-2 text-xs op-50">
      {{ character.personality }}
    </div>
  </div>
</template>
