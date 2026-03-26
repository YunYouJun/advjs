import type { ProjectTemplateDefinition } from '../types'
import advConfig from './adv.config.json?raw'
import indexAdv from './index.adv.json?raw'
import meta from './meta'
import readme from './README.md?raw'

const template: ProjectTemplateDefinition = {
  meta,
  files: [
    { name: 'adv.config.json', content: advConfig, isAdvConfig: true },
    { name: 'index.adv.json', content: indexAdv, isEntry: true },
    { name: 'README.md', content: readme },
  ],
}

export default template
