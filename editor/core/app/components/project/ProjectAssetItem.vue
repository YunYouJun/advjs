<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { projectFileKind } from '../../utils/project-files'

const props = defineProps<{ path: string, selected: boolean, visible: boolean, mode: 'grid' | 'list', showPath?: boolean, tabIndex: number, previewHint?: string }>()
const emit = defineEmits<{ select: [path: string], open: [path: string] }>()
const project = useProjectStore()
const thumbnail = shallowRef('')
const failed = shallowRef(false)
const kind = computed(() => projectFileKind(props.path))
const name = computed(() => props.path.split('/').at(-1))
const icon = computed(() => ({ image: 'i-ri-image-line', audio: 'i-ri-music-line', video: 'i-ri-film-line', model: 'i-ri-box-3-line', text: 'i-ri-file-text-line', unsupported: 'i-ri-file-line' })[kind.value])
function open() {
  emit('select', props.path)
  emit('open', props.path)
}
watch(() => [props.path, props.visible, project.workspace, project.resourceRevision] as const, async (_, __, onCleanup) => {
  let current = true
  let url = ''
  failed.value = false
  thumbnail.value = ''
  onCleanup(() => {
    current = false
    if (url)
      URL.revokeObjectURL(url)
  })
  const source = project.workspace
  if (!props.visible || kind.value !== 'image' || !source?.readAsset)
    return
  try {
    const blob = await source.readAsset(props.path)
    if (!current)
      return
    url = URL.createObjectURL(blob)
    thumbnail.value = url
  }
  catch {
    if (current)
      failed.value = true
  }
}, { immediate: true })
</script>

<template>
  <button
    type="button" class="project-asset" :class="[mode, { selected }]" :aria-pressed="selected" :title="previewHint ? `${path}\n${previewHint}` : path" :tabindex="tabIndex" :aria-label="name" draggable="true"
    @click="emit('select', path)" @dblclick="open" @keydown.enter.prevent.stop="open"
    @dragstart="$event.dataTransfer?.setData('text/plain', path)"
  >
    <img v-if="thumbnail && !failed" class="asset-thumbnail" :src="thumbnail" alt="" loading="lazy" @error="failed = true">
    <span v-else class="asset-thumbnail asset-placeholder" aria-hidden="true"><span :class="icon" /></span>
    <span class="asset-label">
      <span class="asset-name">{{ name }}</span>
      <span v-if="showPath" class="asset-path">{{ path }}</span>
    </span>
  </button>
</template>

<style scoped>
.project-asset {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  width: 100%;
  padding: 4px;
  border: 1px solid var(--agui-c-divider);
  border-radius: 2px;
  color: var(--agui-c-text-1);
  background: var(--agui-c-bg-panel);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.project-asset:hover {
  background: var(--agui-c-bg-hover);
}
.project-asset.selected {
  color: var(--agui-c-selection-text);
  background: var(--agui-c-selection);
}
.project-asset:focus-visible {
  outline: 2px solid var(--agui-c-focus);
  outline-offset: -2px;
}
.asset-thumbnail {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  object-fit: contain;
}
.asset-placeholder {
  display: grid;
  place-items: center;
  background: var(--agui-c-field);
  font-size: 16px;
}
.asset-label {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.asset-name,
.asset-path {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.asset-path {
  color: var(--agui-c-text-2);
}
.grid {
  flex-direction: column;
  align-items: stretch;
}
.grid .asset-thumbnail {
  width: 100%;
  height: 64px;
}
.grid .asset-name {
  text-align: center;
}
@container asset-content (max-height: 120px) {
  .grid .asset-thumbnail {
    height: 40px;
  }
}
@container asset-content (max-height: 80px) {
  .grid {
    flex-direction: row;
    align-items: center;
  }
  .grid .asset-thumbnail {
    width: 24px;
    height: 24px;
  }
  .grid .asset-name {
    text-align: left;
  }
  .grid .asset-path {
    display: none;
  }
}
</style>
