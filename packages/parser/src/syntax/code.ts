import yaml from 'js-yaml'

export const parseCode = () => {

}

export const codeMap = [
  {
    suffix: ['adv', 'advscript'],
    parse(val: string) {
      return JSON.parse(val)
    },
  },
  {
    suffix: ['yml', 'yaml'],
    parse(val: string) {
      return yaml.load(val)
    },
  },
]
