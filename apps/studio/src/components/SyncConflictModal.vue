<!--
  SyncConflictModal — surfaces per-file sync conflicts and lets the user pick
  which side wins per file. Used by the Sync flow in `useCloudSync.ts`.

  Why a per-file picker (not a global "use all local"/"use all cloud")?
    Real conflicts cluster around 1–3 files at a time. Letting the user pick
    individually is more correct (mixed conflicts are common: e.g. local has
    fresh dialogue tweaks, cloud has fresh chapter restructure — keep both).
    A global "Apply all = local" button is included as an escape hatch.

  Diff rendering reuses `FileDiffPreview` which already handles markdown and
  collapsible context — no need for a new diff component.
-->
<script setup lang="ts">
import type { ConflictFile } from '../utils/cloudSync'
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import {
  closeOutline,
  cloudDownloadOutline,
  cloudUploadOutline,
  removeOutline,
  warningOutline,
} from 'ionicons/icons'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { computeLineDiff } from '../utils/lineDiff'
import FileDiffPreview from './FileDiffPreview.vue'

export type ResolutionChoice = 'use-local' | 'use-cloud' | 'skip'

const props = defineProps<{
  isOpen: boolean
  conflicts: ConflictFile[]
}>()

const emit = defineEmits<{
  resolve: [resolutions: Map<string, ResolutionChoice>]
  dismiss: []
}>()

const { t } = useI18n()

/** Per-conflict pick. `path → choice`. Defaults all to 'skip' on open. */
const choices = ref<Map<string, ResolutionChoice>>(new Map())

watch(
  () => props.conflicts,
  (next) => {
    const m = new Map<string, ResolutionChoice>()
    for (const c of next) m.set(c.path, 'skip')
    choices.value = m
  },
  { immediate: true },
)

function setChoice(path: string, choice: ResolutionChoice) {
  // Vue Map reactivity needs a fresh Map reference for the watch to fire.
  const m = new Map(choices.value)
  m.set(path, choice)
  choices.value = m
}

function setAll(choice: ResolutionChoice) {
  const m = new Map<string, ResolutionChoice>()
  for (const c of props.conflicts) m.set(c.path, choice)
  choices.value = m
}

const unresolvedCount = computed(
  () => props.conflicts.filter(c => choices.value.get(c.path) === 'skip').length,
)

function diffFor(conflict: ConflictFile) {
  // Display: cloud → local (treat cloud as "before", local as "after").
  // Visually this means red lines = exists in cloud only, green = local only.
  return computeLineDiff(conflict.path, conflict.cloudContent, conflict.localContent)
}

function fmtTime(ms: number): string {
  if (!ms)
    return '-'
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function handleApply() {
  emit('resolve', new Map(choices.value))
}

function handleDismiss() {
  emit('dismiss')
}
</script>

<template>
  <IonModal :is-open="isOpen" @did-dismiss="handleDismiss">
    <IonHeader>
      <IonToolbar>
        <IonTitle>
          <span class="conflict-modal__title">
            <IonIcon :icon="warningOutline" aria-hidden="true" />
            {{ t('syncConflict.title', { count: conflicts.length }) }}
          </span>
        </IonTitle>
        <IonButton slot="end" fill="clear" :aria-label="t('common.cancel')" @click="handleDismiss">
          <IonIcon :icon="closeOutline" />
        </IonButton>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <div class="conflict-modal__intro">
        <p>{{ t('syncConflict.intro') }}</p>
        <div class="conflict-modal__bulk">
          <button type="button" class="conflict-modal__bulk-btn" @click="setAll('use-local')">
            <IonIcon :icon="cloudUploadOutline" aria-hidden="true" />
            {{ t('syncConflict.applyAllLocal') }}
          </button>
          <button type="button" class="conflict-modal__bulk-btn" @click="setAll('use-cloud')">
            <IonIcon :icon="cloudDownloadOutline" aria-hidden="true" />
            {{ t('syncConflict.applyAllCloud') }}
          </button>
        </div>
      </div>

      <div class="conflict-modal__list">
        <article
          v-for="c in conflicts"
          :key="c.path"
          class="conflict-card"
          :data-choice="choices.get(c.path)"
        >
          <header class="conflict-card__head">
            <span class="conflict-card__path">{{ c.path }}</span>
            <span class="conflict-card__times">
              <span>{{ t('syncConflict.localMtime') }}: {{ fmtTime(c.localMtime) }}</span>
              <span aria-hidden="true">·</span>
              <span>{{ t('syncConflict.cloudMtime') }}: {{ fmtTime(c.cloudMtime) }}</span>
            </span>
          </header>

          <p v-if="c.binary" class="conflict-card__binary">
            {{ t('syncConflict.binaryPreviewUnavailable') }}
          </p>
          <FileDiffPreview v-else :diff="diffFor(c)" />

          <div class="conflict-card__actions" role="radiogroup" :aria-label="c.path">
            <button
              type="button"
              class="conflict-card__action"
              :class="{ 'is-active': choices.get(c.path) === 'use-local' }"
              role="radio"
              :aria-checked="choices.get(c.path) === 'use-local' ? 'true' : 'false'"
              @click="setChoice(c.path, 'use-local')"
            >
              <IonIcon :icon="cloudUploadOutline" aria-hidden="true" />
              {{ t('syncConflict.useLocal') }}
            </button>
            <button
              type="button"
              class="conflict-card__action"
              :class="{ 'is-active': choices.get(c.path) === 'use-cloud' }"
              role="radio"
              :aria-checked="choices.get(c.path) === 'use-cloud' ? 'true' : 'false'"
              @click="setChoice(c.path, 'use-cloud')"
            >
              <IonIcon :icon="cloudDownloadOutline" aria-hidden="true" />
              {{ t('syncConflict.useCloud') }}
            </button>
            <button
              type="button"
              class="conflict-card__action"
              :class="{ 'is-active': choices.get(c.path) === 'skip' }"
              role="radio"
              :aria-checked="choices.get(c.path) === 'skip' ? 'true' : 'false'"
              @click="setChoice(c.path, 'skip')"
            >
              <IonIcon :icon="removeOutline" aria-hidden="true" />
              {{ t('syncConflict.skip') }}
            </button>
          </div>
        </article>
      </div>

      <footer class="conflict-modal__footer">
        <span class="conflict-modal__pending">
          {{ t('syncConflict.unresolved', { count: unresolvedCount }) }}
        </span>
        <IonButton fill="clear" @click="handleDismiss">
          {{ t('common.cancel') }}
        </IonButton>
        <IonButton color="primary" @click="handleApply">
          {{ t('syncConflict.apply') }}
        </IonButton>
      </footer>
    </IonContent>
  </IonModal>
</template>

<style scoped>
.conflict-modal__title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.conflict-modal__title ion-icon {
  color: var(--ion-color-warning, #ffc409);
}

.conflict-modal__intro {
  padding: var(--adv-space-md, 16px);
  border-bottom: 1px solid var(--adv-border-subtle, rgba(120, 120, 120, 0.15));
}
.conflict-modal__intro p {
  margin: 0 0 var(--adv-space-sm, 8px);
  font-size: 0.85rem;
  color: var(--ion-color-medium, #92949c);
  line-height: 1.5;
}

.conflict-modal__bulk {
  display: flex;
  gap: var(--adv-space-sm, 8px);
  flex-wrap: wrap;
}
.conflict-modal__bulk-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--adv-border-subtle, rgba(120, 120, 120, 0.2));
  border-radius: var(--adv-radius-md, 8px);
  background: transparent;
  color: var(--ion-text-color, inherit);
  font-size: 0.82rem;
  cursor: pointer;
  font: inherit;
}
.conflict-modal__bulk-btn:hover {
  border-color: var(--ion-color-primary);
  color: var(--ion-color-primary);
}

.conflict-modal__list {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-md, 16px);
  padding: var(--adv-space-md, 16px);
}

