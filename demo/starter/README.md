# ADV.JS Starter

一个一眼能读完、可直接复制的 ADV.JS 项目。

```bash
pnpm install
pnpm dev
```

- 游戏配置：`adv.config.ts`
- 剧情配置与人物数据：`game.config.json`
- 剧本：`public/md/chapters/hello.adv.md`
- 本地背景：`public/img/room.svg`
- 本地人物头像：`public/img/characters/xiaoyun.webp`，复用 `demo/love` 的小云素材

Editor 的「你好，ADV.JS」入门模板直接复用本示例的剧本、人物数据与本地图片，只转换为标准 Markdown 项目目录，避免单独维护另一套入门故事。

示例只保留背景、旁白、头像对话、选择、变量动作和条件文本。`showCharacterAvatar` 关闭时使用姓名置于正文上方的无头像布局。需要查看插件活动、多章节分支和完整调试链路，请运行 `pnpm demo:hamster`。
