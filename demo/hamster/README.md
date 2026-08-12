# 仓鼠：星海回声

ADV.JS 的旗舰能力演示项目。故事被整理为一条从盛夏午后驶向黯淡群星的 16 章完整航线；标题、章节星图和剧情中不显示来源分割。通关后会持久化完成状态，并在标题页开放世界内的二周目“回声演算”。

```bash
# 在仓库根目录启动
pnpm demo:hamster

# 生产构建与单文件构建
pnpm build:demo:hamster
pnpm -C demo/hamster build:singlefile
```

## 展示内容

- `public/md/chapters/`：16 章连续 `.adv.md` 主线，含逐场角色调度、CG、转场和显式 BGM；
- `adv/adaptation.json`：内部来源 revision、SHA-256、正文映射、人物表、场景表和排除的作者元信息；
- `adv/settings/game.json`：Studio 可安全读取的标题、变量、跨周目状态和必需插件；
- `adv/characters/`、`adv/scenes/`：角色卡与场景目录；
- `adv/assets.json`：60 项内容哈希素材，包括 28 张角色差分、15 张背景、8 张 CG、1 张六帧仓鼠动画与 8 首 BGM；
- `adv/cos-release.json`：69 个当前发布对象的无凭证上传计划，包含 MIME、缓存、SHA-256 与 manifest-last 顺序；
- `pages/start.vue`、`components/AdvSettingsPanel.vue`、`styles/index.scss`：项目级标题、设置与“轨道档案”运行时 UI；
- `scripts/prepare-media.mjs`、`scripts/generate-bgm.mjs`：可复现的 CG/动画派生和原创循环音频生产脚本。

游戏用于验证背景预载和预置转场、绝对立绘槽位、差分与入退场动作、spritesheet、BGM 交叉淡化、CG 解锁画廊、存档/回退、跨周目入口、星图与文明互动、设置界面覆盖、Studio 预览/诊断与 Runtime Inspector。

来源覆盖可以独立审计：

```bash
node skills/adv-adapt/scripts/audit-coverage.mjs \
  demo/hamster/adv/adaptation.json \
  demo/hamster/public/md/chapters
node skills/adv-art/scripts/audit-assets.mjs demo/hamster/adv/assets.json
```

准备和审计 COS 发布包：

```bash
pnpm -C demo/hamster assets:release
pnpm -C demo/hamster assets:audit
pnpm -C demo/hamster assets:audit:remote
```

仓鼠 Demo 的项目专用工作流见 `skills/adv-hamster-demo/`。正式素材统一发布到 `https://cos.advjs.yunle.fun/games/hamster/v1/`，具体不可变对象名与来源由素材清单管理；Skill 不保存上传凭据。

开发服务器和生产构建默认都使用清单中的 COS 地址，不要求仓库保存媒体副本。发布前需要离线验收时可运行 `pnpm -C demo/hamster dev:local-assets`，从被忽略的 `temp/hamster-art/release-current/` 提供同一批内容哈希素材。

`adv.config.ts` 只由 CLI/Vite 在受信任的本地项目中执行。Studio 不运行任意项目配置代码，而是读取纯 JSON 设置，再启用明确允许的官方插件。

故事与原创演示素材采用单独的非软件内容许可，详见 [LICENSE.content.md](./LICENSE.content.md) 与 [ASSETS.md](./ASSETS.md)。来源链接只在游戏“关于”页和这些许可文档中展示。
