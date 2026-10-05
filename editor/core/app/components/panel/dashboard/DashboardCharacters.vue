<script setup lang="ts">
import type { AuthoringCharacter } from '../../../composables/useAuthoringOverview'

defineProps<{ characters: AuthoringCharacter[], count: number, zh: boolean }>()
</script>

<template>
  <section class="dashboard-section">
    <h3>{{ zh ? '人物资料' : 'Characters' }} <span>{{ count }}</span></h3>
    <dl v-if="characters.length">
      <div v-for="(character, index) in characters" :key="index" class="character-row">
        <dt>{{ character.name }} <span>{{ character.role }}</span></dt>
        <dd>{{ character.description }}</dd>
      </div>
    </dl>
    <p v-else>
      {{ zh ? '在 characters/README.md 中整理人物资料。' : 'Summarize characters in characters/README.md.' }}
    </p>
  </section>
</template>

<style scoped>
dl {
  margin: 0;
}
h3 span,
dt span {
  color: var(--agui-c-text-2);
  margin-left: 8px;
  font-size: 12px;
  font-weight: 400;
}
.character-row {
  padding: 8px 0;
  border-bottom: 1px solid var(--agui-c-divider-light);
  overflow-wrap: anywhere;
}
dt {
  font-weight: 500;
}
dd {
  margin: 4px 0 0;
  color: var(--agui-c-text-2);
}
</style>
