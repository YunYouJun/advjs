<script setup lang="ts">
import type { KnowledgeEntry } from '../composables/useKnowledgeBase'
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { refreshOutline } from 'ionicons/icons'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getDomainIcon } from '../utils/chatUtils'

const props = defineProps<{
  isOpen: boolean
  domain: string
  entries: KnowledgeEntry[]
  isLoading: boolean
}>()

const emit = defineEmits<{
  close: []
  refresh: []
}>()

const { t } = useI18n()

const expandedFile = ref<string | null>(null)

const domainEntries = computed(() => {
  if (!props.domain)
    return props.entries
  return props.entries.filter(
    e => e.domain === props.domain || e.domain === 'general',
  )
})

const domainIcon = computed(() => getDomainIcon(props.domain || ''))

function toggleExpand(file: string) {
  expandedFile.value = expandedFile.value === file ? null : file
}
</script>

<template>
  <IonModal :is-open="isOpen" :initial-breakpoint="0.75" :breakpoints="[0, 0.5, 0.75, 1]" @did-dismiss="emit('close')">
    <IonHeader>
      <IonToolbar>
        <IonTitle>
          {{ domainIcon }} {{ t('world.knowledgeBase') }}
        </IonTitle>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonButton slot="end" fill="clear" :disabled="isLoading" @click="emit('refresh')">
          <IonIcon :icon="refreshOutline" />
        </IonButton>
      </IonToolbar>
    </IonHeader>
    <IonContent class="ion-padding">
      <!-- Loading state -->
      <div v-if="isLoading" class="km-loading">
        {{ t('world.loading') }}
      </div>

      <!-- Empty state -->
      <div v-else-if="domainEntries.length === 0" class="km-empty">
        <p class="km-empty__title">
          {{ t('world.knowledgeEmpty') }}
        </p>
        <p class="km-empty__hint">
          {{ t('world.knowledgeEmptyHint') }}
        </p>
      </div>

      <!-- File list -->
      <div v-else class="km-list">
        <div class="km-summary">
          {{ t('world.knowledgeLoaded', { count: domainEntries.length }) }}
        </div>

        <div
          v-for="entry in domainEntries"
          :key="entry.file"
          class="km-entry"
        >
          <button
            class="km-entry__header"
            type="button"
            @click="toggleExpand(entry.file)"
          >
            <span class="km-entry__title">{{ entry.title }}</span>
            <span class="km-entry__meta">
              {{ t('world.knowledgeSections', { count: entry.sections.length }) }}
              · {{ Math.round(entry.content.length / 1000) }}k
            </span>
            <span class="km-entry__chevron" :class="{ 'km-entry__chevron--open': expandedFile === entry.file }">
              ›
            </span>
          </button>

          <!-- Expanded section list -->
          <div v-if="expandedFile === entry.file" class="km-sections">
            <div
              v-for="(section, idx) in entry.sections"
              :key="idx"
              class="km-section"
            >
              <span v-if="section.heading" class="km-section__heading">
                ## {{ section.heading }}
              </span>
              <p class="km-section__preview">
                {{ section.content.slice(0, 120) }}{{ section.content.length > 120 ? '...' : '' }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </IonContent>
  </IonModal>
</template>

<style scoped>
.km-loading {
  text-align: center;
  padding: var(--adv-space-xl);
  color: var(--adv-text-tertiary);
}

.km-empty {
  text-align: center;
  padding: var(--adv-space-xl);
}

.km-empty__title {
  font-size: var(--adv-font-body);
  color: var(--adv-text-secondary);
  margin: 0 0 var(--adv-space-xs);
}

.km-empty__hint {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
  margin: 0;
}

.km-summary {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
  margin-bottom: var(--adv-space-md);
}

.km-list {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-sm);
}

.km-entry {
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-md, 8px);
  overflow: hidden;
}

.km-entry__header {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm);
  padding: var(--adv-space-sm) var(--adv-space-md);
  width: 100%;
  background: var(--adv-surface-card);
  border: none;
  cursor: pointer;
  text-align: left;
  min-height: 44px;
}

.km-entry__header:hover {
  background: var(--adv-surface-elevated);
}

.km-entry__title {
  flex: 1;
  font-size: var(--adv-font-body-sm);
  font-weight: 600;
  color: var(--adv-text-primary);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.km-entry__meta {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
  white-space: nowrap;
  flex-shrink: 0;
}

.km-entry__chevron {
  font-size: 18px;
  color: var(--adv-text-tertiary);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.km-entry__chevron--open {
  transform: rotate(90deg);
}

.km-sections {
  padding: var(--adv-space-xs) var(--adv-space-md) var(--adv-space-sm);
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-xs);
  background: var(--adv-surface-elevated);
}

.km-section {
  padding: var(--adv-space-xs) 0;
}

.km-section__heading {
  font-size: var(--adv-font-caption);
  font-weight: 600;
  color: #8b5cf6;
  display: block;
  margin-bottom: 2px;
}

.km-section__preview {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-secondary);
  line-height: 1.4;
  margin: 0;
}
</style>
