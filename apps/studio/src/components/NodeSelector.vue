<script setup lang="ts">
import {
  IonButton,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import {
  chatboxOutline,
  chatbubblesOutline,
  listOutline,
  readerOutline,
  textOutline,
} from 'ionicons/icons'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  chapters: string[]
  currentChapter?: string
  nodes?: { index: number, type: string, preview: string }[]
  currentNodeIndex?: number
}>()

const emit = defineEmits<{
  select: [file: string]
  selectNode: [index: number]
}>()

const { t } = useI18n()
const isOpen = ref(false)

// Reset to current chapter view when modal opens
const activeChapter = ref('')
watch(isOpen, (open) => {
  if (open)
    activeChapter.value = props.currentChapter || props.chapters[0] || ''
})

const displayChapters = computed(() =>
  props.chapters.map(f => ({
    file: f,
    name: f.split('/').pop()?.replace('.adv.md', '') || f,
  })),
)

function selectChapter(file: string) {
  activeChapter.value = file
  emit('select', file)
}

function selectNode(index: number) {
  emit('selectNode', index)
  isOpen.value = false
}

function getNodeIcon(type: string) {
  switch (type) {
    case 'dialog': return chatboxOutline
    case 'narration': return readerOutline
    case 'choices': return chatbubblesOutline
    case 'paragraph': return textOutline
    default: return listOutline
  }
}
</script>

<template>
  <IonButton size="small" fill="clear" :aria-label="t('preview.nodes')" @click="isOpen = true">
    <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
    <IonIcon slot="icon-only" :icon="listOutline" />
  </IonButton>

  <IonModal
    :is-open="isOpen"
    :initial-breakpoint="0.6"
    :breakpoints="[0, 0.6, 0.85, 1]"
    @did-dismiss="isOpen = false"
  >
    <IonHeader>
      <IonToolbar>
        <IonTitle>{{ t('preview.nodes') }}</IonTitle>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonButton slot="end" fill="clear" @click="isOpen = false">
          {{ t('common.ok') }}
        </IonButton>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <!-- Chapter chips (horizontal scroll) -->
      <div v-if="chapters.length > 1" class="chapter-chips">
        <IonChip
          v-for="ch in displayChapters"
          :key="ch.file"
          :color="ch.file === activeChapter ? 'primary' : undefined"
          @click="selectChapter(ch.file)"
        >
          {{ ch.name }}
        </IonChip>
      </div>

      <!-- Node list -->
      <IonList v-if="nodes && nodes.length > 0">
        <IonItem
          v-for="node in nodes"
          :key="node.index"
          button
          :color="node.index === currentNodeIndex ? 'primary' : undefined"
          @click="selectNode(node.index)"
        >
          <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
          <IonIcon slot="start" :icon="getNodeIcon(node.type)" />
          <IonLabel>
            <h3 class="node-item__title">
              <span class="node-item__index">#{{ node.index + 1 }}</span>
              <span class="node-item__type">{{ node.type }}</span>
            </h3>
            <p class="node-item__preview">
              {{ node.preview }}
            </p>
          </IonLabel>
        </IonItem>
      </IonList>

      <div v-else class="empty-selector">
        <p>{{ t('preview.noChapters') }}</p>
      </div>
    </IonContent>
  </IonModal>
</template>

<style scoped>
.chapter-chips {
  display: flex;
  gap: 4px;
  padding: var(--adv-space-sm) var(--adv-space-md);
  overflow-x: auto;
  flex-shrink: 0;
  border-bottom: 1px solid var(--adv-border-subtle);
}

.node-item__title {
  display: flex;
  align-items: center;
  gap: 6px;
}

.node-item__index {
  font-size: 12px;
  font-weight: 600;
  color: var(--adv-text-tertiary);
  min-width: 28px;
}

.node-item__type {
  font-size: 13px;
  font-weight: 500;
  text-transform: capitalize;
}

.node-item__preview {
  font-size: 13px;
  color: var(--adv-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty-selector {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--adv-space-lg);
  color: var(--adv-text-tertiary);
}
</style>
