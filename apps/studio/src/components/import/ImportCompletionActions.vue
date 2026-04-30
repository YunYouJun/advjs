<!--
  Completion-state action cards for the import wizard.

  Three clear paths after generation finishes:
    • Play — open the Play tab immediately
    • Edit — open the Workspace tab
    • Export — download as .advpkg

  Decoupled from router / studio store — emits events; page wires them up.
-->
<script setup lang="ts">
import { IonIcon } from '@ionic/vue'
import {
  checkmarkCircle,
  createOutline,
  downloadOutline,
  playCircleOutline,
} from 'ionicons/icons'

defineProps<{
  stats?: {
    characters: number
    chapters: number
    scenes: number
    locations: number
    knowledge: number
  } | null
  draftMode?: boolean
  /** Whether to show the Export button (requires dirHandle). */
  showExport?: boolean
}>()

defineEmits<{
  play: []
  edit: []
  export: []
}>()
</script>

<template>
  <section class="completion-actions">
    <header class="completion-actions__header">
      <IonIcon :icon="checkmarkCircle" class="completion-actions__header-icon" />
      <div>
        <h3>{{ $t('importSource.done') }}</h3>
        <p v-if="draftMode" class="completion-actions__draft-notice">
          {{ $t('importSource.draftNotice') }}
        </p>
        <p v-else-if="stats" class="completion-actions__stats">
          {{ stats.characters }} characters · {{ stats.chapters }} chapters · {{ stats.scenes }} scenes · {{ stats.knowledge }} knowledge
        </p>
      </div>
    </header>

    <div class="completion-actions__cards">
      <button class="completion-actions__card" @click="$emit('play')">
        <IonIcon :icon="playCircleOutline" />
        <span>{{ $t('importSource.actionPlay') }}</span>
      </button>
      <button class="completion-actions__card" @click="$emit('edit')">
        <IonIcon :icon="createOutline" />
        <span>{{ $t('importSource.actionEdit') }}</span>
      </button>
      <button v-if="showExport" class="completion-actions__card" @click="$emit('export')">
        <IonIcon :icon="downloadOutline" />
        <span>{{ $t('importSource.actionExport') }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.completion-actions {
  padding: var(--adv-space-md, 16px);
  background: color-mix(
    in srgb,
    var(--ion-color-success, #2dd36f) 8%,
    var(--adv-surface-card, var(--ion-background-color))
  );
  border: 1px solid color-mix(in srgb, var(--ion-color-success, #2dd36f) 30%, transparent);
  border-radius: var(--adv-radius-lg, 12px);
}

.completion-actions__header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: var(--adv-space-md, 16px);
}
.completion-actions__header-icon {
  font-size: var(--adv-font-display);
  color: var(--ion-color-success, #2dd36f);
  flex-shrink: 0;
}
.completion-actions__header h3 {
  margin: 0 0 4px;
  font-size: 1.1rem;
  font-weight: 600;
}
.completion-actions__stats,
.completion-actions__draft-notice {
  margin: 0;
  font-size: 0.82rem;
  color: var(--ion-color-medium, #92949c);
}
.completion-actions__draft-notice {
  color: var(--ion-color-warning, #ffc409);
}

.completion-actions__cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--adv-space-sm, 8px);
}

.completion-actions__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: var(--adv-space-md, 14px) var(--adv-space-sm, 10px);
  background: var(--adv-surface-card, var(--ion-background-color));
  border: 1px solid var(--adv-border-subtle, rgba(120, 120, 120, 0.2));
  border-radius: var(--adv-radius-md, 10px);
  cursor: pointer;
  color: var(--ion-text-color, inherit);
  font-size: 0.85rem;
  font-weight: 500;
  transition:
    border-color 0.15s ease-out,
    transform 0.1s ease-out;
}
.completion-actions__card:hover {
  border-color: var(--ion-color-primary);
  color: var(--ion-color-primary);
}
.completion-actions__card:active {
  transform: scale(0.98);
}
.completion-actions__card ion-icon {
  font-size: var(--adv-font-lg);
}
</style>
