export interface MenuItem {
  type?: 'checkbox' | 'separator' | 'submenu' | 'normal'
  label?: string
  /**
   * Shortcut key
   */
  accelerator?: string
  disabled?: boolean

  checked?: boolean
  onClick?: () => void

  children?: MenuItem[]
}

export interface Menu {
  name: string
  items: MenuItem[]
}
