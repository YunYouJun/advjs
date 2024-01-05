export interface AGUIContextMenuItemType {
  id?: string
  label: string
  icon?: string
  type?: 'separator' | 'label' | 'radio-group' | 'radio-item'
  disabled?: boolean
  accelerator?: string
  children?: AGUIContextMenuItemType[]
  onClick: () => void
}
