<script setup lang="ts">
import { useAdvContext } from '@advjs/client'
import { computed, ref, useId, watch } from 'vue'
import { audioLibrarySrc, useAudioLibrary } from '../../../composables/useAudioLibrary'
import '../../../styles/resource-panel.scss'

withDefaults(defineProps<{ visible?: boolean }>(), { visible: true })
const { $adv } = useAdvContext()
const audioStore = useAudioStore()
const app = useAppStore()
const fileStore = useFileStore()
const monacoStore = useMonacoStore()
const fieldId = useId()
const search = ref('')
const { load, cancel, loading, failed } = useAudioLibrary((data, url) => {
  audioStore.bgmLibraryData = data
  app.activeInspector = 'file'
  monacoStore.fileContent = JSON.stringify(data, null, 2)
  fileStore.fileName = url
})
watch(() => audioStore.bgmLibraryUrl, cancel)
const entries = computed(() => {
  const query = search.value.trim().toLowerCase()
  return Object.entries(audioStore.bgmLibraryData).filter(([key, item]) =>
    !query || `${key} ${item.name} ${item.description}`.toLowerCase().includes(query))
})
</script>

<template>
  <div class="ae-resource-panel audio-panel" :aria-busy="loading">
    <AEProjectAudioPanel :visible="visible" />
    <AGUIToolbar :items="[]" :label="$t('audio.title')">
      <template #before-toolbar>
        <span>{{ $t('audio.title') }}</span>
      </template>
      <template #after-toolbar>
        <span class="ae-resource-caption">{{ entries.length }}</span>
      </template>
    </AGUIToolbar>
    <form class="audio-source" @submit.prevent="load(audioStore.bgmLibraryUrl)">
      <AGUIProperty :for="`${fieldId}-source`" :label="$t('audio.source')">
        <AGUIInput :id="`${fieldId}-source`" v-model="audioStore.bgmLibraryUrl" placeholder="https://…/library.json" />
      </AGUIProperty>
      <div class="ae-resource-actions">
        <AGUIButton type="submit" icon="i-ri-refresh-line" :disabled="!audioStore.bgmLibraryUrl.trim()" :loading="loading">
          {{ $t('audio.load') }}
        </AGUIButton>
      </div>
    </form>
    <p v-if="failed" class="ae-resource-error px-2" role="alert">
      {{ $t('audio.loadFailed') }}
    </p>
    <p v-if="loading" class="ae-resource-caption px-2" role="status">
      {{ $t('audio.loading') }}
    </p>
    <div class="p-2">
      <AGUIInput v-model="search" :aria-label="$t('audio.search')" :placeholder="$t('audio.search')" prefix-icon="i-ri-search-line" />
    </div>
    <ul v-if="entries.length" class="ae-resource-list">
      <AEAudioLibraryItem v-for="([key, item]) in entries" :key="key" :visible="visible" :name="`${key} · ${item.name}`" :description="item.description" :src="audioLibrarySrc($adv.config.value.cdn.prefix, item.name)" />
    </ul>
    <p v-else-if="!loading" class="ae-resource-empty" role="status">
      {{ $t(search.trim() ? 'audio.noMatches' : 'audio.empty') }}
    </p>
  </div>
</template>

<style scoped>
.audio-panel {
  height: 100%;
  overflow: auto;
}
.audio-source {
  padding: 8px;
  border-bottom: 1px solid var(--agui-c-divider);
  container: agui-properties / inline-size;
}
</style>
