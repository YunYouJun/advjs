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
  description?: string
  /**
   * pass object and key to get bound value
   */
  // value?: string | number | Vector | boolean | (string | { label: string, value: string })[]
  disabled?: boolean
  object: Record<string, any>
  key: string
}

export interface AGUIPropertyInputProps extends AGUIPropertyBaseProps {
  type: 'input'
}

export interface AGUIPropertyNumberProps extends AGUIPropertyBaseProps {
  type: 'number'
}

export interface AGUIPropertyCheckboxProps extends AGUIPropertyBaseProps {
  type: 'checkbox'
}

export interface AGUIPropertySelectProps extends AGUIPropertyBaseProps {
  type: 'select'
  options: (
    string
    | { label: string, value: string | number, icon?: string }
  )[]
}

export interface AGUIPropertyColorProps extends AGUIPropertyBaseProps {
  type: 'color'
  /**
   * color scale
   * @default 255
   * If you want to use 0-1 scale, set this to 1.
   */
  rgbScale?: number
}

export interface AGUIPropertyDividerProps {
  name?: string
  type: 'divider'
}

export interface AGUIPropertySliderProps extends AGUIPropertyBaseProps {
  type: 'slider'
  min: number
  max: number
  step: number
}

export interface AGUIPropertyNumberFieldProps extends AGUIPropertyBaseProps {
  type: 'number-field'
  min: number
  max: number
  step: number
}

export interface AGUIPropertyNumberSliderProps extends AGUIPropertyBaseProps {
  type: 'number-slider'
  min: number
  max: number
  step: number
}

export interface AGUIPropertyVectorProps extends AGUIPropertyBaseProps {
  type: 'vector'
  // value: Vector
  object: {
    [key: string]: Vector | any
  }
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
  value?: FSItem
}

/**
 * property props
 * etc: input, number, checkbox, select, divider, color, slider, number-field, number-slider, vector, button, file
 */
export type AGUIPropertyProps
  = AGUIPropertyInputProps
    | AGUIPropertyNumberProps
    | AGUIPropertyCheckboxProps
    | AGUIPropertySelectProps
    | AGUIPropertyDividerProps
    | AGUIPropertyColorProps
    | AGUIPropertySliderProps
    | AGUIPropertyNumberFieldProps
    | AGUIPropertyNumberSliderProps
    | AGUIPropertyVectorProps
    | AGUIPropertyButtonProps
    | AGUIPropertyFileProps
export type AGUIPropertyItem = AGUIPropertyProps & {
  /**
   * show property key
   */
  showKey?: boolean
}

export interface AGUIPropertiesPanelProps extends AGUIAccordionProps {
  properties: AGUIPropertyItem[]
}
