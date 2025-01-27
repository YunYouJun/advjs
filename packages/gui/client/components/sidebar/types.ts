/**
 * Sidebar item
 */
export interface AGUISidebarMenuItem {
  key: string
  /**
   * 标题
   */
  title: string
  /**
   * 图标 class
   */
  icon?: string
  /**
   * 点击事件
   *
   * router.push
   */
  onClick?: () => void
}
