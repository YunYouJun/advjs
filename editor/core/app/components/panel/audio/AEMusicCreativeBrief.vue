<script setup lang="ts">
import type { AdvMusicMetadata } from '@advjs/types'
import { exportMusicBrief, parseMusicMetadata } from '@advjs/audio'
import AGUIDetails from '@advjs/gui/components/AGUIDetails.vue'
import AGUIButton from '@advjs/gui/components/button/AGUIButton.vue'
import { onBeforeUnmount, shallowRef } from 'vue'
import AEMusicMetadataFields from './AEMusicMetadataFields.vue'

defineProps<{ modelValue: AdvMusicMetadata, disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: AdvMusicMetadata] }>()
const error = shallowRef('')
const status = shallowRef('')
const downloads = new Map<string, ReturnType<typeof setTimeout>>()
function downloadContent(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
  // Let Safari consume the download before releasing its finite Blob URL.
  downloads.set(url, setTimeout(() => {
    URL.revokeObjectURL(url)
    downloads.delete(url)
  }, 5000))
}
function download(value: AdvMusicMetadata, format: 'json' | 'text') {
  try {
    const music = parseMusicMetadata(JSON.parse(JSON.stringify(value)))
    downloadContent(format === 'json' ? `${JSON.stringify(music, null, 2)}\n` : exportMusicBrief(music), `music-brief.${format === 'json' ? 'json' : 'txt'}`, format === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8')
    error.value = ''
  }
  catch (failure) { error.value = failure instanceof Error ? failure.message : String(failure) }
}
async function copy(value: AdvMusicMetadata) {
  let content: string
  try {
    content = exportMusicBrief(JSON.parse(JSON.stringify(value)))
  }
  catch (failure) {
    error.value = failure instanceof Error ? failure.message : String(failure)
    return
  }
  try {
    await navigator.clipboard.writeText(content)
    status.value = '文本方案已复制。'
    error.value = ''
  }
  catch {
    downloadContent(content, 'music-brief.txt', 'text/plain;charset=utf-8')
    status.value = '剪贴板不可用，已下载文本方案。'
  }
}
onBeforeUnmount(() => {
  for (const [url, timer] of downloads) {
    clearTimeout(timer)
    URL.revokeObjectURL(url)
  }
  downloads.clear()
})
</script>

<template>
  <AGUIDetails title="音乐创作方案与文件回流（可选）" class="ae-music-brief">
    <p class="ae-resource-caption">
      自主创作，或将方案手动交给音乐工具；下载有权使用的音频后导入当前项目。此处不会生成、下载歌曲或调用付费 API。
    </p>
    <AEMusicMetadataFields :model-value="modelValue" :disabled="disabled" @update:model-value="emit('update:modelValue', $event)" />
    <div class="ae-resource-actions">
      <AGUIButton :disabled="disabled" data-testid="music-brief-export" @click="download(modelValue, 'json')">
        下载方案 JSON
      </AGUIButton>
      <AGUIButton :disabled="disabled" data-testid="music-brief-copy" @click="copy(modelValue)">
        复制文本方案
      </AGUIButton>
      <AGUIButton :disabled="disabled" @click="download(modelValue, 'text')">
        下载文本方案
      </AGUIButton>
      <a href="https://suno.com/create" target="_blank" rel="noopener noreferrer" class="ae-music-external">打开 Suno 创作 ↗</a>
    </div>
    <p v-if="error" role="alert" class="ae-resource-error">
      {{ error }}
    </p>
    <p v-if="status" role="status" class="ae-resource-caption">
      {{ status }}
    </p>
  </AGUIDetails>
</template>

<style scoped>
.ae-music-brief {
  margin-top: 8px;
}
.ae-music-external {
  color: var(--agui-c-link);
  font-size: 12px;
}
.ae-music-external:focus-visible {
  outline: 1px solid var(--agui-c-focus);
  outline-offset: 2px;
}
</style>
