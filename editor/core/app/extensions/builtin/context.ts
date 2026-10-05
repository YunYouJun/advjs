import type { EditorProjectSnapshot } from '@advjs/editor-sdk'
import { defineEditorPlugin, editorText } from '@advjs/editor-sdk'

const documents = [
  { id: 'world', path: 'world.md', title: { 'zh-CN': '世界观', 'en': 'World' } },
  { id: 'outline', path: 'outline.md', title: { 'zh-CN': '大纲', 'en': 'Outline' } },
  { id: 'chapters', path: 'chapters/README.md', title: { 'zh-CN': '章节', 'en': 'Chapters' } },
  { id: 'characters', path: 'characters/README.md', title: { 'zh-CN': '人物', 'en': 'Characters' } },
  { id: 'scenes', path: 'scenes/README.md', title: { 'zh-CN': '场景', 'en': 'Scenes' } },
  { id: 'glossary', path: 'glossary.md', title: { 'zh-CN': '术语表', 'en': 'Glossary' } },
]

export function contextSections(project: EditorProjectSnapshot | null) {
  const files = project?.files ?? {}
  const prefix = Object.keys(files).some(path => path.startsWith('adv/')) ? 'adv/' : ''
  return documents.map(document => ({ ...document, content: files[`${prefix}${document.path}`] ?? '' })).filter(document => document.content.trim())
}

export function contextStats(project: EditorProjectSnapshot | null) {
  const files = Object.keys(project?.files ?? {})
  const prefix = files.some(path => path.startsWith('adv/')) ? 'adv/' : ''
  function count(directory: string, extension: string) {
    const folder = `${prefix}${directory}/`
    return files.filter(path => path.startsWith(folder) && !path.slice(folder.length).includes('/') && path.endsWith(extension) && !path.endsWith('/README.md')).length
  }
  return { chapters: count('chapters', '.adv.md'), characters: count('characters', '.character.md'), scenes: count('scenes', '.md') }
}

export function mergedContext(project: EditorProjectSnapshot | null) {
  return contextSections(project).map(section => `# ${section.title.en}\n\n${section.content}`).join('\n\n---\n\n')
}

export const contextPlugin = defineEditorPlugin({
  id: 'advjs.context',
  version: '0.1.4',
  apiVersion: 1,
  title: { 'zh-CN': '创作上下文', 'en': 'Project context' },
  description: { 'zh-CN': '阅读世界观与创作资料，复制给 AI。', 'en': 'Read authoring material and copy it for AI.' },
  requires: ['project.read', 'project.refresh', 'clipboard.write'],
  views: [{ id: 'context', title: { 'zh-CN': '创作上下文', 'en': 'Project context' }, region: 'inspector', icon: 'ri:earth-line', order: 20, load: () => import('../../components/panel/view/ProjectContextView.vue') }],
  commands: [
    { id: 'refresh', title: { 'zh-CN': '刷新', 'en': 'Refresh' }, enabled: ctx => ctx.project.current.value !== null, run: ctx => ctx.project.refresh() },
    {
      id: 'copy',
      title: { 'zh-CN': '复制给 AI', 'en': 'Copy for AI' },
      enabled: ctx => contextSections(ctx.project.current.value).length > 0,
      async run(ctx) {
        const session = ctx.project.current.value?.sessionId
        await ctx.clipboard.writeText(mergedContext(ctx.project.current.value))
        if (ctx.project.current.value?.sessionId === session)
          ctx.notifications.info(editorText({ 'zh-CN': '创作资料已复制', 'en': 'Context copied' }, ctx.locale.value))
      },
    },
  ],
  actions: [
    { location: { view: 'context', area: 'title' }, command: 'refresh', icon: 'ri:refresh-line' },
    { location: { view: 'context', area: 'title' }, command: 'copy', icon: 'ri:clipboard-line' },
  ],
})
