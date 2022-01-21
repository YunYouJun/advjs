export interface AdvItemOption {
  label: string
  value: string
  [key: string]: any
}

// todo: import type from vue
// export { AdvCheckboxProps } from '@advjs/theme-default/components/core/AdvCheckbox.vue'
export interface AdvCheckboxProps {
  checked: boolean
  onClick?: () => void
}
// todo: import type from vue
// export { AdvRadioGroupProps } from '@advjs/theme-default/components/core/AdvRadioGroup.vue'
export interface AdvRadioGroupProps {
  checked: string
  options: AdvItemOption[]
  onClick?: (value: string) => void
}

// todo: import type from vue
// export { AdvSelectProps } from '@advjs/theme-default/components/core/AdvSelect.vue'
export interface AdvSelectProps {
  selected: string
  change?: (value: string) => void
  options?: AdvItemOption[]
}
