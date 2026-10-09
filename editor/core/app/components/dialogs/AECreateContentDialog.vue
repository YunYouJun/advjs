<script setup lang="ts">
import { useEditorLayoutState } from '../../extensions/layout-state'
import { useContentCreationStore } from '../../stores/useContentCreationStore'
import { contentCreationPlan } from '../../utils/content-creation'

const creation = useContentCreationStore()
const project = useProjectStore()
const layout = useEditorLayoutState()
const router = useRouter()
const { locale } = useEditorLocale()
const zh = computed(() => locale.value === 'zh-CN')
const ids = useId()
const open = computed({ get: () => !!creation.draft, set: value => !value && creation.cancel() })
const title = computed(() => creation.draft?.kind === 'world' ? (zh.value ? '创建世界观' : 'Create world') : creation.draft?.kind === 'scene' ? (zh.value ? '创建场景' : 'Create scene') : (zh.value ? '创建章节' : 'Create chapter'))
const plan = computed(() => {
  if (!creation.draft || !project.project)
    return { path: '', error: '', exists: false }
  if (creation.draft.createdPath)
    return { path: creation.draft.createdPath, error: '', exists: true }
  try {
    const result = contentCreationPlan(project.project, { ...creation.draft, locale: locale.value })
    return { path: result.path, error: '', exists: result.changes.length === 0 }
  }
  catch (cause) {
    return { path: '', error: cause instanceof Error ? cause.message : String(cause), exists: false }
  }
})
async function submit() {
  if (plan.value.error)
    return
  if (await creation.create(locale.value)) {
    layout.select('main', 'advjs.core/file')
    creation.cancel()
    if (router.currentRoute.value.path !== '/')
      await router.push('/')
  }
}
</script>

<template>
  <AGUIDialog v-model:open="open" :title="title" :description="zh ? '在当前项目中创建创作内容，再打开源码编辑。' : 'Create authoring content in the current project, then open its source.'" content-class="w-110 h-auto">
    <form v-if="creation.draft" class="content-create-form" @submit.prevent="submit">
      <div class="content-create-field">
        <label :for="`${ids}-name`">{{ zh ? '名称' : 'Name' }}</label>
        <AGUIInput :id="`${ids}-name`" v-model="creation.draft.title" autofocus :disabled="creation.busy || plan.exists" :aria-describedby="plan.error ? `${ids}-error` : undefined" maxlength="120" />
      </div>
      <div v-if="creation.draft.kind !== 'world'" class="content-create-field">
        <label :for="`${ids}-id`">{{ zh ? '标识符' : 'ID' }}</label>
        <AGUIInput :id="`${ids}-id`" v-model="creation.draft.id" :disabled="creation.busy || !!creation.draft.createdPath" :aria-describedby="`${ids}-id-help${plan.error ? ` ${ids}-error` : ''}`" maxlength="80" spellcheck="false" />
        <p :id="`${ids}-id-help`">
          {{ zh ? '使用字母、数字、连字符或下划线，例如 chapter-02；标识符用于文件名和剧情引用。' : 'Use letters, numbers, hyphens or underscores, e.g. chapter-02. The ID is used for the filename and story references.' }}
        </p>
      </div>
      <div v-if="plan.path" class="content-create-path">
        <span>{{ zh ? '项目文件' : 'Project file' }}</span>
        <output>{{ plan.path }}</output>
        <p>{{ plan.exists ? (zh ? '文件已存在，打开编辑时保留原有内容。' : 'The file exists. Open it with its current content.') : (zh ? '创建后已保存到项目；后续源码修改需要点击保存。' : 'The new file is saved to the project. Save subsequent source edits when ready.') }}</p>
      </div>
      <p v-if="plan.error || creation.error" :id="`${ids}-error`" class="content-create-error" role="alert">
        {{ plan.error || creation.error }}
      </p>
      <footer class="content-create-actions">
        <AGUIButton type="button" :disabled="creation.busy" @click="creation.cancel">
          {{ zh ? '取消' : 'Cancel' }}
        </AGUIButton>
        <AGUIButton type="submit" theme="primary" :loading="creation.busy" :disabled="creation.busy || !creation.available || !!plan.error">
          {{ plan.exists ? (zh ? '打开编辑' : 'Open to edit') : (zh ? '创建并编辑' : 'Create and edit') }}
        </AGUIButton>
      </footer>
    </form>
  </AGUIDialog>
</template>

<style scoped>
.content-create-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  font-size: 13px;
}
.content-create-field,
.content-create-path {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.content-create-form p {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--agui-c-text-2);
}
.content-create-path {
  border-top: 1px solid var(--agui-c-divider-light);
  padding-top: 8px;
}
.content-create-path output {
  overflow-wrap: anywhere;
  font-family: monospace;
  font-size: 12px;
}
.content-create-form .content-create-error {
  color: var(--agui-c-danger-text);
  overflow-wrap: anywhere;
}
.content-create-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
