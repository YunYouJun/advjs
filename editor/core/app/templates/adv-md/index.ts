import type { ProjectTemplateDefinition } from '../types'

// SSOT: adv/ content files imported from CLI template (single source of truth)
import advConfig from '@advjs/template/adv.config.json?raw'
import chapter1 from '@advjs/template/adv/chapters/chapter_01.adv.md?raw'
import chapter2 from '@advjs/template/adv/chapters/chapter_02.adv.md?raw'
import chapter3 from '@advjs/template/adv/chapters/chapter_03.adv.md?raw'
import chaptersReadme from '@advjs/template/adv/chapters/README.md?raw'
import aria from '@advjs/template/adv/characters/aria.character.md?raw'
import homeroomTeacher from '@advjs/template/adv/characters/homeroom-teacher.character.md?raw'
import kai from '@advjs/template/adv/characters/kai.character.md?raw'
import charsReadme from '@advjs/template/adv/characters/README.md?raw'
import glossary from '@advjs/template/adv/glossary.md?raw'
import outline from '@advjs/template/adv/outline.md?raw'
import scenesReadme from '@advjs/template/adv/scenes/README.md?raw'
import schoolRooftop from '@advjs/template/adv/scenes/school-rooftop.md?raw'
import school from '@advjs/template/adv/scenes/school.md?raw'
import shrine from '@advjs/template/adv/scenes/shrine.md?raw'
import world from '@advjs/template/adv/world.md?raw'

// Editor-specific files (not shared with CLI template)
import meta from './meta'
import favicon from './public/favicon.svg?raw'
import readme from './README.md?raw'

const template: ProjectTemplateDefinition = {
  meta,
  files: [
    { name: 'adv.config.json', content: advConfig, isAdvConfig: true },
    // World & story structure
    { name: 'adv/world.md', content: world },
    { name: 'adv/outline.md', content: outline },
    { name: 'adv/glossary.md', content: glossary },
    // Chapters
    { name: 'adv/chapters/README.md', content: chaptersReadme },
    { name: 'adv/chapters/chapter_01.adv.md', content: chapter1, isEntry: true },
    { name: 'adv/chapters/chapter_02.adv.md', content: chapter2 },
    { name: 'adv/chapters/chapter_03.adv.md', content: chapter3 },
    // Characters
    { name: 'adv/characters/README.md', content: charsReadme },
    { name: 'adv/characters/kai.character.md', content: kai },
    { name: 'adv/characters/aria.character.md', content: aria },
    { name: 'adv/characters/homeroom-teacher.character.md', content: homeroomTeacher },
    // Scenes
    { name: 'adv/scenes/README.md', content: scenesReadme },
    { name: 'adv/scenes/school.md', content: school },
    { name: 'adv/scenes/school-rooftop.md', content: schoolRooftop },
    { name: 'adv/scenes/shrine.md', content: shrine },
    // Editor-specific
    { name: 'public/favicon.svg', content: favicon },
    { name: 'README.md', content: readme },
  ],
}

export default template
