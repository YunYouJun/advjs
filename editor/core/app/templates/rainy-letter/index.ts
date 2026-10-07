import type { ProjectTemplateDefinition } from '../types'
import assets from './assets.json?raw'
import room from './assets/room.svg?raw'
import sunrise from './assets/sunrise.svg?raw'
import chapter from './chapter.adv.md?raw'
import character from './xiaoyu.character.md?raw'

const template: ProjectTemplateDefinition = {
  meta: {
    id: 'rainy-letter',
    name: '雨夜来信',
    nameEn: 'Rainy letter',
    desc: '对白、选项与场景切换 · 本地素材',
    descEn: 'Dialogue, choices and scenes · Local assets',
    icon: 'i-ri-book-open-line',
    category: 'example',
  },
  files: [
    { name: 'adv.config.json', content: '{"format":"adv-md","root":"./adv"}', isAdvConfig: true },
    { name: 'adv/settings/game.json', content: '{"title":"{{projectName}}"}' },
    { name: 'adv/chapters/chapter_01.adv.md', content: chapter, isEntry: true },
    { name: 'adv/characters/xiaoyu.character.md', content: character },
    { name: 'adv/scenes/room.md', content: '---\nid: room\nname: 房间\nassetId: room\n---\n\n雨夜的书房，窗边留着一封信。\n' },
    { name: 'adv/scenes/sunrise.md', content: '---\nid: sunrise\nname: 海边\nassetId: sunrise\n---\n\n雨停了，清晨的海面映着暖光。\n' },
    { name: 'adv/assets.json', content: assets },
    { name: 'adv/assets/room.svg', content: room },
    { name: 'adv/assets/sunrise.svg', content: sunrise },
    { name: 'README.md', content: '# {{projectName}}\n\nADV.JS 原创入门示例「雨夜来信」。所有背景均为项目内 SVG，无需下载素材。\n\n1. 在项目树打开 `adv/chapters/chapter_01.adv.md`，修改对白并保存。\n2. 在「游戏」面板启动预览，点击对白继续，体验选项和场景切换。\n3. 在「素材」面板打开背景；人物与场景资料分别位于 `adv/characters` 和 `adv/scenes`。\n\n对白、选项与场景切换已连接到游戏；人物文件用于创作资料，本示例不包含人物立绘。选项展示交互，后续对白共用同一段剧情。\n\n可自由修改和使用此示例的文本与 SVG 素材。\n' },
  ],
}

export default template
