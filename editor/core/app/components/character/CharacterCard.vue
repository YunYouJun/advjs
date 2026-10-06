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
    class="character-card p-3 rounded-lg bg-dark-400 flex flex-col gap-2 cursor-pointer shadow transition-all relative hover:bg-dark-300 hover:shadow-lg"
    @click="$emit('click', props.character)"
  >
    <CharacterPortrait class="m-auto rounded-lg size-24 object-cover" :src="character.avatar || character.avatars?.default?.src" :alt="character.name" />

    <div class="text-sm font-bold text-center">
      {{ character.name }}
    </div>

    <div v-if="character.faction" class="text-xs text-center op-60">
      {{ character.faction }}
    </div>

    <div v-if="character.tags?.length" class="flex flex-wrap gap-1 justify-center">
      <AGUITag
        v-for="tag in character.tags.slice(0, 3)"
        :key="tag"
      >
        {{ tag }}
      </AGUITag>
    </div>

    <div v-if="character.personality" class="text-xs op-50 line-clamp-2">
      {{ character.personality }}
    </div>
  </div>
</template>
