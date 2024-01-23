import type { AGUIPropertyProps } from './types'

export function createPropertiesForm() {
  return {
    add(options: AGUIPropertyProps) {
      function label(text: string) {
        options.name = text
      }

      return {
        /**
         * alias of name
         */
        label,
        name: label,
      }
    },
  }
}
