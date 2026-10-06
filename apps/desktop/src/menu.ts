import type { MenuItemConstructorOptions } from 'electron'
import type { DesktopCommand } from './commands.js'

interface NativeMenuOptions {
  platform: string
  locale?: 'en' | 'zh-CN'
  hasProject: boolean
  recent: readonly { id: string, name: string }[]
  command: (action: DesktopCommand) => unknown
  open: () => unknown
  openRecent: (id: string) => unknown
  close: () => unknown
  reload: () => unknown
  openHelp: (url: string) => unknown
}

export function createNativeMenu(options: NativeMenuOptions): MenuItemConstructorOptions[] {
  const zh = options.locale === 'zh-CN'
  const label = (en: string, cn: string) => zh ? cn : en
  const action = (id: DesktopCommand, en: string, cn: string, extra: MenuItemConstructorOptions = {}): MenuItemConstructorOptions => ({
    id: `desktop.${id}`,
    label: label(en, cn),
    click: () => options.command(id),
    ...extra,
  })
  const separator: MenuItemConstructorOptions = { type: 'separator' }
  const help = [
    ['documentation', 'Documentation', '使用文档', 'https://docs.advjs.org'],
    ['issues', 'Report Issues', '反馈问题', 'https://github.com/YunYouJun/advjs/issues'],
    ['releases', 'Release Notes', '更新日志', 'https://github.com/YunYouJun/advjs/releases'],
    ['source', 'Source Code', '源代码', 'https://github.com/YunYouJun/advjs'],
    ['discussions', 'GitHub Discussions', 'GitHub 讨论', 'https://github.com/YunYouJun/advjs/discussions'],
    ['discord', 'Join Discord', '加入 Discord', 'https://discord.gg/HNNPywcTxw'],
  ].map(([id, en, cn, url]) => ({ id: `desktop.help.${id}`, label: label(en!, cn!), click: () => options.openHelp(url!) }))
  return [
    { label: 'ADV.JS Editor', submenu: [
      action('about', 'About ADV.JS Editor', '关于 ADV.JS Editor'),
      separator,
      action('preferences', 'Preferences…', '偏好设置…', { accelerator: 'CmdOrCtrl+,' }),
      ...(options.platform === 'darwin' ? [separator, { role: 'services' as const }, separator, { role: 'hide' as const }, { role: 'hideOthers' as const }, { role: 'unhide' as const }] : []),
      separator,
      { role: 'quit', label: label('Quit ADV.JS Editor', '退出 ADV.JS Editor') },
    ] },
    { label: label('File', '文件'), submenu: [
      { id: 'desktop.open', label: label('Open Project…', '打开项目…'), accelerator: 'CmdOrCtrl+O', click: () => options.open() },
      { id: 'desktop.recent', label: label('Recent Projects', '最近项目'), submenu: options.recent.length
        ? options.recent.map(item => ({ id: `desktop.recent.${item.id}`, label: item.name, click: () => options.openRecent(item.id) }))
        : [{ label: label('No Recent Projects', '没有最近项目'), enabled: false }] },
      separator,
      action('save', 'Save', '保存', { accelerator: 'CmdOrCtrl+S', enabled: options.hasProject }),
      action('project-settings', 'Project Settings…', '项目设置…', { enabled: options.hasProject }),
      { id: 'desktop.close-project', label: label('Close Project', '关闭项目'), enabled: options.hasProject, click: () => options.close() },
      separator,
      action('export-directory', 'Export Web Directory…', '导出 Web 目录…', { enabled: options.hasProject }),
      action('export-zip', 'Export ZIP…', '导出 ZIP…', { enabled: options.hasProject }),
      ...(options.platform === 'darwin' ? [separator, { role: 'close' as const, label: label('Close Window', '关闭窗口') }] : []),
    ] },
    { label: label('Edit', '编辑'), submenu: [
      { role: 'undo', label: label('Undo', '撤销') },
      { role: 'redo', label: label('Redo', '重做') },
      separator,
      { role: 'cut', label: label('Cut', '剪切') },
      { role: 'copy', label: label('Copy', '复制') },
      { role: 'paste', label: label('Paste', '粘贴') },
      { role: 'selectAll', label: label('Select All', '全选') },
    ] },
    { label: label('Story', '故事'), submenu: [
      action('characters', 'Characters', '角色管理'),
      action('codex-workflow', 'Codex Workflow…', 'Codex 创作工作流…'),
    ] },
    { label: label('View', '视图'), submenu: [
      action('workspace', 'Editor Workspace', '编辑工作区'),
      action('extensions', 'Editor Extensions', '编辑器扩展'),
      separator,
      action('preview', 'Game Preview', '游戏预览', { enabled: options.hasProject }),
      action('stop-preview', 'Stop Preview', '停止预览', { enabled: options.hasProject }),
      separator,
      { id: 'desktop.reload', label: label('Reload Window', '重载窗口'), accelerator: 'CmdOrCtrl+R', click: () => options.reload() },
      { role: 'toggleDevTools', label: label('Developer Tools', '开发者工具') },
      { role: 'togglefullscreen', label: label('Toggle Fullscreen', '切换全屏') },
    ] },
    { role: 'windowMenu', label: label('Window', '窗口'), submenu: [
      { role: 'minimize', label: label('Minimize', '最小化') },
      { role: 'zoom', label: label('Zoom', '缩放') },
      separator,
      action('reset-layout', 'Reset Layout', '重置布局'),
      ...(options.platform === 'darwin' ? [separator, { role: 'front' as const, label: label('Bring All to Front', '前置全部窗口') }] : []),
    ] },
    { role: 'help', label: label('Help', '帮助'), submenu: help },
  ]
}
