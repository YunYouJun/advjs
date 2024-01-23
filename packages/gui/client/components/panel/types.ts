import type { FSItem, Vector } from '../../types'
import type { AGUIAccordionProps } from '../accordion/types'

/**
 * property base props
 */
export interface AGUIPropertyBaseProps {
  /**
   * Property name
   */
  name?: string
  value?: string | number | Vector | boolean | Array<string | { label: string, value: string }>
  disabled?: boolean
}

export interface AGUIPropertyInputProps extends AGUIPropertyBaseProps {
  type: 'input'
  value: string
}

export interface AGUIPropertyNumberProps extends AGUIPropertyBaseProps {
  type: 'number'
  value: number
}

export interface AGUIPropertyCheckboxProps extends AGUIPropertyBaseProps {
  type: 'checkbox'
  value: boolean
}

export interface AGUIPropertySelectProps extends AGUIPropertyBaseProps {
  type: 'select'
  options: Array<string | { label: string, value: string }>
  value: string
}

export interface AGUIPropertyColorProps extends AGUIPropertyBaseProps {
  type: 'color'
  value: string
}

export interface AGUIPropertyDividerProps extends AGUIPropertyBaseProps {
  type: 'divider'
}

export interface AGUIPropertySliderProps extends AGUIPropertyBaseProps {
  type: 'slider'
  min: number
  max: number
  step: number
  value: number
}

export interface AGUIPropertyNumberFieldProps extends AGUIPropertyBaseProps {
  type: 'number-field'
  min: number
  max: number
  step: number
  value: number
}

export interface AGUIPropertyNumberSliderProps extends AGUIPropertyBaseProps {
  type: 'number-slider'
  min: number
  max: number
  step: number
  value: number
}

export interface AGUIPropertyVectorProps extends AGUIPropertyBaseProps {
  type: 'vector'
  value: Vector
}

export interface AGUIPropertyButtonProps extends AGUIPropertyBaseProps {
  type: 'button'
  label?: string
  title?: string
  onClick: () => void
}

export interface AGUIPropertyFileProps extends AGUIPropertyBaseProps {
  type: 'file'
  placeholder?: string
  onFileChange?: (file?: FSItem) => (void | Promise<void>)
}

export type AGUIPropertyProps =
  AGUIPropertyInputProps |
  AGUIPropertyNumberProps |
  AGUIPropertyCheckboxProps |
  AGUIPropertySelectProps |
  AGUIPropertyDividerProps |
  AGUIPropertyColorProps |
  AGUIPropertySliderProps |
  AGUIPropertyNumberFieldProps |
  AGUIPropertyNumberSliderProps |
  AGUIPropertyVectorProps |
  AGUIPropertyButtonProps |
  AGUIPropertyFileProps

export interface AGUIPropertiesPanelProps extends AGUIAccordionProps {
  properties: AGUIPropertyProps[]
}
