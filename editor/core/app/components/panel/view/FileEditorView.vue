<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, useTemplateRef, watch } from 'vue'
import InspectorFileView from './InspectorFileView.vue'

const props = withDefaults(defineProps<{ visible?: boolean }>(), { visible: true })
const file = useFileStore()
const { locale } = useEditorLocale()
const zh = computed(() => locale.value === 'zh-CN')
const audio = useTemplateRef<HTMLAudioElement>('audio')
const video = useTemplateRef<HTMLVideoElement>('video')
const failed = shallowRef(false)
function stop() {
  audio.value?.pause()
  video.value?.pause()
}
watch(() => props.visible, (visible) => {
  if (!visible)
    stop()
})
watch(() => file.previewUrl, () => {
  stop()
  failed.value = false
})
onBeforeUnmount(stop)
</script>

<template>
  <section class="file-editor" :aria-busy="file.loading">
    <p v-if="!file.fileName" class="file-empty" role="status">
      {{ zh ? '从左侧项目中选择文件，在此预览或编辑。' : 'Select a file in Project to preview or edit it here.' }}
    </p>
    <KeepAlive>
      <InspectorFileView v-if="file.fileName && file.fileKind === 'text'" />
    </KeepAlive>
    <template v-if="file.fileName && file.fileKind !== 'text'">
      <AGUIToolbar :items="[]" :label="zh ? '素材预览' : 'Asset preview'">
        <template #before-toolbar>
          <span class="file-media-title" :title="file.openedFilePath">{{ file.fileName }}</span>
        </template>
      </AGUIToolbar>
      <div class="file-media">
        <p v-if="failed" role="alert">
          {{ zh ? '素材无法预览，请检查文件格式或重新打开。' : 'Could not preview this asset. Check its format or reopen it.' }}
        </p>
        <img v-else-if="file.fileKind === 'image'" :src="file.previewUrl" :alt="file.fileName" @error="failed = true">
        <audio v-else-if="file.fileKind === 'audio'" ref="audio" :src="file.previewUrl" :aria-label="file.fileName" controls preload="none" @error="failed = true" />
        <video v-else-if="file.fileKind === 'video'" ref="video" :src="file.previewUrl" :aria-label="file.fileName" controls preload="metadata" @error="failed = true" />
        <p v-else>
          {{ zh ? '此文件类型暂不支持内容预览，可在右侧查看文件信息。' : 'Preview is unavailable for this file type. File information is shown in the Inspector.' }}
        </p>
      </div>
    </template>
  </section>
</template>

<style scoped>
.file-editor {
  height: 100%;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.file-empty {
  padding: 12px;
  font-size: 13px;
  color: var(--agui-c-text-2);
  line-height: 1.6;
}
.file-media-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-media {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  overflow: auto;
}
.file-media img,
.file-media video {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.file-media audio {
  width: min(100%, 480px);
}
.file-media p {
  font-size: 13px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
</style>
