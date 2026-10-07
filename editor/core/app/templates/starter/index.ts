import type { ProjectTemplateDefinition } from '../types'
import game from '../../../../../demo/starter/game.config.json'
import portrait from '../../../../../demo/starter/public/img/characters/xiaoyun.webp?inline'
import room from '../../../../../demo/starter/public/img/room.svg?raw'
import chapter from '../../../../../demo/starter/public/md/chapters/hello.adv.md?raw'

// The existing Starter demo owns the story, character data and media.
// Only its file layout is adapted to the Editor's standard Markdown project.
const { chapters: _chapters, characters, ...settings } = game
const template: ProjectTemplateDefinition = {
  meta: {
    id: 'starter',
    name: '你好，ADV.JS',
    nameEn: 'Hello, ADV.JS',
    desc: '现有 Starter 示例 · 头像、选项与变量',
    descEn: 'The Starter demo · Portraits, choices and variables',
    icon: 'i-ri-book-open-line',
    category: 'example',
  },
  files: [
    { name: 'adv.config.json', content: '{"format":"adv-md","root":"./adv","showCharacterAvatar":true,"viewportFit":"responsive"}', isAdvConfig: true },
    { name: 'adv/settings/game.json', content: JSON.stringify({ ...settings, title: '{{projectName}}' }) },
    { name: 'adv/chapters/hello.adv.md', content: chapter, isEntry: true },
    ...characters.map(character => ({ name: `adv/characters/${character.id}.character.md`, content: `---\n${Object.entries(character).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n')}\n---\n\n入门向导小云。头像复用 ADV.JS 仓库的本地人物素材。\n` })),
    { name: 'adv/scenes/demo-room.md', content: '---\nid: demo-room\nname: 演示室\nsrc: /img/room.svg\n---\n\n最小示例的演示室。\n' },
    { name: 'public/img/room.svg', content: room },
    { name: 'public/img/characters/xiaoyun.webp', content: portrait.split(',')[1]!, encoding: 'base64' },
    { name: 'README.md', content: '# {{projectName}}\n\n复用 ADV.JS `demo/starter` 的现有入门示例，包含本地背景、人物头像、真实跳转选项、变量和条件文本。无需联网下载素材。\n\n1. 打开 `adv/chapters/hello.adv.md` 修改剧本。\n2. 在「游戏」面板启动预览，选择「看看语法」或「直接开始」。\n3. 人物资料与头像路径位于 `adv/characters/guide.character.md`；头像图片位于 `public/img/characters/xiaoyun.webp`。\n4. `adv.config.json` 中的 `showCharacterAvatar` 控制头像显示；关闭后姓名与正文使用无头像布局。\n\n入门向导的头像来自仓库内 `demo/love` 的小云素材。\n' },
  ],
}

export default template
