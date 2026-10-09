import type { EditorCommand } from '@advjs/editor-sdk'
import { useContentCreationStore } from '../../stores/useContentCreationStore'
import { useMonacoStore } from '../../stores/useMonacoStore'

export const storyCommands: readonly EditorCommand[] = [
  ...(['world', 'scene', 'chapter'] as const).map(kind => ({
    id: `create-${kind}`,
    title: kind === 'world' ? { 'zh-CN': '创建世界观', 'en': 'Create world' } : kind === 'scene' ? { 'zh-CN': '创建场景', 'en': 'Create scene' } : { 'zh-CN': '创建章节', 'en': 'Create chapter' },
    enabled: () => useContentCreationStore().available && !useContentCreationStore().draft && !useContentCreationStore().busy,
    run: (ctx: Parameters<EditorCommand['run']>[0]) => useContentCreationStore().begin(kind, ctx.locale.value),
  })),
  {
    id: 'insert-dialogue',
    title: { 'zh-CN': '插入对白', 'en': 'Insert dialogue' },
    enabled: () => useMonacoStore().canInsertStory,
    run: ctx => useMonacoStore().insertStory('dialogue', ctx.locale.value),
  },
  {
    id: 'insert-choice',
    title: { 'zh-CN': '插入选项', 'en': 'Insert choices' },
    enabled: () => useMonacoStore().canInsertStory,
    run: ctx => useMonacoStore().insertStory('choice', ctx.locale.value),
  },
]
