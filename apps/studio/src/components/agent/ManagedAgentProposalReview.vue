<script setup lang="ts">
import type { AgentProposalFileReview } from '@advjs/agent'
import { IonIcon, IonModal } from '@ionic/vue'
import { alertCircleOutline, checkmarkCircleOutline, closeOutline, documentTextOutline, shieldCheckmarkOutline } from 'ionicons/icons'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAgentProposalSession } from '../../composables/useAgentProposalSession'
import { useAgentProposalStore } from '../../stores/useAgentProposalStore'
import { computeLineDiff } from '../../utils/lineDiff'
import FileDiffPreview from '../FileDiffPreview.vue'
import SButton from '../ui/SButton.vue'

const { locale } = useI18n()
const store = useAgentProposalStore()
const {
  candidate,
  review,
  applied,
  error,
  isReviewing,
  isApplying,
  isUndoing,
  isOpen,
  canApply,
  canUndo,
} = storeToRefs(store)
const selectedPath = ref<string>()

useAgentProposalSession()

watch(review, (next) => {
  if (!next?.files.some(file => file.path === selectedPath.value))
    selectedPath.value = next?.files[0]?.path
}, { immediate: true })

const selectedFile = computed<AgentProposalFileReview | undefined>(() => (
  review.value?.files.find(file => file.path === selectedPath.value)
))
const selectedDiff = computed(() => selectedFile.value
  ? computeLineDiff(selectedFile.value.path, selectedFile.value.before, selectedFile.value.after)
  : undefined)
const diagnostics = computed(() => {
  const server = candidate.value?.proposal.diagnostics ?? []
  const paths = new Set(review.value?.files.map(file => file.path) ?? [])
  const validation = (review.value?.validationDiagnostics ?? [])
    .filter(item => !item.path || paths.has(item.path))
    .map(item => ({
      code: item.code,
      message: item.message,
      path: item.path,
      severity: item.severity,
    }))
  return [...server, ...validation]
})
const isDiagnosticOnly = computed(() => Boolean(review.value && review.value.files.length === 0))

function formatPoints(microPoints: number): string {
  return new Intl.NumberFormat(locale.value, { maximumFractionDigits: 3 }).format(microPoints / 1_000)
}
</script>

<template>
  <IonModal
    :is-open="isOpen"
    css-class="managed-proposal-modal"
    :aria-label="$t('proposalReview.title')"
    @did-dismiss="store.close"
  >
    <div class="proposal-review">
      <header class="proposal-review__header">
        <div>
          <p class="proposal-review__eyebrow">
            {{ $t('proposalReview.eyebrow') }}
          </p>
          <h2>{{ $t('proposalReview.title') }}</h2>
        </div>
        <button type="button" class="proposal-review__close" :aria-label="$t('proposalReview.close')" @click="store.close">
          <IonIcon :icon="closeOutline" aria-hidden="true" />
        </button>
      </header>

      <div v-if="candidate" class="proposal-review__summary">
        <div>
          <IonIcon :icon="shieldCheckmarkOutline" aria-hidden="true" />
          <p>
            <strong>{{ candidate.proposal.summary }}</strong>
            <span>{{ $t('proposalReview.reviewBeforeApply') }}</span>
          </p>
        </div>
        <p class="proposal-review__charge">
          <span>{{ $t('proposalReview.charged') }}</span>
          <strong>{{ formatPoints(candidate.usage.chargedMicroPoints) }}</strong>
          <small>{{ $t('proposalReview.aiPoints') }}</small>
        </p>
      </div>

      <div v-if="applied" class="proposal-review__success" role="status">
        <IonIcon :icon="checkmarkCircleOutline" aria-hidden="true" />
        <div>
          <strong>{{ $t('proposalReview.appliedTitle') }}</strong>
          <p>{{ $t('proposalReview.appliedBody', { count: applied.changedPaths.length }) }}</p>
        </div>
      </div>

      <div v-if="error" class="proposal-review__error" role="alert">
        <IonIcon :icon="alertCircleOutline" aria-hidden="true" />
        <div>
          <strong>{{ $t(`proposalReview.errors.${error.code}`) }}</strong>
          <p>{{ $t('proposalReview.errorSafety') }}</p>
        </div>
      </div>

      <div v-if="isReviewing" class="proposal-review__loading" role="status">
        {{ $t('proposalReview.validating') }}
      </div>

      <div v-else-if="review" class="proposal-review__workspace">
        <aside class="proposal-review__files" :aria-label="$t('proposalReview.affectedFiles')">
          <p>{{ $t('proposalReview.affectedFiles') }} · {{ review.files.length }}</p>
          <button
            v-for="file in review.files"
            :key="file.path"
            type="button"
            :class="{ 'proposal-review__file--active': file.path === selectedPath }"
            @click="selectedPath = file.path"
          >
            <IonIcon :icon="documentTextOutline" aria-hidden="true" />
            <span>
              {{ file.path }}
              <small>{{ file.operations.join(' · ') }}</small>
            </span>
          </button>
        </aside>

        <main class="proposal-review__diff" aria-live="polite">
          <div v-if="selectedDiff" class="proposal-review__diff-inner">
            <FileDiffPreview :diff="selectedDiff" />
          </div>
          <p v-else class="proposal-review__empty">
            {{ $t('proposalReview.noChanges') }}
          </p>
        </main>
      </div>

      <section v-if="diagnostics.length" class="proposal-review__diagnostics" :aria-label="$t('proposalReview.diagnostics')">
        <h3>{{ $t('proposalReview.diagnostics') }}</h3>
        <ul>
          <li v-for="(diagnostic, index) in diagnostics" :key="`${diagnostic.code}:${diagnostic.path}:${index}`">
            <strong>{{ diagnostic.code }}</strong>
            <span>{{ diagnostic.message }}</span>
            <code v-if="diagnostic.path">{{ diagnostic.path }}</code>
          </li>
        </ul>
      </section>

      <footer class="proposal-review__footer">
        <p>{{ $t('proposalReview.noAutoApply') }}</p>
        <div>
          <SButton v-if="error?.code === 'baseline_conflict'" variant="outline" :loading="isReviewing" @click="store.refreshReview">
            {{ $t('proposalReview.reviewAgain') }}
          </SButton>
          <SButton v-if="canUndo" variant="outline" :loading="isUndoing" @click="store.undo">
            {{ $t('proposalReview.undo') }}
          </SButton>
          <SButton v-else-if="isDiagnosticOnly" variant="primary" @click="store.close">
            {{ $t('proposalReview.done') }}
          </SButton>
          <SButton
            v-else
            variant="primary"
            :disabled="!canApply"
            :loading="isApplying"
            @click="store.apply"
          >
            {{ $t('proposalReview.apply') }}
          </SButton>
        </div>
      </footer>
    </div>
  </IonModal>
