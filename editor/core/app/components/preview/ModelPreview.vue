<script setup lang="ts">
import { computed } from 'vue'
import { useModelPreview } from '../../composables/useModelPreview'

const props = defineProps<{ src: string, type?: string }>()
const { locale } = useEditorLocale()
const colorMode = useColorMode()
const zh = computed(() => locale.value === 'zh-CN')
const { format, supported, modelState, jsonState, jsonContent, jsonError, viewer, retry } = useModelPreview(() => props.src, () => props.type ?? '')
const canRetry = computed(() => modelState.value === 'error' || jsonState.value === 'error')
</script>

<template>
  <section class="model-preview" :aria-label="zh ? '模型预览' : 'Model preview'">
    <AGUIToolbar :items="[]" :label="zh ? '模型预览' : 'Model preview'">
      <template #before-toolbar>
        <span class="model-preview-title" :title="src">{{ src || (zh ? '模型预览' : 'Model preview') }}</span>
      </template>
      <template #after-toolbar>
        <AGUIButton v-if="canRetry" icon="i-ri-refresh-line" @click="retry">
          {{ zh ? '重试' : 'Retry' }}
        </AGUIButton>
      </template>
    </AGUIToolbar>
    <p v-if="!src" class="model-preview-message" role="status">
      {{ zh ? '未指定模型文件。' : 'No model file selected.' }}
    </p>
    <p v-else-if="!supported" class="model-preview-message" role="status">
      {{ zh ? '此预览支持 glTF 和 GLB 模型。' : 'This preview supports glTF and GLB models.' }}
    </p>
    <div v-else class="model-preview-body" :class="{ 'model-preview-with-source': format === 'gltf' }">
      <div class="model-preview-viewport" :aria-busy="modelState === 'loading'">
        <model-viewer
          v-if="viewer && modelState !== 'error'" :key="viewer.key"
          class="model-preview-canvas" :src="viewer.src" :alt="zh ? '可交互的三维模型' : 'Interactive 3D model'"
          camera-controls @load="viewer.loaded" @error="viewer.failed"
        />
        <p v-if="modelState === 'loading'" class="model-preview-overlay" role="status">
          {{ zh ? '正在加载模型…' : 'Loading model…' }}
        </p>
        <p v-else-if="modelState === 'error'" class="model-preview-message model-preview-error" role="alert">
          {{ zh ? '模型加载失败，请检查文件及其纹理资源后重试。' : 'Model loading failed. Check the file and its textures, then retry.' }}
        </p>
      </div>
      <div v-if="format === 'gltf'" class="model-preview-source" :aria-busy="jsonState === 'loading'">
        <p class="model-preview-source-title">
          {{ zh ? 'glTF 源码' : 'glTF source' }}
        </p>
        <p v-if="jsonState === 'loading'" class="model-preview-message" role="status">
          {{ zh ? '正在读取源码…' : 'Loading source…' }}
        </p>
        <p v-else-if="jsonState === 'error'" class="model-preview-message model-preview-error" role="alert">
          {{ zh ? '源码读取失败：' : 'Source loading failed: ' }}{{ jsonError }}
        </p>
        <LazyMonacoEditor
          v-else-if="jsonState === 'ready'" class="model-preview-code" :model-value="jsonContent" lang="json"
          :options="{ theme: colorMode.value === 'dark' ? 'vs-dark' : 'vs', readOnly: true }"
          :editor-options="{ automaticLayout: true }"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.model-preview {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  min-width: 0;
  container-type: inline-size;
  color: var(--agui-c-text-1);
  background: var(--agui-c-bg-panel);
}
.model-preview-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}
.model-preview-body {
  display: grid;
  flex: 1;
  min-height: 0;
  min-width: 0;
}
.model-preview-with-source {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.model-preview-viewport {
  position: relative;
  min-height: 0;
  min-width: 0;
  background: var(--agui-c-bg-soft);
}
.model-preview-canvas {
  width: 100%;
  height: 100%;
}
.model-preview-source {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  border-left: 1px solid var(--agui-c-divider);
}
.model-preview-source-title {
  margin: 0;
  padding: 4px 8px;
  border-bottom: 1px solid var(--agui-c-divider);
  font-size: 12px;
}
.model-preview-code {
  flex: 1;
  min-height: 0;
}
.model-preview-message,
.model-preview-overlay {
  margin: 0;
  padding: 12px;
  color: var(--agui-c-text-2);
  font-size: 13px;
  overflow-wrap: anywhere;
}
.model-preview-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.model-preview-error {
  color: var(--agui-c-danger-text);
}
@container (max-width: 640px) {
  .model-preview-with-source {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: repeat(2, minmax(0, 1fr));
  }
  .model-preview-source {
    border-left: 0;
    border-top: 1px solid var(--agui-c-divider);
  }
}
</style>
