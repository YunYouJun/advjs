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

export interface AdvItemOption {
  label: string
  value: string
  [key: string]: any
}

export interface AdvCheckboxProps {
  checked: boolean
  onClick?: () => void
}

export interface AdvRadioGroupProps<T extends AdvItemOption = AdvItemOption> {
  checked: T['value']
  options: T[]
  onClick?: (value: T) => void
}

export interface AdvSelectProps<T extends AdvItemOption = AdvItemOption> {
  selected: T['value']
  options?: T[]
  change?: (value: T) => void
}

export interface AdvSliderProps {
  label: string
  modelValue: import('vue').Ref<number>
  unit?: string
  min?: number
  max?: number
  step?: number
}

export interface AdvMenuItemMap<T extends AdvItemOption = AdvItemOption> {
  Checkbox: AdvCheckboxProps
  Select: AdvSelectProps<T>
  RadioGroup: AdvRadioGroupProps<T>
  Slider: AdvSliderProps
}

export type AdvMenuItemKeys = keyof AdvMenuItemMap
export type AdvMenuItemProps<
  T extends AdvMenuItemKeys = AdvMenuItemKeys,
  U extends AdvItemOption = AdvItemOption,
> = T extends AdvMenuItemKeys ? { type: T, label: string, props: AdvMenuItemMap<U>[T] } : never
