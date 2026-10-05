import { editorText, useEditorPluginContext } from '@advjs/editor-sdk'
import { computed } from 'vue'
import { contextSections, contextStats } from '../extensions/builtin/context'

const messages = {
  title: { 'zh-CN': '创作上下文', 'en': 'Project context' },
  savedContext: { 'zh-CN': '已保存的创作资料', 'en': 'Saved authoring material' },
  chapters: { 'zh-CN': '章节', 'en': 'Chapters' },
  characters: { 'zh-CN': '人物', 'en': 'Characters' },
  scenes: { 'zh-CN': '场景', 'en': 'Scenes' },
  openProject: { 'zh-CN': '打开项目以查看创作资料', 'en': 'Open a project to view its context' },
  empty: { 'zh-CN': '尚未添加创作资料', 'en': 'No authoring context yet' },
  emptyHint: { 'zh-CN': '在 adv/ 中添加 world.md、outline.md、glossary.md 或各目录的 README 文件。', 'en': 'Add world.md, outline.md, glossary.md or README files under adv/.' },
}

/** Pure reading view; actions and operation state belong to the command host. */
export function useProjectContextPanel() {
  const ctx = useEditorPluginContext()
  const project = ctx.project.current
  function t(key: string) {
    return editorText(messages[key.replace('context.', '') as keyof typeof messages], ctx.locale.value, key)
  }
  const sections = computed(() => contextSections(project.value).map(section => ({
    value: section.id,
    title: editorText(section.title, ctx.locale.value),
    content: section.content,
  })))
  const stats = computed(() => (['chapters', 'characters', 'scenes'] as const).map(key => ({
    label: t(`context.${key}`),
    count: contextStats(project.value)[key],
  })))
  return {
    t,
    sections,
    stats,
    hasProject: computed(() => project.value !== null),
    hasContext: computed(() => sections.value.length > 0),
    projectName: computed(() => project.value?.name ?? ''),
  }
}
