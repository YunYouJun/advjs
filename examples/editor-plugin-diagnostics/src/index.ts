import { defineEditorPlugin } from '@advjs/editor-sdk'

export default defineEditorPlugin({
  id: 'advjs.diagnostics',
  version: '0.1.4',
  apiVersion: 1,
  title: { 'zh-CN': '项目诊断', 'en': 'Project diagnostics' },
  description: { 'zh-CN': '检查剧本编译结果、文件位置与错误提示。', 'en': 'Inspect compilation errors, warnings and source locations.' },
  requires: ['project.read', 'project.refresh'],
  views: [{ id: 'diagnostics', region: 'bottom', title: { 'zh-CN': '诊断', 'en': 'Diagnostics' }, order: 20, icon: 'ri:error-warning-line', load: () => import('./DiagnosticsView.vue') }],
  commands: [{ id: 'refresh', title: { 'zh-CN': '重新检查', 'en': 'Check again' }, enabled: ctx => ctx.project.current.value !== null, run: ctx => ctx.project.refresh() }],
  actions: [
    { location: { view: 'diagnostics', area: 'title' }, command: 'refresh', icon: 'ri:refresh-line' },
    { location: 'editor.toolbar', command: 'refresh', icon: 'ri:refresh-line' },
  ],
})
