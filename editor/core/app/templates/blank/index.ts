import type { ProjectTemplateDefinition } from '../types'
import advConfig from './adv.config.json?raw'
import chapter from './chapter.adv.md?raw'
import meta from './meta'
import readme from './README.md?raw'

const template: ProjectTemplateDefinition = {
  meta,
  files: [
    { name: 'adv.config.json', content: advConfig, isAdvConfig: true },
    { name: 'adv/settings/game.json', content: '{"title":"{{projectName}}"}' },
    { name: 'adv/chapters/chapter_01.adv.md', content: chapter, isEntry: true },
    { name: 'README.md', content: readme },
  ],
}

export default template
