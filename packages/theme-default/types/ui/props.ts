// export interface AdvCheckboxProps {
//   checked: boolean
//   click?: () => void
// }

// @ts-expect-error todo: import type from vue
export { AdvCheckboxProps } from '@advjs/theme-default/components/core/AdvCheckbox.vue'
// @ts-expect-error todo: import type from vue
export { AdvRadioGroupProps } from '@advjs/theme-default/components/core/AdvRadioGroup.vue'
// @ts-expect-error todo: import type from vue
export { AdvSelectProps } from '@advjs/theme-default/components/core/AdvSelect.vue'

export interface AdvItemOption {
  label: string
  value: string
  [key: string]: any
}

// export interface AdvRadioGroupProps {
//   checked: string
//   options: AdvItemOption[]
// }

// export interface AdvSelectProps {
//   selected: string
//   change?: (value: string) => void
//   options?: AdvItemOption[]
// }
