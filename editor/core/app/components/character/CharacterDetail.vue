<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import { computed } from 'vue'
import CharacterAvatar from './CharacterAvatar.vue'
import '../../styles/resource-panel.scss'

const props = withDefaults(defineProps<{ character: AdvCharacter, actions?: boolean }>(), { actions: true })
defineEmits<{ edit: [character: AdvCharacter], delete: [character: AdvCharacter] }>()
const descriptions = computed(() => (['personality', 'appearance', 'background', 'concept', 'speechStyle'] as const)
  .filter(key => props.character[key]))
</script>

<template>
  <div class="ae-resource-panel character-detail">
    <div class="ae-resource-row">
      <CharacterAvatar :src="character.avatar" />
      <div class="ae-resource-meta">
        <h2 class="ae-resource-name">
          {{ character.name }}
        </h2>
        <div class="ae-resource-caption">
          {{ character.id }}
        </div>
        <div v-if="character.faction" class="ae-resource-caption">
          {{ character.faction }}
        </div>
      </div>
    </div>
    <div v-if="actions" class="ae-resource-actions">
      <AGUIButton icon="i-ri-edit-line" @click="$emit('edit', character)">
        {{ $t('characters.detail.edit') }}
      </AGUIButton>
      <AGUIIconButton icon="i-ri-delete-bin-line" :title="$t('characters.detail.delete')" @click="$emit('delete', character)" />
    </div>
    <AGUIDetails :title="$t('characters.form.basicInfo')" open>
      <AGUIProperty v-if="character.tags?.length" :label="$t('characters.form.tags')">
        {{ character.tags.join(' · ') }}
      </AGUIProperty>
      <AGUIProperty v-if="character.aliases?.length" :label="$t('characters.detail.aliases')">
        {{ character.aliases.join(', ') }}
      </AGUIProperty>
      <AGUIProperty v-if="character.cv" :label="$t('characters.detail.cv')">
        {{ character.cv }}
      </AGUIProperty>
      <AGUIProperty v-if="character.actor" :label="$t('characters.detail.actor')">
        {{ character.actor }}
      </AGUIProperty>
      <p v-if="!character.tags?.length && !character.aliases?.length && !character.cv && !character.actor" class="ae-resource-caption">
        {{ $t('characters.noDetails') }}
      </p>
    </AGUIDetails>
    <AGUIDetails v-for="key in descriptions" :key="key" :title="$t(`characters.detail.${key}`)" open>
      <p class="description">
        {{ character[key] }}
      </p>
    </AGUIDetails>
  </div>
</template>

<style scoped>
h2 {
  margin: 0;
  font-size: 13px;
}
.description {
  margin: 0;
  white-space: pre-wrap;
}
.character-detail > .ae-resource-actions {
  padding: 0 8px 8px;
}
</style>
