import yaml from 'js-yaml'

export const parseCode = () => {

}

export const codeMap = [
  {
    suffix: ['advnode', 'json'],
    parse(val: string) {
      const data = JSON.parse(val)
      return Array.isArray(data) ? data : [data]
    },
  },
  {
    suffix: ['adv', 'advscript'],
    parse(val: string) {
      return JSON.parse(val)
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
