import type { ProjectTemplateDefinition } from '../types'
import advConfig from './adv.config.json?raw'
import chapter1 from './adv/chapters/1.chapter.md?raw'
import aria from './adv/characters/aria.character.md?raw'
import kai from './adv/characters/kai.character.md?raw'
import indexAdv from './adv/index.adv.json?raw'
import gameSettings from './adv/settings/game.json?raw'
import meta from './meta'
import favicon from './public/favicon.svg?raw'
import readme from './README.md?raw'

const template: ProjectTemplateDefinition = {
  meta,
  files: [
    { name: 'adv.config.json', content: advConfig, isAdvConfig: true },
    { name: 'adv/index.adv.json', content: indexAdv, isEntry: true },
    { name: 'adv/characters/aria.character.md', content: aria },
    { name: 'adv/characters/kai.character.md', content: kai },
    { name: 'adv/chapters/1.chapter.md', content: chapter1 },
    { name: 'adv/settings/game.json', content: gameSettings },
    { name: 'public/favicon.svg', content: favicon },
    { name: 'README.md', content: readme },
  ],
}

export default template
