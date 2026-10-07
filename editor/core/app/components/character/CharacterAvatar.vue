<script setup lang="ts">
import { shallowRef, watch } from 'vue'

const props = withDefaults(defineProps<{
  src?: string
  mode?: 'grid' | 'list'
}>(), { mode: 'list' })
const project = useProjectStore()
const resolvedSrc = shallowRef('')
const failed = shallowRef(false)

watch(() => [props.src, project.workspace, project.resourceRevision] as const, async ([src], _, onCleanup) => {
  let current = true
  let ownedUrl = ''
  resolvedSrc.value = ''
  failed.value = false
  onCleanup(() => {
    current = false
    if (ownedUrl)
      URL.revokeObjectURL(ownedUrl)
  })
  if (!src)
    return
  try {
    const url = project.workspace ? await project.projectAssetUrl(src) : src
    // Only release URLs created for this view, never caller-owned blob URLs.
    if (url.startsWith('blob:') && url !== src) {
      if (!current) {
        URL.revokeObjectURL(url)
        return
      }
      ownedUrl = url
    }
    if (current)
      resolvedSrc.value = url
  }
  catch {
    if (current)
      failed.value = true
  }
}, { immediate: true })
</script>

<template>
  <span class="ae-character-avatar" :class="mode" aria-hidden="true">
    <img v-if="resolvedSrc && !failed" :key="resolvedSrc" :src="resolvedSrc" alt="" loading="lazy" @error="failed = true">
    <span v-else :class="failed ? 'i-ri-image-line' : 'i-ri-user-3-line'" />
  </span>
</template>

<style scoped lang="scss">
.ae-character-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  overflow: hidden;
  border-radius: 2px;
  background: var(--agui-c-field);
  color: var(--agui-c-text-2);

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  &.grid {
    width: 100%;
    height: 80px;
  }
}
</style>
