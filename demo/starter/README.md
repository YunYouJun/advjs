# ADV.JS Starter

一个可直接复制、可试玩的 ADV.JS 三章分支故事。保留简短语法开场，再用一封窗边来信体验线索、回看和两种结局。

```bash
pnpm install
pnpm dev
```

- 游戏配置：`adv.config.ts`
- 剧情配置与人物数据：`game.config.json`
- 开场与语法提示：`public/md/chapters/hello.adv.md`
- 来信、线索与回看：`public/md/chapters/letter.adv.md`
- 两种明确结局：`public/md/chapters/ending.adv.md`
- 场景资料：`adv/scenes/demo-room.md`
- 本地背景：`public/img/room.svg`
- 本地人物头像：`public/img/characters/xiaoyun.webp`，复用 `demo/love` 的小云素材

Editor 的「你好，ADV.JS」入门模板直接复用本示例的全部剧本、人物数据与本地图片，只转换为标准 Markdown 项目目录。章节顺序和 `hello` 入口均显式保留，避免单独维护另一套入门故事。

两条试玩路线：

- 检查邮戳 → 记住日期 → 沿着邮戳理解来信 → 把光寄回明天，到达结局一。
- 先读淡字 → 重新整理思路 → 先把来信收好，到达结局二。

「再读一次来信」返回本章入口；「先把来信收好」一直可用，所以回看循环随时可以退出。获得邮戳线索后，「沿着邮戳理解这封信」才会出现。`readCount` 记录阅读次数，`clueFound` 记录线索，`ending` 记录本次结局。

在 Editor 的「流程图」中可以查看三章的同章与跨章分支，并点击节点定位源码。示例只使用背景、旁白、头像对话、选择、变量动作和条件文本，不需要在线素材或插件。`showCharacterAvatar` 关闭时使用姓名置于正文上方的无头像布局。需要查看插件活动和更完整的调试链路，请运行 `pnpm demo:hamster`。
