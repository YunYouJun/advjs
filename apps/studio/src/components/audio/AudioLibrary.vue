<script setup lang="ts">
import type { AdvAssetEntry, AdvMusicMetadata, VoiceAuthoringSnapshot } from '@advjs/types'
import type { StudioAudioMetadata } from './AudioAssetForm.vue'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { filterStudioAudioAssets, isLedgerAudioAsset, studioAudioKinds } from '../../utils/audioWorkspace'
import SButton from '../ui/SButton.vue'
import SInput from '../ui/SInput.vue'
import SSelect from '../ui/SSelect.vue'
import AudioAssetForm from './AudioAssetForm.vue'
import AudioMusicBrief from './AudioMusicBrief.vue'
import AudioMusicReview from './AudioMusicReview.vue'

const props = withDefaults(defineProps<{ snapshot: VoiceAuthoringSnapshot, busy: boolean, active?: boolean, scopeKey?: string, revision?: string, auditionedMusic?: Record<string, string> }>(), { active: true, scopeKey: '', revision: '', auditionedMusic: () => ({}) })
const emit = defineEmits<{
  preview: [assetId: string, sha256?: string]
  import: [data: StudioAudioMetadata, file: File, expectedRevision: string, saved: () => void]
  update: [assetId: string, data: StudioAudioMetadata, expectedRevision: string, saved: () => void]
  reviewMusic: [assetId: string, sha256: string, status: 'approved' | 'rejected']
  bindMusic: [assetId: string]
  remove: [assetId: string]
}>()
const { t } = useI18n()
const query = shallowRef('')
const kind = shallowRef('all')
const importing = shallowRef(false)
const importMusic = shallowRef<AdvMusicMetadata>()
const draftRevision = shallowRef(props.revision)
const editing = shallowRef<AdvAssetEntry>()
const options = computed(() => [{ value: 'all', label: t('audioWorkspace.allKinds') }, ...studioAudioKinds.map(value => ({ value, label: t(`audioWorkspace.kind.${value}`) }))])
const assets = computed(() => filterStudioAudioAssets(props.snapshot.catalog.assets, kind.value, query.value))
const protectedIds = computed(() => new Set(props.snapshot.catalog.assets.filter(asset => isLedgerAudioAsset(props.snapshot, asset.id)).map(asset => asset.id)))

function openImport(music?: AdvMusicMetadata) {
  draftRevision.value = props.revision
  importMusic.value = music
  importing.value = true
  editing.value = undefined
}
function editAsset(asset: AdvAssetEntry) {
  draftRevision.value = props.revision
  editing.value = asset
  importing.value = false
}
function save(data: StudioAudioMetadata, file?: File) {
  const draftAsset = editing.value
  const capturedRevision = draftRevision.value
  const saved = () => {
    if (draftRevision.value === capturedRevision && editing.value === draftAsset) {
      editing.value = undefined
      importing.value = false
      importMusic.value = undefined
    }
  }
  if (draftAsset)
    emit('update', draftAsset.id, data, capturedRevision, saved)
  else if (file)
    emit('import', data, file, capturedRevision, saved)
}
</script>

