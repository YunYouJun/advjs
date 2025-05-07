import type { Ref } from 'vue'

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
  modelValue: Ref<number>
  unit?: string
  min?: number
  max?: number
  step?: number
}
