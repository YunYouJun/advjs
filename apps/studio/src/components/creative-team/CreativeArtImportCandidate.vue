<script setup lang="ts">
import type { CreativeArtImportHost } from '../../composables/useCreativeArtImport'
import type { CreativeArtImportEntry } from '../../utils/creativeArtImportCache'
import { onBeforeUnmount, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SButton from '../ui/SButton.vue'

const props = defineProps<{ entry: CreativeArtImportEntry, disabled: boolean, stale: boolean, actual?: 'before' | 'after' | 'conflict', host: () => Promise<CreativeArtImportHost> }>()
defineEmits<{ review: [replace: boolean], adopt: [], undo: [], reconcile: [], discard: [], abandon: [] }>()
const { t } = useI18n()
const src = shallowRef('')
const previewError = shallowRef(false)
let version = 0
function release() {
  if (src.value)
    URL.revokeObjectURL(src.value)
  src.value = ''
}
watch(() => props.entry, async (entry) => {
  const turn = ++version
  release()
  previewError.value = false
  try {
    let blob: Blob | undefined
    if (entry.data) {
      blob = new Blob([entry.data], { type: entry.image.mimeType })
    }
    else if (entry.review) {
      const host = await props.host()
      blob = await host.fs.readBlob(entry.review.mediaPath)
      host.assertCurrent()
    }
    if (turn === version && blob)
      src.value = URL.createObjectURL(blob)
  }
  catch {
    if (turn === version)
      previewError.value = true
  }
}, { immediate: true })
onBeforeUnmount(() => {
  version += 1
  release()
})
</script>

<template>
  <article class="art-candidate" data-testid="creative-art-candidate">
    <h3 class="art-candidate__title">
      {{ entry.request.assetId }} · {{ t(`creativeTeam.artImport.state.${entry.state}`) }}
    </h3>
    <p v-if="stale && entry.state === 'candidate'" role="status">
      {{ t('creativeTeam.artImport.stale') }}
    </p>
    <p v-if="actual === 'conflict'" role="status">
      {{ t('creativeTeam.artImport.conflict') }}
    </p>
    <img v-if="src" class="art-candidate__image" :src="src" :alt="entry.request.assetId" @error="previewError = true">
    <p v-if="previewError" role="status">
      {{ t('creativeTeam.artImport.previewError') }}
    </p>
    <p>{{ entry.fileName }} · {{ entry.image.width }} × {{ entry.image.height }} · {{ (entry.image.bytes / 1024).toFixed(1) }} KiB · {{ entry.image.mimeType }}</p>
    <p>{{ t('creativeTeam.artImport.targetSize', { width: entry.request.width, height: entry.request.height }) }}</p>
    <p v-if="entry.image.width !== entry.request.width || entry.image.height !== entry.request.height">
      {{ t('creativeTeam.artImport.sizeDifference') }}
    </p>
    <p>{{ entry.attribution }} <span v-if="entry.license">· {{ entry.license }}</span></p>
    <details class="art-candidate__details">
      <summary>{{ t('creativeTeam.artImport.provenance') }}</summary>
      <p>{{ entry.artifactId }} · {{ entry.artifactFingerprint }}</p>
      <p>SHA-256 · {{ entry.image.sha256 }}</p>
    </details>
    <div v-if="entry.state === 'candidate'" class="art-candidate__actions">
      <SButton size="lg" variant="outline" :disabled="disabled || stale" @click="$emit('review', false)">
        {{ t('creativeTeam.artImport.review') }}
      </SButton>
      <SButton size="lg" variant="ghost" :disabled="disabled || stale" @click="$emit('review', true)">
        {{ t('creativeTeam.artImport.reviewReplace') }}
      </SButton>
    </div>
    <details v-if="entry.review" class="art-candidate__details" open>
      <summary>{{ t('creativeTeam.artImport.reviewedFiles') }}</summary>
      <p>{{ entry.review.binding }} · {{ entry.review.mediaPath }}</p>
      <details v-for="change in entry.review.changes" :key="change.path" class="art-candidate__diff">
        <summary>{{ change.path }}</summary>
        <p>{{ t('creativeTeam.milestone.before') }}</p>
        <pre class="art-candidate__source">{{ change.expected ?? t('creativeTeam.milestone.absent') }}</pre>
        <p>{{ t('creativeTeam.milestone.after') }}</p>
        <pre class="art-candidate__source">{{ change.content ?? t('creativeTeam.milestone.absent') }}</pre>
      </details>
    </details>
    <div class="art-candidate__actions">
      <SButton v-if="entry.state === 'candidate' && entry.review" size="lg" :disabled="disabled || stale" @click="$emit('adopt')">
        {{ t('creativeTeam.artImport.adopt') }}
      </SButton>
      <SButton v-if="entry.state === 'adopted' && actual === 'after'" size="lg" variant="outline" :disabled="disabled" @click="$emit('undo')">
        {{ t('creativeTeam.artImport.undo') }}
      </SButton>
      <SButton v-if="['adopting', 'undoing', 'adopted'].includes(entry.state)" size="lg" variant="outline" :disabled="disabled" @click="$emit('reconcile')">
        {{ t('creativeTeam.artImport.reconcile') }}
      </SButton>
      <SButton v-if="entry.state === 'adopting' && actual === 'before'" size="lg" :disabled="disabled || stale" @click="$emit('adopt')">
        {{ t('creativeTeam.artImport.resume') }}
      </SButton>
      <SButton v-if="entry.state === 'undoing' && actual === 'after'" size="lg" variant="outline" :disabled="disabled" @click="$emit('undo')">
        {{ t('creativeTeam.artImport.resumeUndo') }}
      </SButton>
      <SButton v-if="(entry.state === 'adopting' && actual === 'before') || (entry.state === 'undoing' && actual === 'after')" size="lg" variant="ghost" :disabled="disabled" @click="$emit('abandon')">
        {{ t('creativeTeam.artImport.abandon') }}
      </SButton>
      <SButton v-if="['candidate', 'undone'].includes(entry.state)" size="lg" variant="ghost" :disabled="disabled" @click="$emit('discard')">
        {{ t('creativeTeam.artImport.discard') }}
      </SButton>
    </div>
  </article>
</template>

<style scoped>
.art-candidate {
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
  padding: var(--adv-space-md);
  margin-block: var(--adv-space-md);
  overflow-wrap: anywhere;
}
.art-candidate__title {
  font-size: var(--adv-font-title);
}
.art-candidate__image {
  display: block;
  object-fit: contain;
  width: 100%;
  max-height: 320px;
  background: var(--adv-surface-page);
}
.art-candidate__actions {
  display: flex;
  gap: var(--adv-space-sm);
  flex-wrap: wrap;
  margin-block: var(--adv-space-sm);
}
.art-candidate__details,
.art-candidate__diff {
  margin-block: var(--adv-space-sm);
}
.art-candidate__details summary,
.art-candidate__diff summary {
  cursor: pointer;
  min-height: 44px;
}
.art-candidate__details summary:focus-visible,
.art-candidate__diff summary:focus-visible {
  outline: 3px solid var(--adv-primary-soft);
}
.art-candidate__source {
  white-space: pre-wrap;
  font-family: var(--adv-font-mono);
  max-height: 300px;
  overflow: auto;
}
</style>
