<script setup lang="ts">
import type { ThemeSourceId } from '../../utils/theme-authoring'
import { useThemeAuthoring } from '../../composables/useThemeAuthoring'

const open = defineModel<boolean>('open', { default: false })
const { locale } = useEditorLocale()
const zh = computed(() => locale.value === 'zh-CN')
const authoring = useThemeAuthoring()
const options = computed(() => authoring.bundle.value.sources.map(source => ({ value: source.id, label: source.id === 'start' ? (zh.value ? '首页布局' : 'Start-page layout') : source.id === 'menu' ? (zh.value ? '菜单按钮' : 'Menu buttons') : (zh.value ? '主题配置' : 'Theme configuration') })))
async function edit() {
  if (await authoring.edit())
    open.value = false
}
watch(open, () => authoring.error.value = '')
</script>

<template>
  <AGUIDialog v-model:open="open" :title="zh ? '编辑游戏主题' : 'Edit game theme'" content-class="w-120 h-auto">
    <div class="theme-source-dialog">
      <p>{{ zh ? '项目中的覆盖文件会同时用于实时预览和导出游戏。' : 'Project overrides apply to live preview and exported games.' }}</p>
      <AGUISelect :model-value="authoring.selected.value" :options="options" :label="zh ? '主题文件' : 'Theme file'" :disabled="authoring.busy.value" @update:model-value="authoring.selected.value = $event as ThemeSourceId" />
      <code class="theme-source-path">{{ authoring.source.value.path }}</code>
      <p>{{ authoring.source.value.exists ? (zh ? '当前项目已有此文件，直接打开编辑。' : 'This file is already in the project. Open it to edit.') : authoring.source.value.content === undefined ? (zh ? '当前主题没有内置源码，可编辑主题配置或添加自己的覆盖文件。' : 'This theme has no bundled source. Edit its configuration or add your own override.') : (zh ? '创建项目覆盖后编辑，保留安装包中的原始主题。' : 'Create a project override to edit this bundled theme.') }}</p>
      <AGUIButton :loading="authoring.busy.value" :disabled="authoring.source.value.content === undefined" @click="edit">
        {{ authoring.source.value.exists ? (zh ? '编辑代码' : 'Edit code') : (zh ? '创建覆盖并编辑' : 'Create override and edit') }}
      </AGUIButton>
      <div class="theme-ai-context">
        <label for="theme-edit-request">{{ zh ? '给 AI 的修改需求' : 'Changes to request from AI' }}</label>
        <AGUITextarea id="theme-edit-request" v-model="authoring.request.value" :rows="3" :placeholder="zh ? '例如：把菜单移到左侧，使用暖金色，并保留窄屏布局。' : 'For example: move the menu left, use warm gold, and preserve narrow layouts.'" />
        <AGUIButton @click="authoring.copyForAi">
          {{ authoring.copied.value ? (zh ? '已复制' : 'Copied') : (zh ? '复制主题上下文给 AI' : 'Copy theme context for AI') }}
        </AGUIButton>
        <p>{{ zh ? '复制后粘贴给 Codex 或其他 AI，审阅生成的代码再保存。此操作不发送到 AI 服务。' : 'Paste into Codex or another AI, review its code, then save. Copying does not contact an AI service.' }}</p>
      </div>
      <p v-if="authoring.error.value" class="theme-source-error" role="alert">
        {{ authoring.error.value }}
      </p>
    </div>
  </AGUIDialog>
</template>

<style scoped>
.theme-source-dialog {
  padding: 12px;
  font-size: 13px;
  line-height: 1.6;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}
p {
  margin: 0;
  color: var(--agui-c-text-2);
}
.theme-source-path {
  overflow-wrap: anywhere;
  font-size: 12px;
}
.theme-source-dialog :deep(.agui-button) {
  align-self: flex-start;
}
.theme-ai-context {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: 1px solid var(--agui-c-divider);
  padding-top: 12px;
  margin-top: 4px;
}
.theme-source-error {
  color: var(--agui-c-danger-text);
}
</style>