</template>

<style scoped>
.proposal-review {
  --review-ink: #17131f;
  --review-purple: #7c3aed;
  --review-gold: #d4a853;
  --review-paper: #f7f5fb;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  color: var(--adv-text-primary);
  background: var(--adv-surface-page);
}

.proposal-review__header,
.proposal-review__summary,
.proposal-review__footer,
.proposal-review__success,
.proposal-review__error {
  display: flex;
  align-items: center;
}

.proposal-review__header {
  justify-content: space-between;
  padding: 18px 22px;
  color: var(--review-paper);
  background: var(--review-ink);
}

.proposal-review__header h2 {
  margin: 2px 0 0;
  font-size: 21px;
}

.proposal-review__eyebrow {
  margin: 0;
  color: var(--review-gold);
  font-family: var(--adv-font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
}

.proposal-review__close {
  display: grid;
  width: 44px;
  height: 44px;
  padding: 0;
  color: var(--review-paper);
  border: 1px solid rgba(247, 245, 251, 0.18);
  border-radius: 4px;
  background: transparent;
  place-items: center;
  cursor: pointer;
}

.proposal-review__summary {
  justify-content: space-between;
  gap: 18px;
  padding: 14px 22px;
  border-bottom: 1px solid var(--adv-border-subtle);
  background: var(--adv-surface-card);
}

.proposal-review__summary > div {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}

.proposal-review__summary ion-icon {
  flex: 0 0 auto;
  margin-top: 2px;
  color: var(--review-purple);
  font-size: 22px;
}

.proposal-review__summary p {
  margin: 0;
}

.proposal-review__summary strong,
.proposal-review__summary span {
  display: block;
}

.proposal-review__summary span {
  margin-top: 4px;
  color: var(--adv-text-secondary);
  font-size: 12px;
}

.proposal-review__charge {
  flex: 0 0 auto;
  text-align: right;
}

.proposal-review__charge strong {
  color: #9a6c18;
  font-family: var(--adv-font-mono);
  font-size: 22px;
}

.proposal-review__charge small {
  color: var(--adv-text-tertiary);
}

.proposal-review__workspace {
  display: grid;
  grid-template-columns: 230px minmax(0, 1fr);
  min-height: 0;
  flex: 1;
}

.proposal-review__files {
  overflow: auto;
  padding: 14px 12px;
  border-right: 1px solid var(--adv-border-subtle);
  background: var(--adv-surface-card);
}

.proposal-review__files > p {
  margin: 0 8px 10px;
  color: var(--adv-text-tertiary);
  font-family: var(--adv-font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.proposal-review__files button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  margin-bottom: 4px;
  padding: 8px 10px;
  color: var(--adv-text-secondary);
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.proposal-review__files button span {
  display: block;
  overflow: hidden;
  font-family: var(--adv-font-mono);
  font-size: 11px;
  text-overflow: ellipsis;
}

.proposal-review__files button small {
  display: block;
  margin-top: 3px;
  color: var(--adv-text-tertiary);
  font-size: 9px;
  text-transform: uppercase;
}

.proposal-review__file--active {
  color: var(--review-purple) !important;
  border-color: rgba(124, 58, 237, 0.24) !important;
  background: rgba(124, 58, 237, 0.07) !important;
}

.proposal-review__diff {
  min-width: 0;
  overflow: auto;
  padding: 14px 18px 24px;
}

.proposal-review__diff-inner :deep(.fdp) {
  margin-top: 0;
  border-radius: 5px;
}

.proposal-review__diff-inner :deep(.fdp__header) {
  min-height: 44px;
}

.proposal-review__success,
.proposal-review__error {
  gap: 10px;
  margin: 12px 22px 0;
  padding: 10px 12px;
  border: 1px solid rgba(84, 214, 178, 0.4);
  background: rgba(84, 214, 178, 0.08);
}

.proposal-review__error {
  border-color: rgba(223, 91, 99, 0.4);
  background: rgba(223, 91, 99, 0.08);
}

.proposal-review__success p,
.proposal-review__error p {
  margin: 3px 0 0;
  color: var(--adv-text-secondary);
  font-size: 12px;
}

.proposal-review__loading,
.proposal-review__empty {
  display: grid;
  min-height: 180px;
  color: var(--adv-text-secondary);
  place-items: center;
}

.proposal-review__diagnostics {
  max-height: 150px;
  overflow: auto;
  padding: 10px 22px;
  border-top: 1px solid var(--adv-border-subtle);
  background: var(--adv-surface-card);
}

.proposal-review__diagnostics h3 {
  margin: 0 0 6px;
  font-size: 12px;
}

.proposal-review__diagnostics ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.proposal-review__diagnostics li {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 8px;
  padding: 4px 0;
  font-size: 11px;
}

.proposal-review__diagnostics code {
  color: var(--adv-text-tertiary);
}

.proposal-review__footer {
  justify-content: space-between;
  gap: 16px;
  min-height: 72px;
  padding: 12px 22px;
  border-top: 1px solid var(--adv-border-subtle);
  background: var(--adv-surface-card);
}

.proposal-review__footer > p {
  margin: 0;
  color: var(--adv-text-secondary);
  font-size: 11px;
}

.proposal-review__footer > div {
  display: flex;
  gap: 8px;
}

.proposal-review__footer :deep(.s-button) {
  min-height: 44px;
}

.proposal-review__close:focus-visible,
.proposal-review__files button:focus-visible {
  outline: 3px solid var(--review-gold);
  outline-offset: 2px;
}

@media (max-width: 767px) {
  .proposal-review__header,
  .proposal-review__summary,
  .proposal-review__footer {
    padding-inline: 14px;
  }

  .proposal-review__summary {
    align-items: flex-start;
  }

  .proposal-review__workspace {
    display: flex;
    flex-direction: column;
  }

  .proposal-review__files {
    display: flex;
    flex: 0 0 auto;
    gap: 6px;
    padding: 10px 14px;
    border-right: 0;
    border-bottom: 1px solid var(--adv-border-subtle);
  }

  .proposal-review__files > p {
    display: none;
  }

  .proposal-review__files button {
    width: auto;
    max-width: 220px;
    margin: 0;
  }

  .proposal-review__diff {
    padding: 10px 12px 18px;
  }

  .proposal-review__footer {
    align-items: stretch;
    flex-direction: column;
  }

  .proposal-review__footer > div,
  .proposal-review__footer :deep(.s-button) {
    width: 100%;
  }
}
</style>

<style>
ion-modal.managed-proposal-modal {
  --width: min(1040px, calc(100vw - 48px));
  --height: min(820px, calc(100vh - 48px));
  --border-radius: 8px;
}

@media (max-width: 767px) {
  ion-modal.managed-proposal-modal {
    --width: 100%;
    --height: 100%;
    --border-radius: 0;
  }
}
</style>
