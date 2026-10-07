<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import CharacterAvatar from './CharacterAvatar.vue'
import '../../styles/resource-panel.scss'

withDefaults(defineProps<{
  character: AdvCharacter
  mode?: 'grid' | 'list'
  selected?: boolean
}>(), { mode: 'grid', selected: undefined })

defineEmits<{ click: [character: AdvCharacter] }>()
</script>

<template>
  <button
    type="button"
    class="ae-character-card"
    :class="[mode, { selected }]"
    :aria-pressed="selected"
    @click="$emit('click', character)"
  >
    <CharacterAvatar :src="character.avatar" :mode="mode" />
    <span class="ae-resource-meta">
      <span class="ae-resource-name">{{ character.name }}</span>
      <span class="ae-resource-caption">{{ character.faction || character.id }}</span>
      <span v-if="mode === 'grid' && character.tags?.length" class="ae-resource-caption">{{ character.tags.slice(0, 3).join(' · ') }}</span>
    </span>
  </button>
</template>

<style scoped lang="scss">
.ae-character-card {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  width: 100%;
  padding: 6px;
  border: 1px solid var(--agui-c-divider);
  border-radius: 2px;
  color: var(--agui-c-text-1);
  background: var(--agui-c-bg-panel);
  font: inherit;
  font-size: 12px;
  line-height: 1.5;
  text-align: left;
  overflow-wrap: anywhere;
  cursor: pointer;
  &:hover {
    background: var(--agui-c-bg-hover);
  }
  &.selected {
    background: var(--agui-c-selection);
    color: var(--agui-c-selection-text);
  }
  &:focus-visible {
    outline: 2px solid var(--agui-c-focus);
    outline-offset: -2px;
  }
  .ae-resource-name,
  .ae-resource-caption {
    display: block;
  }
  &.grid {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
