import defaultMenu from '../../../../themes/theme-default/components/start/StartMenu.vue?raw'
import defaultStart from '../../../../themes/theme-default/pages/start.vue?raw'
import pominisMenu from '../../../../themes/theme-pominis/components/start/PominisStartMenu.vue?raw'
import pominisStart from '../../../../themes/theme-pominis/pages/start.vue?raw'

export type ThemeSourceId = 'start' | 'menu' | 'config'
export interface ThemeSource { id: ThemeSourceId, path: string, content?: string, exists: boolean }
export interface ThemeSources { theme: string, sources: ThemeSource[] }

const configTemplate = `${JSON.stringify({ ui: { tokens: { '--adv-theme-start-title-gap': '36px', '--adv-theme-start-title-size': '30px', '--adv-theme-start-menu-size': '18px' } } }, null, 2)}\n`

/** Only project overrides and bundled official sources; never installed package writes. */
export function resolveThemeSources(files: Record<string, string>, theme = 'default'): ThemeSources {
  const name = theme.replace(/^@advjs\/theme-/u, '')
  const defaults = name === 'default' || name === 'none' || !name
  const pominis = name === 'pominis'
  const menuName = pominis ? 'PominisStartMenu.vue' : 'StartMenu.vue'
  const menuPath = Object.keys(files).find(path => path.startsWith('components/') && path.endsWith(`/${menuName}`)) ?? `components/start/${menuName}`
  const configPath = Object.keys(files).find(path => /^theme\.config\.(?:json|ts|mts|cts|js|mjs|cjs)$/u.test(path)) ?? 'theme.config.json'
  const fallback: Record<ThemeSourceId, string | undefined> = {
    start: defaults ? defaultStart : pominis ? pominisStart : undefined,
    menu: defaults ? defaultMenu : pominis ? pominisMenu : undefined,
    config: configTemplate,
  }
  return {
    theme: theme || 'default',
    sources: ([['start', 'pages/start.vue'], ['menu', menuPath], ['config', configPath]] as const).map(([id, path]) => ({
      id,
      path,
      exists: Object.hasOwn(files, path),
      content: files[path] ?? fallback[id],
    })),
  }
}

export function themeOverrideChanges(bundle: ThemeSources, target: ThemeSourceId) {
  return bundle.sources
    .filter(source => !source.exists && source.content !== undefined && (source.id === target || (target === 'start' && source.id === 'menu')))
    .map(source => ({ path: source.path, content: source.content!, expected: null }))
}

export function themeAiContext(bundle: ThemeSources, request: string, zh: boolean) {
  const heading = zh ? '# 首页主题编辑' : '# Start-page theme editing'
  const instructions = zh
    ? '请修改以下项目覆盖文件，保留开始游戏、读档、设置和帮助等原有动作。预览与正式游戏共用组件；样式限于游戏容器，使用 --adv-theme-* 和公开游戏 token，适配窄画面、键盘焦点及减少动态偏好。返回需要修改的完整文件或可审阅的 diff。没有项目覆盖的文件请先创建，避免修改安装包。'
    : 'Edit these project overrides while preserving game, save, settings and help actions. Preview and production share components. Scope styles to the game, use --adv-theme-* and public game tokens, and preserve narrow layouts, keyboard focus and reduced motion. Return complete changed files or a reviewable diff. Create missing overrides instead of editing installed packages.'
  return [heading, `Theme: ${bundle.theme}`, request.trim(), instructions, ...bundle.sources.filter(source => source.content !== undefined).map(source => `## ${source.path} (${source.exists ? 'project' : 'create override'})\n\n\`\`\`${source.path.endsWith('.vue') ? 'vue' : source.path.endsWith('.json') ? 'json' : /\.(?:ts|mts|cts)$/u.test(source.path) ? 'typescript' : 'javascript'}\n${source.content}\n\`\`\``)].join('\n\n')
}
