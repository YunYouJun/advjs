export interface MenuItem {
  type?: 'checkbox' | 'separator' | 'submenu' | 'normal'
  label?: string
  /**
   * Shortcut key
   */
  accelerator?: string
  /**
   * show …
   * @default false
   */
  ellipsis?: boolean

  disabled?: boolean

  checked?: boolean
  onClick?: () => void

  children?: MenuItem[]
}

export interface Menu {
  name: string
  /**
   * custom class
   */
  class?: string
  items: MenuItem[]
}
