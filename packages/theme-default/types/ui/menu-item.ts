import type * as AdvItem from './props'

export interface AdvMenuItemMap {
  Checkbox: AdvItem.AdvCheckboxProps
  Select: AdvItem.AdvSelectProps
  RadioGroup: AdvItem.AdvRadioGroupProps
}

export type AdvMenuItemKeys = (keyof AdvMenuItemMap)

// 基于联合类型的条件类型分发
type UnionMenuItem<T> = T extends AdvMenuItemKeys ? {
  type: T
  /**
   * 标签文本
   */
  label: string
  props: AdvMenuItemMap[T]
} : never

export type AdvMenuItemProps<T extends AdvMenuItemKeys = AdvMenuItemKeys> = UnionMenuItem<T>