.conflict-card {
  border: 1px solid var(--adv-border-subtle, rgba(120, 120, 120, 0.2));
  border-radius: var(--adv-radius-lg, 12px);
  overflow: hidden;
  background: var(--adv-surface-card, var(--ion-background-color));
}
.conflict-card[data-choice='use-local'] {
  border-color: color-mix(in srgb, var(--ion-color-primary) 60%, transparent);
}
.conflict-card[data-choice='use-cloud'] {
  border-color: color-mix(in srgb, var(--ion-color-success, #2dd36f) 60%, transparent);
}

.conflict-card__head {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--adv-space-sm, 8px) var(--adv-space-md, 12px);
  border-bottom: 1px solid var(--adv-border-subtle, rgba(120, 120, 120, 0.15));
  background: color-mix(in srgb, var(--ion-color-warning, #ffc409) 8%, transparent);
}
.conflict-card__path {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.85rem;
  font-weight: 600;
}
.conflict-card__times {
  font-size: 0.72rem;
  color: var(--ion-color-medium, #92949c);
  display: inline-flex;
  gap: 6px;
  flex-wrap: wrap;
}

.conflict-card__binary {
  margin: 0;
  padding: var(--adv-space-md, 16px);
  color: var(--ion-color-medium, #92949c);
  font-size: 0.82rem;
  line-height: 1.5;
}

.conflict-card__actions {
  display: flex;
  gap: var(--adv-space-xs, 6px);
  padding: var(--adv-space-sm, 8px) var(--adv-space-md, 12px);
  border-top: 1px solid var(--adv-border-subtle, rgba(120, 120, 120, 0.15));
  flex-wrap: wrap;
}

.conflict-card__action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--adv-border-subtle, rgba(120, 120, 120, 0.2));
  border-radius: var(--adv-radius-md, 8px);
  background: transparent;
  color: var(--ion-text-color, inherit);
  font: inherit;
  font-size: 0.82rem;
  cursor: pointer;
  transition:
    border-color 0.15s,
    background 0.15s;
}
.conflict-card__action:hover {
  border-color: var(--ion-color-primary);
}
.conflict-card__action.is-active {
  background: color-mix(in srgb, var(--ion-color-primary) 14%, transparent);
  border-color: var(--ion-color-primary);
  color: var(--ion-color-primary);
  font-weight: 600;
}
.conflict-card__action:focus-visible {
  outline: 2px solid var(--ion-color-primary);
  outline-offset: 2px;
}

.conflict-modal__footer {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm, 8px);
  padding: var(--adv-space-md, 12px);
  padding-bottom: calc(var(--adv-space-md, 12px) + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--adv-border-subtle, rgba(120, 120, 120, 0.15));
  background: var(--ion-background-color);
  position: sticky;
  bottom: 0;
}
.conflict-modal__pending {
  margin-right: auto;
  font-size: 0.78rem;
  color: var(--ion-color-medium, #92949c);
}
</style>
