<script setup lang="ts">
import type { PreviewMode, PreviewRunMode } from '../../../../../apps/desktop/src/preview-presentation'
import AGUIButton from '@advjs/gui/components/button/AGUIButton.vue'
import AGUISelect from '@advjs/gui/components/select/AGUISelect.vue'
import AGUISwitch from '@advjs/gui/components/switch/AGUISwitch.vue'
import AGUIToolbar from '@advjs/gui/components/toolbar/AGUIToolbar.vue'
import { useResizeObserver } from '@vueuse/core'

const props = defineProps<{ visible: boolean }>()
const { locale } = useI18n()
const zh = computed(() => locale.value === 'zh-CN')
const preview = useDesktopPreview()
const desktop = useDesktopStore()
const surface = useTemplateRef<HTMLElement>('surface')
const themeSourceOpen = ref(false)
const building = computed(() => ['preview', 'live'].includes(desktop.status.task?.kind ?? '') && desktop.status.task?.state === 'running')
const live = computed(() => preview.runMode.value === 'live')
const runModes = computed(() => [
  { value: 'live', label: zh.value ? '实时预览' : 'Live preview' },
  { value: 'build', label: zh.value ? '构建预览' : 'Build preview' },
])
const modes = computed(() => [
  { value: 'embedded', label: zh.value ? '编辑器内' : 'In editor' },
  { value: 'window', label: zh.value ? '独立窗口' : 'Separate window' },
])
const console = useConsoleStore()
async function run(action: () => Promise<unknown>) {
  try {
    await action()
  }
  catch (error) { console.error(zh.value ? '游戏预览失败' : 'Game preview failed', { error }) }
}
let frame = 0
let observer: MutationObserver | undefined
let lastBounds = ''
function updateBounds() {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(() => {
    const element = surface.value
    const blocked = document.querySelector('[role="dialog"], [role="menu"][data-state="open"], [role="listbox"][data-state="open"], .ToastRoot[data-state="open"]')
    const rect = element?.getBoundingClientRect()
    const bounds = props.visible && !blocked && rect && element?.checkVisibility() && rect.width > 0 && rect.height > 0
      ? { x: Math.max(0, rect.x), y: Math.max(0, rect.y), width: rect.width, height: rect.height }
      : undefined
    const identity = JSON.stringify(bounds) ?? ''
    if (lastBounds === identity)
      return
    lastBounds = identity
    void window.advDesktop?.setPreviewBounds(bounds).catch(error => console.warn('Preview panel unavailable', { error }))
  })
}
useResizeObserver(surface, updateBounds)
watch(() => [props.visible, preview.mode.value, preview.active.value], updateBounds, { flush: 'post' })
onMounted(() => {
  observer = new MutationObserver(updateBounds)
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-state', 'style', 'class'] })
  window.addEventListener('resize', updateBounds)
  updateBounds()
})
onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('resize', updateBounds)
  cancelAnimationFrame(frame)
  void window.advDesktop?.setPreviewBounds().catch(() => {})
})
</script>

<template>
  <section class="desktop-game-preview" :aria-label="zh ? '游戏预览' : 'Game preview'">
    <AGUIToolbar :items="[]" :label="zh ? '预览操作' : 'Preview controls'">
      <template #before-toolbar>
        <div class="preview-run-mode">
          <AGUISelect :model-value="preview.runMode.value" :options="runModes" :disabled="preview.busy.value || building" :label="zh ? '运行方式' : 'Preview type'" @update:model-value="run(() => preview.selectRunMode($event as PreviewRunMode))" />
        </div>
        <AGUIButton :loading="preview.busy.value || building" @click="run(() => preview.start())">
          {{ preview.active.value ? (live ? (zh ? '重新运行' : 'Restart') : (zh ? '重新构建' : 'Rebuild')) : (zh ? '启动预览' : 'Start preview') }}
        </AGUIButton>
        <AGUIButton :disabled="!preview.active.value && !building" @click="run(preview.stop)">
          {{ zh ? '停止' : 'Stop' }}
        </AGUIButton>
        <div class="preview-mode">
          <AGUISelect :model-value="preview.mode.value" :options="modes" :label="zh ? '预览位置' : 'Preview location'" @update:model-value="run(() => preview.present($event as PreviewMode))" />
        </div>
        <AGUIButton icon="i-ri-code-s-slash-line" :title="zh ? '编辑首页与主题代码' : 'Edit start-page and theme code'" @click="themeSourceOpen = true">
          {{ zh ? '主题' : 'Theme' }}
        </AGUIButton>
        <AGUISwitch
          :model-value="preview.vueDevtools.value" label="Vue DevTools"
          :disabled="!live || preview.busy.value || building"
          :title="live ? (zh ? '切换会重新运行实时预览' : 'Toggling restarts live preview') : (zh ? '仅实时预览可用' : 'Available in live preview')"
          @update:model-value="run(() => preview.setVueDevtools($event))"
        />
      </template>
    </AGUIToolbar>
    <div ref="surface" class="desktop-preview-surface">
      <div class="desktop-preview-placeholder">
        <span class="i-ri-gamepad-line" aria-hidden="true" />
        <p v-if="building">
          {{ live ? (zh ? '正在启动实时预览…' : 'Starting live preview…') : (zh ? '正在构建已保存的项目…' : 'Building the saved project…') }}
        </p>
        <template v-else-if="preview.active.value && preview.mode.value === 'window'">
          <p>{{ zh ? '游戏正在独立窗口中运行' : 'The game is running in a separate window' }}</p>
          <AGUIButton @click="run(() => preview.present('embedded'))">
            {{ zh ? '移回编辑器' : 'Move into editor' }}
          </AGUIButton>
        </template>
        <p v-else-if="!preview.active.value">
          {{ zh ? '实时预览会在保存后自动更新，可切换到独立窗口。构建预览用于检查导出效果。' : 'Live preview updates after saving and can move to a separate window. Build preview checks the exported game.' }}
        </p>
      </div>
    </div>
    <AEThemeSourceDialog v-model:open="themeSourceOpen" />
  </section>
</template>

<style scoped>
.desktop-game-preview {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.preview-run-mode,
.preview-mode {
  width: 124px;
  max-width: 100%;
}
.desktop-preview-surface {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.desktop-preview-placeholder {
  max-width: 300px;
  margin: auto;
  padding: 16px;
  color: var(--agui-c-text-2);
  font-size: 12px;
  line-height: 1.6;
  text-align: center;
}
.desktop-preview-surface {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
