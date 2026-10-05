<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  paths: string[]
  selectedPath?: string
  busy?: boolean
  prefix?: string
}>(), { prefix: '' })
const emit = defineEmits<{ open: [path: string] }>()
const entries = computed(() => {
  const names = new Map<string, { name: string, path: string, directory: boolean }>()
  for (const path of props.paths) {
    if (!path.startsWith(props.prefix))
      continue
    const relative = path.slice(props.prefix.length)
    const name = relative.split('/')[0]
    if (name)
      names.set(name, { name, path: `${props.prefix}${name}`, directory: relative.includes('/') })
  }
  return [...names.values()].sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name))
})
</script>

<template>
  <ul class="project-file-tree">
    <li v-for="entry in entries" :key="entry.path">
      <details v-if="entry.directory" open>
        <summary class="project-tree-folder">
          <span i-ri-arrow-right-s-line class="folder-chevron" aria-hidden="true" />
          <span i-ri-folder-line aria-hidden="true" />
          <span>{{ entry.name }}</span>
        </summary>
        <ProjectFileTree :paths="paths" :prefix="`${entry.path}/`" :selected-path="selectedPath" :busy="busy" @open="emit('open', $event)" />
      </details>
      <button
        v-else type="button" class="project-tree-file" :title="entry.path"
        :aria-current="selectedPath === entry.path ? 'true' : undefined" :disabled="busy"
        @click="emit('open', entry.path)"
      >
        <span v-if="entry.name.endsWith('.character.md')" i-ri-user-line aria-hidden="true" />
        <span v-else i-ri-file-text-line aria-hidden="true" />
        <span class="file-name">{{ entry.name }}</span>
      </button>
    </li>
  </ul>
</template>

<style scoped>
.project-file-tree {
  padding: 0;
  margin: 0;
  list-style: none;
  font-size: 12px;
  color: var(--agui-c-text);
}
.project-file-tree .project-file-tree {
  padding-left: 14px;
}
.project-tree-folder,
.project-tree-file {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 26px;
  padding: 3px 8px;
  color: inherit;
  text-align: left;
  cursor: pointer;
  border: 0;
  border-radius: 0;
  background: transparent;
  font: inherit;
}
.project-tree-folder {
  list-style: none;
}
.project-tree-folder::-webkit-details-marker {
  display: none;
}
details[open] > .project-tree-folder .folder-chevron {
  transform: rotate(90deg);
}
.project-tree-file {
  padding-left: 24px;
}
.project-tree-file:hover,
.project-tree-folder:hover {
  background: var(--agui-c-bg-hover);
}
.project-tree-file[aria-current='true'] {
  background: var(--agui-c-active, #dceafa);
}
.project-tree-file:focus-visible,
.project-tree-folder:focus-visible {
  outline: 1px solid var(--agui-c-focus);
  outline-offset: -1px;
}
.file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
