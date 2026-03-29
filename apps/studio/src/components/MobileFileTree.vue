<script setup lang="ts">
import type { FSDirItem, FSFileItem, FSItem } from '@advjs/gui'
import { getFileTypeFromPath, getIconFromFileType, listFilesInDir } from '@advjs/gui'
import {
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSpinner,
} from '@ionic/vue'
import { chevronForwardOutline } from 'ionicons/icons'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  dir: FSDirItem
  selectedFile?: string
}>()

const emit = defineEmits<{
  (e: 'fileSelect', item: FSFileItem): void
}>()

const { t } = useI18n()

interface FlatNode {
  item: FSItem
  path: string
  depth: number
}

const expandedPaths = reactive(new Set<string>())
const rootChildren = ref<FSItem[]>([])
const rootLoading = ref(false)

/** Directories to auto-expand on first load */
const AUTO_EXPAND_DIRS = new Set(['adv', 'src', 'chapters'])

/** Get vscode-icons class for a file node */
function getFileIcon(name: string): string {
  return getIconFromFileType(getFileTypeFromPath(name))
}

/** Get vscode-icons class for a folder node, with open/close state */
function getFolderIcon(path: string): string {
  if (expandedPaths.has(path))
    return 'i-vscode-icons-default-folder-opened'
  return 'i-vscode-icons-default-folder'
}

async function loadRootChildren() {
  rootLoading.value = true
  try {
    const children = await listFilesInDir(props.dir, { showFiles: true })
    rootChildren.value = children

    // Auto-expand key directories
    for (const child of children) {
      if (child.kind === 'directory' && AUTO_EXPAND_DIRS.has(child.name.toLowerCase()))
        expandedPaths.add(child.name)
    }
  }
  catch {
    rootChildren.value = []
  }
  finally {
    rootLoading.value = false
  }
}

watch(() => props.dir, () => {
  expandedPaths.clear()
  rootChildren.value = []
  loadRootChildren()
})

onMounted(loadRootChildren)

function toggleDir(path: string) {
  if (expandedPaths.has(path))
    expandedPaths.delete(path)
  else
    expandedPaths.add(path)
}

const flatNodes = computed<FlatNode[]>(() => {
  const nodes: FlatNode[] = []

  function walk(items: FSItem[], parentPath: string, depth: number) {
    for (const item of items) {
      const path = parentPath ? `${parentPath}/${item.name}` : item.name
      nodes.push({ item, path, depth })

      if (
        item.kind === 'directory'
        && expandedPaths.has(path)
        && (item as FSDirItem).children
      ) {
        walk((item as FSDirItem).children!, path, depth + 1)
      }
    }
  }

  walk(rootChildren.value, '', 0)
  return nodes
})

function handleFileClick(item: FSFileItem) {
  emit('fileSelect', item)
}
</script>

<template>
  <IonList lines="full" class="mobile-file-tree">
    <!-- Loading root -->
    <IonItem v-if="rootLoading" class="tree-loading">
      <IonSpinner name="dots" />
      <IonLabel class="ion-margin-start">
        {{ t('workspace.fileTree') }}...
      </IonLabel>
    </IonItem>

    <!-- Empty state -->
    <IonItem v-else-if="rootChildren.length === 0" class="tree-empty">
      <IonLabel color="medium" class="ion-text-center">
        {{ t('workspace.selectFile') }}
      </IonLabel>
    </IonItem>

    <!-- Flat node list -->
    <template v-for="node in flatNodes" :key="node.path">
      <!-- Directory node -->
      <IonItem
        v-if="node.item.kind === 'directory'"
        button
        :detail="false"
        class="tree-node"
        :style="{ '--padding-start': `${node.depth * 20 + 16}px` }"
        @click="toggleDir(node.path)"
      >
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <div slot="start" class="tree-slot-start">
          <IonIcon
            :icon="chevronForwardOutline"
            class="tree-chevron"
            :class="{ 'tree-chevron--expanded': expandedPaths.has(node.path) }"
          />
          <span class="tree-icon" :class="getFolderIcon(node.path)" />
        </div>
        <IonLabel>{{ node.item.name }}</IonLabel>
      </IonItem>

      <!-- File node -->
      <IonItem
        v-else
        button
        :detail="false"
        class="tree-node"
        :color="selectedFile === node.item.name ? 'primary' : undefined"
        :style="{ '--padding-start': `${node.depth * 20 + 16}px` }"
        @click="handleFileClick(node.item as FSFileItem)"
      >
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <div slot="start" class="tree-slot-start">
          <span class="tree-chevron-spacer" />
          <span class="tree-icon" :class="getFileIcon(node.item.name)" />
        </div>
        <IonLabel>{{ node.item.name }}</IonLabel>
      </IonItem>
    </template>
  </IonList>
</template>

<style scoped>
.mobile-file-tree {
  padding: 0;
}

.tree-node {
  --min-height: 36px;
  --inner-padding-end: 8px;
  font-size: 14px;
}

.tree-slot-start {
  display: flex;
  align-items: center;
  margin-right: 6px;
}

.tree-chevron {
  font-size: 12px;
  margin-right: 2px;
  transition: transform 0.2s ease;
  flex-shrink: 0;
  color: var(--ion-color-medium);
}

.tree-chevron--expanded {
  transform: rotate(90deg);
}

.tree-chevron-spacer {
  display: inline-block;
  width: 14px;
  flex-shrink: 0;
}

.tree-icon {
  font-size: 18px;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.tree-loading,
.tree-empty {
  --min-height: 60px;
}
</style>
