<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  content: string
  maxLength?: number
}>()

const MAX = props.maxLength ?? 80
const expanded = ref(false)

const isLong = computed(() => props.content.length > MAX)
</script>

<template>
  <div class="diary-entry-content">
    <span v-if="!isLong || expanded">{{ content }}</span>
    <span v-else>{{ content.slice(0, MAX) }}…</span>
    <button
      v-if="isLong"
      class="diary-entry-toggle"
      @click.stop="expanded = !expanded"
    >
      {{ expanded ? $t('common.collapse') : $t('common.expand') }}
    </button>
  </div>
</template>

<style scoped>
.diary-entry-content {
  display: inline;
}

.diary-entry-toggle {
  display: inline;
  margin-left: 4px;
  border: none;
  background: none;
  color: var(--adv-primary, #8b5cf6);
  font-size: inherit;
  cursor: pointer;
  padding: 0;
}
</style>
