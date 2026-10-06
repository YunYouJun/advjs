<script setup lang="ts">
import { useProjectAssets } from '~/stores/useProjectAssets'

withDefaults(defineProps<{ visible?: boolean }>(), { visible: true })
const assets = useProjectAssets()
const project = useProjectStore()
const error = ref('')
const pending = ref(false)
async function importAudio(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  pending.value = true
  try {
    await assets.importFile(file, 'bgm')
    error.value = ''
  }
  catch (failure) {
    error.value = String(failure)
  }
  finally {
    pending.value = false
    input.value = ''
  }
}
</script>

<template>
  <section v-if="project.workspace" aria-label="项目音频">
    <AGUIToolbar :items="[]">
      <template #before-toolbar>
        项目音频 · {{ assets.audio.length }}
      </template>
    </AGUIToolbar>
    <label class="ae-resource-row">导入音频<input type="file" accept="audio/*,.wav,.mp3,.ogg,.m4a,.flac,.opus" aria-label="导入项目音频" :disabled="pending" @change="importAudio"></label>
    <p v-if="error" class="ae-resource-error" role="alert">
      {{ error }}
    </p>
    <ul class="ae-resource-list">
      <AEProjectAudioItem v-for="asset in assets.audio" :key="asset.id" :asset="asset" :visible="visible" />
    </ul>
    <p v-if="!assets.audio.length" class="ae-resource-empty">
      导入后音频与元数据会保存到当前项目。
    </p>
  </section>
</template>
