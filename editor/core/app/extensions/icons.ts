/** Literal classes keep the supported icons in the production UnoCSS bundle. */
const icons: Record<string, string> = {
  'ri:earth-line': 'i-ri-earth-line',
  'ri:refresh-line': 'i-ri-refresh-line',
  'ri:clipboard-line': 'i-ri-clipboard-line',
  'ri:chat-1-line': 'i-ri-chat-1-line',
  'ri:list-check': 'i-ri-list-check',
  'ri:puzzle-line': 'i-ri-puzzle-line',
  'ri:error-warning-line': 'i-ri-error-warning-line',
  'ri:gamepad-line': 'i-ri-gamepad-line',
  'ri:user-line': 'i-ri-user-line',
  'ri:music-line': 'i-ri-music-line',
  'ri:flow-chart': 'i-ri-flow-chart',
  'ri:dashboard-line': 'i-ri-dashboard-line',
  'ri:folder-line': 'i-ri-folder-line',
  'ri:terminal-line': 'i-ri-terminal-line',
  'ri:information-line': 'i-ri-information-line',
  'ri:book-open-line': 'i-ri-book-open-line',
  'ri:group-line': 'i-ri-group-line',
}
export function editorIcon(id?: string) {
  return icons[id ?? ''] ?? 'i-ri-layout-line'
}
