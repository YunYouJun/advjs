<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'

const _props = defineProps<{
  character: AdvCharacter
}>()

defineEmits<{
  edit: [character: AdvCharacter]
  delete: [character: AdvCharacter]
}>()

const showTachies = ref(false)

const displayAliases = computed(() => {
  return _props.character.aliases || []
})
</script>

<template>
  <div class="character-detail flex flex-col gap-4 p-4">
    <!-- Header -->
    <div class="flex items-start gap-4">
      <img
        v-if="character.avatar"
        class="size-20 rounded-lg object-cover"
        :src="character.avatar"
        :alt="character.name"
      >
      <div v-else class="size-20 flex items-center justify-center rounded-lg bg-dark-300">
        <div class="i-ri-user-3-line text-3xl op-40" />
      </div>

      <div class="flex-1">
        <h2 class="text-xl font-bold">
          {{ character.name }}
        </h2>
        <div class="text-sm op-50">
          ID: {{ character.id }}
        </div>
        <div v-if="character.faction" class="mt-1 text-sm op-70">
          {{ character.faction }}
        </div>
      </div>

      <div class="flex gap-2">
        <AGUIButton theme="primary" variant="outline" icon="i-ri-edit-line" @click="$emit('edit', character)">
          {{ $t('characters.detail.edit') }}
        </AGUIButton>
        <AGUIButton theme="danger" variant="outline" icon="i-ri-delete-bin-line" @click="$emit('delete', character)" />
      </div>
    </div>

    <!-- Tags -->
    <div v-if="character.tags?.length" class="flex flex-wrap gap-1">
      <AGUITag
        v-for="tag in character.tags"
        :key="tag"
      >
        {{ tag }}
      </AGUITag>
    </div>

    <!-- Info Sections -->
    <div v-if="character.personality" class="section">
      <h3 class="mb-1 text-sm font-bold op-60">
        {{ $t('characters.detail.personality') }}
      </h3>
      <p class="text-sm">
        {{ character.personality }}
      </p>
    </div>

    <div v-if="character.appearance" class="section">
      <h3 class="mb-1 text-sm font-bold op-60">
        {{ $t('characters.detail.appearance') }}
      </h3>
      <p class="text-sm">
        {{ character.appearance }}
      </p>
    </div>

    <div v-if="character.background" class="section">
      <h3 class="mb-1 text-sm font-bold op-60">
        {{ $t('characters.detail.background') }}
      </h3>
      <p class="text-sm">
        {{ character.background }}
      </p>
    </div>

    <div v-if="character.concept" class="section">
      <h3 class="mb-1 text-sm font-bold op-60">
        {{ $t('characters.detail.concept') }}
      </h3>
      <p class="text-sm">
        {{ character.concept }}
      </p>
    </div>

    <div v-if="character.speechStyle" class="section">
      <h3 class="mb-1 text-sm font-bold op-60">
        {{ $t('characters.detail.speechStyle') }}
      </h3>
      <p class="text-sm">
        {{ character.speechStyle }}
      </p>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div v-if="character.cv" class="section">
        <h3 class="mb-1 text-sm font-bold op-60">
          {{ $t('characters.detail.cv') }}
        </h3>
        <p class="text-sm">
          {{ character.cv }}
        </p>
      </div>

      <div v-if="character.actor" class="section">
        <h3 class="mb-1 text-sm font-bold op-60">
          {{ $t('characters.detail.actor') }}
        </h3>
        <p class="text-sm">
          {{ character.actor }}
        </p>
      </div>
    </div>

    <div v-if="displayAliases.length" class="section">
      <h3 class="mb-1 text-sm font-bold op-60">
        {{ $t('characters.detail.aliases') }}
      </h3>
      <p class="text-sm">
        {{ displayAliases.join(', ') }}
      </p>
    </div>

    <!-- Tachies (Sprites) -->
    <div v-if="character.tachies && Object.keys(character.tachies).length" class="section">
      <div class="mb-2 flex cursor-pointer items-center gap-2" @click="showTachies = !showTachies">
        <h3 class="text-sm font-bold op-60">
          {{ $t('characters.detail.tachies') }} ({{ Object.keys(character.tachies).length }})
        </h3>
        <div :class="showTachies ? 'i-ri-arrow-up-s-line' : 'i-ri-arrow-down-s-line'" class="op-60" />
      </div>
      <div v-if="showTachies" class="flex flex-wrap gap-2">
        <div
          v-for="(tachie, key) in character.tachies"
          :key="key"
          class="flex flex-col items-center gap-1 rounded bg-dark-300 p-2"
        >
          <img v-if="tachie" class="h-20 object-contain" :src="tachie.src" :alt="String(key)">
          <span class="text-xs op-60">{{ key }}</span>
        </div>
      </div>
    </div>

    <!-- Relationships -->
    <div v-if="character.relationships?.length" class="section">
      <h3 class="mb-2 text-sm font-bold op-60">
        {{ $t('characters.detail.relationships') }}
      </h3>
      <div class="flex flex-col gap-1">
        <div
          v-for="(rel, idx) in character.relationships"
          :key="idx"
          class="flex items-center gap-2 rounded bg-dark-300 p-2 text-sm"
        >
          <span class="font-bold">{{ rel.targetId }}</span>
          <AGUITag theme="primary">
            {{ rel.type }}
          </AGUITag>
          <span v-if="rel.description" class="op-60">{{ rel.description }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
