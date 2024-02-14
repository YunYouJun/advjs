export interface BaseToolbarItem {
  type: string
}

export interface ToolbarToggleGroup extends BaseToolbarItem {
  name: string
  type: 'toggle-group'
  value: string
  children: {
    class?: string
    onClick: () => void
    icon: string
    value: string
    label: string
  }[]
}

export interface ToolbarButton extends BaseToolbarItem {
  type: 'button'
  name?: string
  icon?: string
  /**
   * hover text
   */
  title?: string
  onClick: () => void
}

export interface ToolbarSeparator extends BaseToolbarItem {
  type: 'separator'
}

export interface ToolbarSpace extends BaseToolbarItem {
  type: 'space'
}

export type ToolbarItem = ToolbarToggleGroup | ToolbarButton | ToolbarSeparator | ToolbarSpace
