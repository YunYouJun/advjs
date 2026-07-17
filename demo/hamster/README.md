# 仓鼠：星海回声

ADV.JS 的旗舰能力演示项目。它按发表顺序完整改编 YunYouJun 的《仓鼠》与续作《仓生》，以 19 个可审计章节展示变量与条件、稳定选择 ID、跨章节跳转、角色立绘、背景与 BGM、跨周目解锁，以及 `star-map`、`civilization` 两种插件活动。

```bash
# 在仓库根目录
pnpm demo:hamster

# 生产构建与单文件构建
pnpm build:demo:hamster
pnpm -C demo/hamster build:singlefile
```

## 展示内容

- `public/md/chapters/`：与两篇原作 19 个章节一一对应的 `.adv.md` 脚本；
- `adv/adaptation.json`：锁定原文 revision、SHA-256、章节映射、人物表、场景表与 COS 路径；
- `adv/settings/game.json`：Studio 可安全读取的标题、变量与必需插件；
- `adv/characters/`、`adv/scenes/`：角色卡与场景目录；
- `public/img/`、`public/audio/`：完全本地、可离线部署的原创素材；
- `scripts/generate-ambient.mjs`：可确定性再生成环境音的脚本。

首次游玩只显示原作模式。读完两篇原作及其后记后，浏览器会持久化 `canonicalCompleted`，下一次新游戏才显示 A+ 演绎模式。演绎模式中的三个主题结局均明确标注为非原作内容，且使用 `variables/push-unique` 幂等记录解锁状态。

原作覆盖可以独立审计：

```bash
node skills/adv-adapt/scripts/audit-coverage.mjs \
  demo/hamster/adv/adaptation.json \
  demo/hamster/public/md/chapters
```

仓鼠 Demo 的项目专用工作流见 `skills/adv-hamster-demo/`。正式图片统一发布到 `https://cos.advjs.yunle.fun/games/hamster/v1/`，具体对象名与来源由素材清单管理；Skill 不保存上传凭据。

`adv.config.ts` 可以执行 TypeScript，因此只由 CLI/Vite 在受信任的本地项目中加载；Studio 不执行任意项目配置代码，而是读取纯 JSON 的 `adv/settings/game.json`，再启用自身明确允许的官方插件。

故事与原创演示素材采用单独的非软件内容许可，详见 [LICENSE.content.md](./LICENSE.content.md) 与 [ASSETS.md](./ASSETS.md)。
