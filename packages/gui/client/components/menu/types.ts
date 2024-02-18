export interface MenuItem {
  type?: 'checkbox'
  label: string
  /**
   * Shortcut key
   */
  accelerator?: string
  disabled?: boolean

  checked?: boolean
  onClick?: () => void
}

export interface Menu {
  name: string
  items: MenuItem[]
}
