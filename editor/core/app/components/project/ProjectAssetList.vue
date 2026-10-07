<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef, watch } from 'vue'
import ProjectAssetItem from './ProjectAssetItem.vue'

const props = defineProps<{ paths: string[], selected?: string, visible: boolean, mode: 'grid' | 'list', label: string, showPath?: boolean, previewHint?: string }>()
const emit = defineEmits<{ select: [path: string], open: [path: string] }>()
const root = useTemplateRef<HTMLElement>('root')
const focused = shallowRef('')
const tabStop = computed(() => [focused.value, props.selected].find(path => path && props.paths.includes(path)) ?? props.paths[0])
watch(() => props.paths, async (paths, previous) => {
  const lostFocus = root.value?.contains(document.activeElement) && previous.includes(focused.value) && !paths.includes(focused.value)
  await nextTick()
  if (lostFocus)
    root.value?.querySelector<HTMLElement>('button[tabindex="0"]')?.focus()
}, { flush: 'pre' })
function navigate(event: KeyboardEvent) {
  if (event.altKey || event.ctrlKey || event.metaKey)
    return
  const buttons = [...(root.value?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
  const index = buttons.indexOf(event.target as HTMLButtonElement)
  if (index < 0)
    return
  const nextRow = buttons.findIndex(button => button.offsetTop > buttons[0].offsetTop)
  const columns = nextRow > 0 ? nextRow : buttons.length
  let next = index
  switch (event.key) {
    case 'ArrowRight': next++
      break
    case 'ArrowLeft': next--
      break
    case 'ArrowDown': next += columns
      break
    case 'ArrowUp': next -= columns
      break
    case 'Home': next = 0
      break
    case 'End': next = buttons.length - 1
      break
    default: return
  }
  event.preventDefault()
  const button = buttons[Math.min(buttons.length - 1, Math.max(0, next))]
  button?.focus()
  const path = props.paths[Math.min(buttons.length - 1, Math.max(0, next))]
  if (path)
    emit('select', path)
}
</script>

<template>
  <ul ref="root" class="project-assets-list" :class="mode" :aria-label="label" @keydown="navigate">
    <li v-for="path in paths" :key="path">
      <ProjectAssetItem
        :path="path" :selected="path === selected" :visible="visible" :mode="mode" :show-path="showPath" :tab-index="path === tabStop ? 0 : -1" :preview-hint="previewHint"
        @focus="focused = path" @select="emit('select', $event)" @open="emit('open', $event)"
      />
    </li>
  </ul>
</template>

<style scoped>
.project-assets-list {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 8px;
  list-style: none;
  align-content: start;
}
.project-assets-list.grid {
  grid-template-columns: repeat(auto-fill, minmax(min(96px, 100%), 1fr));
}
.project-assets-list li {
  min-width: 0;
}
</style>
