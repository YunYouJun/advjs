import yaml from 'js-yaml'

/**
 * Parse AdvCode (js/ts)
 */
export const parseAdvCode = () => {

}

/**
 * advnode suffix & parse
 */
export const codeMap = [
  {
    suffix: ['advnode', 'json'],
    parse(val: string) {
      const data = JSON.parse(val)
      return Array.isArray(data) ? data : [data]
    },
  },
  {
    suffix: ['yml', 'yaml'],
    parse(val: string) {
      const data = yaml.load(val)
      return Array.isArray(data) ? data : [data]
    },
  },
]
