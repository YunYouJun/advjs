<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { computed, nextTick, shallowRef, useTemplateRef, watch } from 'vue'
import { useProjectAssetActions } from '../../composables/useProjectAssetActions'
import { useProjectFileActions } from '../../composables/useProjectFileActions'
import { useAssetBrowserStore } from '../../stores/useAssetBrowserStore'
import ProjectAssetList from './ProjectAssetList.vue'
import ProjectAssetSources from './ProjectAssetSources.vue'
import ProjectAssetToolbar from './ProjectAssetToolbar.vue'

const props = withDefaults(defineProps<{ visible?: boolean }>(), { visible: true })
const browser = useAssetBrowserStore()
const project = useProjectStore()
const { select, showInProject } = useProjectAssetActions()
const { open } = useProjectFileActions()
const { locale } = useEditorLocale()
const zh = computed(() => locale.value === 'zh-CN')
const root = useTemplateRef<HTMLElement>('root')
const content = useTemplateRef<HTMLElement>('content')
const { width } = useElementSize(root)
const narrowExpanded = shallowRef(false)
const sidebarVisible = computed(() => browser.preferences.sidebarVisible && (width.value >= 520 || narrowExpanded.value))
const maximumWidth = computed(() => Math.max(140, Math.min(360, width.value - 120)))
const sidebarWidth = computed(() => Math.min(browser.preferences.sidebarWidth, maximumWidth.value))
const drag = shallowRef<{ pointerId: number, x: number, width: number }>()
watch(width, (value) => {
  if (value >= 520)
    narrowExpanded.value = false
})
watch(() => browser.assetRevealVersion, async (version) => {
  if (!version)
    return
  await nextTick()
  const selected = content.value?.querySelector<HTMLElement>('button[aria-pressed="true"]')
  selected?.scrollIntoView({ block: 'nearest' })
  selected?.focus()
}, { immediate: true })
function toggleSidebar() {
  const next = !sidebarVisible.value
  browser.preferences.sidebarVisible = next
  narrowExpanded.value = width.value < 520 && next
}
function setWidth(value: number) {
  browser.preferences.sidebarWidth = Math.round(Math.min(maximumWidth.value, Math.max(140, value)))
}
function startResize(event: PointerEvent) {
  if (event.button !== 0)
    return
  event.preventDefault()
  const target = event.currentTarget as HTMLElement
  target.focus()
  target.setPointerCapture(event.pointerId)
  drag.value = { pointerId: event.pointerId, x: event.clientX, width: sidebarWidth.value }
}
function resize(event: PointerEvent) {
  if (drag.value?.pointerId === event.pointerId)
    setWidth(drag.value.width + event.clientX - drag.value.x)
}
function stopResize() {
  drag.value = undefined
}
function resizeByKey(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft')
    setWidth(sidebarWidth.value - 10)
  else if (event.key === 'ArrowRight')
    setWidth(sidebarWidth.value + 10)
  else if (event.key === 'Home')
    setWidth(140)
  else if (event.key === 'End')
    setWidth(maximumWidth.value)
  else
    return
  event.preventDefault()
}
const emptyMessage = computed(() => !project.project
  ? (zh.value ? '打开项目以浏览素材。' : 'Open a project to browse its assets.')
  : !browser.paths.length
      ? (zh.value ? '项目中尚无图片、音频、视频或模型。' : 'This project has no images, audio, video or models yet.')
      : (zh.value ? '没有匹配的素材，可更换目录或调整筛选条件。' : 'No matching assets. Choose another folder or adjust the filters.'))
</script>

<template>
  <section ref="root" class="project-assets">
    <ProjectAssetToolbar
      v-model:query="browser.query" v-model:type="browser.type"
      v-model:mode="browser.preferences.mode" v-model:scope="browser.preferences.scope"
      :folder="browser.preferences.folder" :sidebar-visible="sidebarVisible" :selected-path="browser.selectedPath" :zh="zh"
      :count="browser.filtered.length" :compact="width < 640" :narrow="width < 520"
      @browse="browser.browse" @toggle-sidebar="toggleSidebar" @locate="showInProject(browser.selectedPath)"
    />
    <div class="asset-body" :class="{ resizing: drag }" :style="{ gridTemplateColumns: sidebarVisible ? `${sidebarWidth}px var(--agui-layout-splitter-size) minmax(0, 1fr)` : 'minmax(0, 1fr)' }">
      <aside v-if="sidebarVisible" class="asset-sources" :aria-label="zh ? '素材目录' : 'Asset folders'">
        <ProjectAssetSources :paths="browser.paths" :folder="browser.preferences.folder" :label="zh ? '素材目录' : 'Asset folders'" :all-label="zh ? '全部素材' : 'All assets'" @browse="browser.browse" />
      </aside>
      <div
        v-if="sidebarVisible" role="separator" tabindex="0" class="asset-divider" aria-orientation="vertical"
        :aria-label="zh ? '调整素材目录宽度' : 'Resize asset folders'" :aria-valuenow="sidebarWidth" :aria-valuemin="140" :aria-valuemax="maximumWidth"
        @pointerdown="startResize" @pointermove="resize" @pointerup="stopResize" @pointercancel="stopResize" @lostpointercapture="stopResize" @keydown="resizeByKey"
      />
      <div ref="content" class="asset-content">
        <ProjectAssetList
          v-if="browser.filtered.length" :paths="browser.filtered" :selected="browser.selectedPath" :visible="props.visible"
          :mode="browser.preferences.mode" :show-path="browser.preferences.scope === 'all'" :label="zh ? '项目素材' : 'Project assets'"
          :preview-hint="zh ? '双击或按 Enter 预览' : 'Double-click or press Enter to preview'"
          @select="select" @open="open"
        />
        <p v-else class="asset-empty" role="status">
          {{ emptyMessage }}
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.project-assets {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  min-width: 0;
  color: var(--agui-c-text-1);
}
.asset-body {
  display: grid;
  flex: 1;
  min-height: 0;
  min-width: 0;
}
.asset-sources,
.asset-content {
  min-width: 0;
  overflow: auto;
}
.asset-sources {
  padding: 4px 0;
}
.asset-content {
  container: asset-content / size;
}
.asset-divider {
  position: relative;
  cursor: col-resize;
  touch-action: none;
  background: var(--agui-layout-splitter-color);
}
.asset-divider::before {
  position: absolute;
  content: '';
  inset: 0 -12px;
}
.asset-divider:focus-visible {
  outline: 2px solid var(--agui-c-focus);
  outline-offset: 0;
  z-index: 1;
}
.resizing {
  user-select: none;
  cursor: col-resize;
}
.asset-empty {
  padding: 12px;
  font-size: 12px;
  color: var(--agui-c-text-2);
  line-height: 1.6;
}
</style>
