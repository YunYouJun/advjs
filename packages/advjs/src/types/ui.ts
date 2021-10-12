export type UseOptions<T> = Omit<T, 'type'>

export interface BaseMenuItem {
  type: string
  /**
   * 标签文本
   */
  label: string
}

export interface AdvCheckbox extends BaseMenuItem {
  type: 'checkbox'
  /**
   * 是否被选中
   */
  checked: boolean
}

export type AdvCheckboxOptions = UseOptions<AdvCheckbox>

export interface AdvSelect {
  type: 'select'
}
