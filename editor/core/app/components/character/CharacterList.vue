<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'

defineProps<{
  characters: AdvCharacter[]
  loading?: boolean
}>()

defineEmits<{
  select: [character: AdvCharacter]
}>()

const viewMode = ref<'grid' | 'list'>('grid')
</script>

<template>
  <div class="character-list">
    <div class="mb-3 flex items-center justify-end gap-2">
      <AGUIButton
        :theme="viewMode === 'grid' ? 'primary' : 'default'"
        variant="outline"
        size="mini"
        @click="viewMode = 'grid'"
      >
        <div class="i-ri-grid-line" />
      </AGUIButton>
      <AGUIButton
        :theme="viewMode === 'list' ? 'primary' : 'default'"
        variant="outline"
        size="mini"
        @click="viewMode = 'list'"
      >
        <div class="i-ri-list-unordered" />
      </AGUIButton>
    </div>

    <div v-if="loading" class="flex items-center justify-center p-8">
      <div class="i-svg-spinners:3-dots-scale text-4xl" />
    </div>

    <div v-else-if="characters.length === 0" class="flex flex-col items-center justify-center gap-2 p-8 op-50">
      <div class="i-ri-user-3-line text-4xl" />
      <span>{{ $t('characters.noCharacters') }}</span>
    </div>

    <!-- Grid View -->
    <div v-else-if="viewMode === 'grid'" class="grid grid-cols-2 gap-3 lg:grid-cols-5 md:grid-cols-4 sm:grid-cols-3">
      <CharacterCard
        v-for="character in characters"
        :key="character.id"
        :character="character"
        @click="$emit('select', character)"
      />
    </div>

    <!-- List View -->
    <div v-else class="flex flex-col gap-2">
      <div
        v-for="character in characters"
        :key="character.id"
        class="flex cursor-pointer items-center gap-3 rounded-lg bg-dark-400 p-3 transition-all hover:bg-dark-300"
        @click="$emit('select', character)"
      >
        <img
          v-if="character.avatar"
          class="size-10 rounded-full object-cover"
          :src="character.avatar"
          :alt="character.name"
        >
        <div v-else class="size-10 flex items-center justify-center rounded-full bg-dark-200">
          <div class="i-ri-user-3-line op-40" />
        </div>
        <div class="flex-1">
          <div class="font-bold">
            {{ character.name }}
          </div>
          <div v-if="character.faction" class="text-xs op-50">
            {{ character.faction }}
          </div>
        </div>
        <div v-if="character.tags?.length" class="flex gap-1">
          <AGUITag
            v-for="tag in character.tags.slice(0, 2)"
            :key="tag"
          >
            {{ tag }}
          </AGUITag>
        </div>
      </div>
    </div>
  </div>
</template>
