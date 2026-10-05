import { defineEditorPlugin } from '@advjs/editor-sdk'
import { contextCommands } from './context'

export const corePlugin = defineEditorPlugin({
  id: 'advjs.core',
  version: '0.1.4',
  apiVersion: 1,
  title: { 'zh-CN': '编辑器核心', 'en': 'Editor core' },
  description: { 'zh-CN': '剧本、人物、项目文件、预览与插件管理。', 'en': 'Story, characters, files, preview and plugin management.' },
  commands: contextCommands,
  actions: [
    { location: { view: 'dashboard', area: 'title' }, command: 'refresh', icon: 'ri:refresh-line' },
    { location: { view: 'dashboard', area: 'title' }, command: 'copy', icon: 'ri:clipboard-line' },
  ],
  views: [
    { id: 'story-line', title: { 'zh-CN': '故事线', 'en': 'Story Line' }, region: 'navigation', order: 0, icon: 'ri:book-open-line', load: () => import('../../components/panel/view/StoryLineView.vue') },
    { id: 'characters', title: { 'zh-CN': '人物', 'en': 'Characters' }, region: 'navigation', order: 10, icon: 'ri:group-line', load: () => import('../../components/panel/view/AEViewCharacters.vue') },
    { id: 'game', title: { 'zh-CN': '游戏', 'en': 'Game' }, region: 'main', order: 0, icon: 'ri:gamepad-line', retention: 'keep-alive', load: () => import('../../components/scene/AdvGamePreview.vue') },
    { id: 'character', title: { 'zh-CN': '人物预览', 'en': 'Character' }, region: 'main', order: 10, icon: 'ri:user-line', load: () => import('../../components/panel/character/AEWindowCharacter.vue') },
    { id: 'audio', title: { 'zh-CN': '音频', 'en': 'Audio' }, region: 'main', order: 20, icon: 'ri:music-line', load: () => import('../../components/panel/audio/AEAudioPanel.vue') },
    { id: 'flow-editor', title: { 'zh-CN': '流程图', 'en': 'Flow Editor' }, region: 'main', order: 30, icon: 'ri:flow-chart', retention: 'keep-alive', load: () => import('../../components/system/flow/AdvFlowEditor.vue') },
    { id: 'dashboard', title: { 'zh-CN': 'AI 工作台', 'en': 'Dashboard' }, region: 'main', order: 40, icon: 'ri:dashboard-line', load: () => import('../../components/panel/view/AIDashboardView.vue') },
    { id: 'project', title: { 'zh-CN': '项目', 'en': 'Project' }, region: 'bottom', order: 0, icon: 'ri:folder-line', retention: 'keep-alive', load: () => import('../../components/panel/view/ProjectFilesView.vue') },
    { id: 'console', title: { 'zh-CN': '控制台', 'en': 'Console' }, region: 'bottom', order: 10, icon: 'ri:terminal-line', load: () => import('../../components/panel/view/AEViewConsole.vue') },
    { id: 'plugins', title: { 'zh-CN': '插件', 'en': 'Plugins' }, region: 'bottom', order: 90, icon: 'ri:puzzle-line', load: () => import('../../components/extensions/EditorPluginManager.vue') },
    { id: 'inspector', title: { 'zh-CN': '属性', 'en': 'Inspector' }, region: 'inspector', order: 0, icon: 'ri:information-line', load: () => import('../../components/panel/view/InspectorContentView.vue') },
  ],
})
