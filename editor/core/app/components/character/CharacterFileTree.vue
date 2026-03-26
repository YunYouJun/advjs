<script setup lang="ts">
import type { FileTreeNode } from '~/stores/useCharacterStore'

defineProps<{
  nodes: FileTreeNode[]
  selected?: string
  depth?: number
}>()

const emit = defineEmits<{
  select: [node: FileTreeNode]
}>()

const expandedDirs = ref<Set<string>>(new Set())

function toggleDir(node: FileTreeNode) {
  if (expandedDirs.value.has(node.path)) {
    expandedDirs.value.delete(node.path)
  }
  else {
    expandedDirs.value.add(node.path)
  }
}
</script>

<template>
  <div class="character-file-tree">
    <div
      v-for="node in nodes"
      :key="node.path"
    >
      <!-- Directory -->
      <div
        v-if="node.kind === 'directory'"
        class="select-none"
      >
        <div
          class="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs transition-colors hover:bg-dark-300"
          :style="{ paddingLeft: `${(depth || 0) * 12 + 8}px` }"
          @click="toggleDir(node)"
        >
          <div
            class="text-xs op-50 transition-transform"
            :class="expandedDirs.has(node.path) ? 'i-ri-arrow-down-s-fill' : 'i-ri-arrow-right-s-fill'"
          />
          <div class="i-ri-folder-line text-xs op-60" />
          <span class="truncate op-80">{{ node.name }}</span>
        </div>
        <div v-if="expandedDirs.has(node.path) && node.children?.length">
          <CharacterFileTree
            :nodes="node.children"
            :selected="selected"
            :depth="(depth || 0) + 1"
            @select="emit('select', $event)"
          />
        </div>
      </div>

      <!-- File -->
      <div
        v-else
        class="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs transition-colors hover:bg-dark-300"
        :class="selected === node.path ? 'bg-dark-300 text-primary-400' : ''"
        :style="{ paddingLeft: `${(depth || 0) * 12 + 20}px` }"
        @click="emit('select', node)"
      >
        <div class="i-ri-user-3-line text-xs op-50" />
        <span class="truncate" :class="selected === node.path ? 'op-100' : 'op-70'">
          {{ node.name.replace('.character.md', '') }}
        </span>
      </div>
    </div>
  </div>
</template>