<template>
  <section class="audio-library" aria-labelledby="audio-library-title">
    <div class="audio-library__heading">
      <h2 id="audio-library-title" class="audio-library__title">
        {{ t('audioWorkspace.library') }}
      </h2>
      <SButton size="lg" :disabled="busy" @click="openImport()">
        {{ t('audioWorkspace.importAsset') }}
      </SButton>
    </div>
    <p class="audio-library__hint">
      {{ t('audioWorkspace.catalogHint') }}
    </p>
    <AudioMusicBrief :key="scopeKey" :active="active" :busy="busy" @import="openImport" />
    <div v-if="importing || editing" class="audio-library__editor">
      <h3>{{ t(editing ? 'audioWorkspace.editMetadata' : 'audioWorkspace.importAsset') }}</h3>
      <AudioAssetForm :key="editing?.id ?? JSON.stringify(importMusic)" :asset="editing" :initial-music="importMusic" :busy="busy" :immutable="editing && protectedIds.has(editing.id)" @save="save" @cancel="importing = false; editing = undefined" />
    </div>
    <div class="audio-library__filters">
      <SInput v-model="query" size="lg" :placeholder="t('audioWorkspace.searchAssets')" :aria-label="t('audioWorkspace.searchAssets')" />
      <SSelect v-model="kind" size="lg" :options="options" :aria-label="t('audioWorkspace.purpose')" />
    </div>
    <p v-if="!assets.length" class="audio-library__empty">
      {{ t('audioWorkspace.noAssets') }}
    </p>
    <article v-for="asset in assets" :key="asset.id" class="audio-library__asset" :data-asset-id="asset.id">
      <div class="audio-library__asset-heading">
        <h3>{{ asset.title || asset.id }}</h3>
        <span class="audio-library__kind">{{ studioAudioKinds.includes(asset.kind as any) ? t(`audioWorkspace.kind.${asset.kind}`) : asset.kind }}</span>
      </div>
      <code class="audio-library__id">{{ asset.id }}</code>
      <p class="audio-library__hint">
        {{ asset.mimeType || t('audioWorkspace.unknownFormat') }}<template v-if="asset.duration">
          · {{ asset.duration.toFixed(1) }}s
        </template><template v-if="asset.bytes">
          · {{ (asset.bytes / 1024).toFixed(1) }} KB
        </template>
      </p>
      <p v-if="asset.labels?.length || asset.license" class="audio-library__hint">
        {{ asset.labels?.join(' · ') }}<template v-if="asset.license">
          · {{ asset.license }}
        </template>
      </p>
      <p v-if="protectedIds.has(asset.id)" class="audio-library__hint">
        {{ t('audioWorkspace.immutableTake') }}
      </p>
      <AudioMusicReview v-if="asset.kind === 'bgm'" :asset="asset" :active="active" :busy="busy" :auditioned="auditionedMusic[asset.id] === JSON.stringify([asset.sha256, asset.license, asset.music])" @review="emit('reviewMusic', asset.id, asset.sha256!, $event)" @bind="emit('bindMusic', asset.id)" />
      <div class="audio-library__actions">
        <SButton size="lg" variant="secondary" :disabled="busy" @click="emit('preview', asset.id, asset.kind === 'bgm' ? asset.sha256 : undefined)">
          {{ t('audioWorkspace.preview') }}
        </SButton>
        <SButton size="lg" variant="outline" :disabled="busy" @click="editAsset(asset)">
          {{ t('audioWorkspace.editMetadata') }}
        </SButton>
        <SButton size="lg" variant="ghost" :disabled="busy || protectedIds.has(asset.id)" @click="emit('remove', asset.id)">
          {{ t('audioWorkspace.removeAsset') }}
        </SButton>
      </div>
    </article>
  </section>
</template>

<style scoped>
.audio-library {
  display: grid;
  gap: var(--adv-space-md);
}
.audio-library__heading,
.audio-library__asset-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.audio-library__title {
  margin: 0;
  font-size: var(--adv-font-title);
}
.audio-library__hint {
  margin: 0;
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-secondary);
  overflow-wrap: anywhere;
}
.audio-library__editor {
  padding: 16px;
  background: var(--adv-surface-elevated);
  border-radius: var(--adv-radius-md);
}
.audio-library__editor h3 {
  margin: 0 0 16px;
  font-size: var(--adv-font-subtitle);
}
.audio-library__filters {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
}
.audio-library__asset {
  min-width: 0;
  display: grid;
  gap: 8px;
  padding: 16px;
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-md);
}
.audio-library__asset h3 {
  margin: 0;
  font-size: var(--adv-font-subtitle);
  overflow-wrap: anywhere;
}
.audio-library__kind {
  padding: 4px 8px;
  font-size: var(--adv-font-body-sm);
  background: var(--adv-surface-elevated);
  border-radius: var(--adv-radius-full);
}
.audio-library__id {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-secondary);
  overflow-wrap: anywhere;
}
.audio-library__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.audio-library__empty {
  padding: 24px 0;
  color: var(--adv-text-secondary);
  text-align: center;
}
@media (min-width: 768px) {
  .audio-library__filters {
    grid-template-columns: minmax(0, 1fr) minmax(180px, 240px);
  }
}
</style>
