import type { ProjectTemplateDefinition } from '../types'
import scene from '../../../../../demo/starter/adv/scenes/demo-room.md?raw'
import game from '../../../../../demo/starter/game.config.json'
import portrait from '../../../../../demo/starter/public/img/characters/xiaoyun.webp?inline'
import room from '../../../../../demo/starter/public/img/room.svg?raw'
import ending from '../../../../../demo/starter/public/md/chapters/ending.adv.md?raw'
import hello from '../../../../../demo/starter/public/md/chapters/hello.adv.md?raw'
import letter from '../../../../../demo/starter/public/md/chapters/letter.adv.md?raw'

// The existing Starter demo owns the story, character data and media.
// Only its file layout is adapted to the Editor's standard Markdown project.
const { chapters, characters, ...settings } = game
const chapterSources: Record<string, string> = { hello, letter, ending }
const template: ProjectTemplateDefinition = {
  meta: {
    id: 'starter',
    name: '你好，ADV.JS',
    nameEn: 'Hello, ADV.JS',
    desc: '三章分支故事 · 线索、回看与两种结局',
    descEn: 'Three chapters · Clues, revisits and two endings',
    icon: 'i-ri-book-open-line',
    category: 'example',
  },
  files: [
    { name: 'adv.config.json', content: '{"format":"adv-md","root":"./adv","showCharacterAvatar":true,"viewportFit":"responsive"}', isAdvConfig: true },
    { name: 'adv/settings/game.json', content: JSON.stringify({ ...settings, title: '{{projectName}}', chapters: chapters.map(chapter => ({ id: chapter.id, title: chapter.title, sources: [`chapters/${chapter.id}.adv.md`] })) }) },
    ...chapters.map(chapter => ({ name: `adv/chapters/${chapter.id}.adv.md`, content: chapterSources[chapter.id]!, isEntry: chapter.id === game.entryChapterId })),
    ...characters.map(character => ({ name: `adv/characters/${character.id}.character.md`, content: `---\n${Object.entries(character).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n')}\n---\n\n入门向导小云。头像复用 ADV.JS 仓库的本地人物素材。\n` })),
    { name: 'adv/scenes/demo-room.md', content: scene },
    { name: 'public/img/room.svg', content: room },
    { name: 'public/img/characters/xiaoyun.webp', content: portrait.split(',')[1]!, encoding: 'base64' },
    { name: 'README.md', content: '# {{projectName}}\n\n复用 ADV.JS `demo/starter` 的三章来信故事，包含本地背景、人物头像、同章与跨章选择、变量动作、条件选项、可退出的回看循环和两种明确结局。无需联网下载素材。\n\n1. 在「游戏」面板启动预览，选择「看看语法」或「直接开始」，再进入窗边的来信。\n2. 打开「流程图」查看真实分支；点击节点定位 `adv/chapters/hello.adv.md`、`letter.adv.md` 或 `ending.adv.md` 的源码。\n3. 检查邮戳会获得线索，并显示「沿着邮戳理解这封信」；选择「把光寄回明天」到达结局一。\n4. 「再读一次来信」可回看；「先把来信收好」随时退出循环，到达结局二。\n5. 章节顺序、hello 入口和初始变量位于 `adv/settings/game.json`。\n6. 人物资料位于 `adv/characters/guide.character.md`；头像位于 `public/img/characters/xiaoyun.webp`。`adv.config.json` 中的 `showCharacterAvatar` 控制头像显示。\n\n入门向导的头像来自仓库内 `demo/love` 的小云素材。\n' },
  ],
}

export default template
