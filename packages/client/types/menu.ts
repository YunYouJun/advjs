export interface MenuButtonItem {
  title: string
  do: () => void
}

export interface AdvStartMenuItem {
  id: string
  icon?: string
  title: string
  do?: () => void
}
