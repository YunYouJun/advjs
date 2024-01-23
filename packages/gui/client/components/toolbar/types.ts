export interface ToolbarItem {
  type: 'button' | 'separator' | 'space'
  name?: string
  icon?: string
  onClick?: () => void
}
