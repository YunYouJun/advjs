# 仓鼠：星海回声

ADV.JS 的旗舰能力演示项目。它改编自 YunYouJun 的仓鼠小说，覆盖四章叙事、三种确定性结局、变量与条件、稳定选择 ID、跨章节跳转、角色立绘、背景与 BGM，以及 `star-map`、`civilization` 两种插件活动。

```bash
# 在仓库根目录
pnpm demo:hamster

# 生产构建与单文件构建
pnpm build:demo:hamster
pnpm -C demo/hamster build:singlefile
```

## 展示内容

- `public/md/chapters/`：四个使用稳定英文文件名的 `.adv.md` 章节；
- `adv/settings/game.json`：Studio 可安全读取的标题、变量与必需插件；
- `adv/characters/`、`adv/scenes/`：角色卡与场景目录；
- `public/img/`、`public/audio/`：完全本地、可离线部署的原创素材；
- `scripts/generate-ambient.mjs`：可确定性再生成环境音的脚本。

`adv.config.ts` 可以执行 TypeScript，因此只由 CLI/Vite 在受信任的本地项目中加载；Studio 不执行任意项目配置代码，而是读取纯 JSON 的 `adv/settings/game.json`，再启用自身明确允许的官方插件。

故事与原创演示素材采用单独的非软件内容许可，详见 [LICENSE.content.md](./LICENSE.content.md) 与 [ASSETS.md](./ASSETS.md)。
