<script setup lang="ts">
import { projectFolderError, projectNameError } from '../../utils/project-creation'

const { draft, busy, error, cancel, browse, create } = useDesktopProjectCreation()
const { locale } = useI18n()
const zh = computed(() => locale.value === 'zh-CN')
const ids = useId()
const open = computed({ get: () => !!draft.value, set: value => !value && cancel() })
const folderError = computed(() => {
  const issue = projectFolderError(draft.value?.folderName ?? '')
  if (!issue)
    return ''
  return zh.value
    ? ({ empty: '请输入文件夹名称。', invalid: '名称不能包含路径分隔符、特殊字符，或以空格、句点结尾。', reserved: '此名称由系统保留，请换一个名称。', long: '文件夹名称不能超过 80 个字符。' })[issue]
    : ({ empty: 'Enter a folder name.', invalid: 'Avoid path separators, special characters and trailing spaces or periods.', reserved: 'This name is reserved by the system.', long: 'Use at most 80 characters.' })[issue]
})
const nameError = computed(() => {
  const issue = projectNameError(draft.value?.name ?? '')
  if (!issue)
    return ''
  return zh.value
    ? ({ empty: '请输入游戏名称。', invalid: '游戏名称不能包含换行或控制字符。', long: '游戏名称不能超过 120 个字符。' })[issue]
    : ({ empty: 'Enter a game name.', invalid: 'Avoid line breaks or control characters.', long: 'Use at most 120 characters.' })[issue]
})
const destination = computed(() => {
  const input = draft.value
  if (!input)
    return ''
  return `${input.directory.replace(/[/\\]$/u, '')}${input.directory.includes('\\') ? '\\' : '/'}${input.folderName}`
})
function submit() {
  if (!nameError.value && !folderError.value)
    void create()
}
</script>

<template>
  <AGUIDialog v-model:open="open" :title="zh ? '创建项目' : 'Create project'" :description="zh ? '确认名称与保存位置后进入编辑器。' : 'Choose a name and storage location before opening the editor.'" content-class="project-create-dialog">
    <form v-if="draft" class="project-create-form" @submit.prevent="submit">
      <p class="project-create-template">
        {{ zh ? '模板' : 'Template' }}：{{ zh ? draft.template.name : draft.template.nameEn ?? draft.template.name }}
      </p>
      <div class="project-create-field">
        <label :for="`${ids}-name`">{{ zh ? '游戏名称' : 'Game name' }}</label>
        <AGUIInput :id="`${ids}-name`" v-model="draft.name" autofocus :disabled="busy" :aria-invalid="!!nameError" :aria-describedby="`${ids}-name-help`" maxlength="120" />
        <p :id="`${ids}-name-help`" :class="{ 'field-error': nameError }">
          {{ nameError || (zh ? '支持中文，显示在游戏中；之后可以修改。' : 'Chinese and other languages are supported. This name is shown in the game and can be changed later.') }}
        </p>
      </div>
      <div class="project-create-field">
        <label :for="`${ids}-folder`">{{ zh ? '文件夹名称' : 'Folder name' }}</label>
        <AGUIInput :id="`${ids}-folder`" v-model="draft.folderName" :disabled="busy" :aria-invalid="!!folderError" :aria-describedby="`${ids}-folder-help`" maxlength="80" spellcheck="false" />
        <p :id="`${ids}-folder-help`" :class="{ 'field-error': folderError }">
          {{ folderError || (zh ? '推荐小写英文、数字和连字符，例如 rainy-letter；也支持中文。' : 'Lowercase letters, numbers and hyphens are recommended, e.g. rainy-letter. Chinese is also supported.') }}
        </p>
      </div>
      <div class="project-create-field">
        <label :for="`${ids}-location`">{{ zh ? '存储位置' : 'Storage location' }}</label>
        <div class="project-create-location">
          <AGUIInput :id="`${ids}-location`" :model-value="draft.directory" readonly :disabled="busy" :title="draft.directory" />
          <AGUIButton type="button" icon="i-ri-folder-open-line" :disabled="busy" @click="browse">
            {{ zh ? '更换…' : 'Browse…' }}
          </AGUIButton>
        </div>
      </div>
      <div class="project-create-destination">
        <span>{{ zh ? '项目路径' : 'Project path' }}</span>
        <output>{{ destination }}</output>
        <p>{{ zh ? '创建新的项目文件夹，并记住此存储位置。' : 'Create a new project folder and remember this storage location.' }}</p>
      </div>
      <p v-if="error" role="alert" class="field-error">
        {{ error }}
      </p>
      <footer class="project-create-actions">
        <AGUIButton type="button" :disabled="busy" @click="cancel">
          {{ zh ? '取消' : 'Cancel' }}
        </AGUIButton>
        <AGUIButton type="submit" theme="primary" :loading="busy" :disabled="busy || !!nameError || !!folderError">
          {{ zh ? '创建并打开' : 'Create and open' }}
        </AGUIButton>
      </footer>
    </form>
  </AGUIDialog>
</template>

<style>
.project-create-dialog {
  width: 480px;
}
</style>

<style scoped>
.project-create-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
}
.project-create-template {
  margin: 0;
  color: var(--agui-c-text-2);
  font-size: 12px;
}
.project-create-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.project-create-field p,
.project-create-destination p {
  margin: 0;
  color: var(--agui-c-text-2);
  font-size: 12px;
  line-height: 1.5;
}
.project-create-location {
  display: flex;
  gap: 8px;
}
.project-create-location input {
  flex: 1;
  min-width: 0;
}
.project-create-destination {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 8px;
  border-top: 1px solid var(--agui-c-divider-light);
}
.project-create-destination output {
  font-family: monospace;
  font-size: 12px;
  overflow-wrap: anywhere;
}
.project-create-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}
.project-create-form .field-error {
  margin: 0;
  color: var(--agui-c-danger-text);
  font-size: 12px;
}
</style>
