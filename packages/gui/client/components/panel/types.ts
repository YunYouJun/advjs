import type { Vector } from 'client/types'
import type { AGUIAccordionProps } from '../accordion/types'

export interface AGUIPanelPropertyProps {
  /**
   * Property name
   */
  name: string
  value: string | number | Vector
}

export interface AGUIPropertiesPanelProps extends AGUIAccordionProps {
  properties: AGUIPanelPropertyProps[]
}
