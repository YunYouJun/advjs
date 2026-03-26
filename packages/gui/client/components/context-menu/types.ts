interface AGUIContextMenuBaseItem {
  id?: string
  label: string
  icon?: string
  type?: 'label' | 'radio-group' | 'radio-item'
  disabled?: boolean
  accelerator?: string
  children?: AGUIContextMenuItemType[]
  onClick?: () => void
}

interface AGUIContextMenuSeparator {
  id?: string
  label?: string
  type: 'separator'
}

export type AGUIContextMenuItemType = AGUIContextMenuBaseItem | AGUIContextMenuSeparator
