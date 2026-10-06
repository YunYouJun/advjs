<script setup lang="ts">
import { shallowRef, watch } from 'vue'
import { useCharacterVisualReferences } from '../../composables/useCharacterVisualReferences'

const props = defineProps<{ src?: string, alt: string }>()
const projectStore = useProjectStore()
const { previews } = useCharacterVisualReferences(
  () => props.src ? [{ path: props.src }] : [],
  () => projectStore.workspace,
)
const failed = shallowRef(false)
watch(() => previews.value[0]?.src, () => {
  failed.value = false
})
</script>

<template>
  <img v-if="previews[0]?.src && !failed" :src="previews[0].src" :alt="alt" @error="failed = true">
  <div v-else class="bg-dark-300 flex items-center justify-center" role="img" :aria-label="alt">
    <div class="i-ri-user-3-line op-40" />
  </div>
</template>
