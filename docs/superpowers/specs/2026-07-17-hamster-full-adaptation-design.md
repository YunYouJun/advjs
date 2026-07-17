# 仓鼠完整改编与内容流水线设计

状态：已由用户确认

日期：2026-07-17

## 1. 决策摘要

- `demo/hamster` 采用 **A+ 双模式**：首次游玩忠实覆盖《仓鼠》与《仓生》的原作主线，通关后解锁允许明显分歧与替代结局的演绎模式。
- 两篇作品按《仓鼠》→《仓生》的先后关系组织，不再把原文压缩成四章主题摘要。
- C 类改写只用于镜头、对话切分、转场、立绘、表情、背景、CG 与音频演出，不删除原作的重要事件、人物、设定或结局。
- 公共发行素材统一使用 `https://cos.advjs.yunle.fun/games/hamster/v1/`；对象名带内容哈希，禁止在游戏配置中使用 `latest`。
- 新增通用 `adv-adapt`、通用 `adv-art` 和仅限本作的 `adv-hamster-demo` 三个项目 Skill。

本设计取代 `2026-07-17-hamster-showcase-demo-design.md` 中“不逐字搬运两篇原作”和“四章 15–20 分钟短篇”的范围约束；已完成的运行时、插件、Inspector、Studio 诊断与最小 starter 仍作为基线保留。

## 2. A+ 双模式

### 2.1 原作模式

原作模式是默认且必须完整通过的主线。章节划分可以适配 ADV 演出节奏，但必须通过来源覆盖清单追踪原文每个标题段落和关键事件。互动选择可以改变：

- 观察视角与叙述顺序；
- 可选对白、内心独白与资料说明；
- 好奇、共情、控制等可解释状态；
- 已发现线索、舞台状态和表情演出。

选择不得让首次游玩跳过必需的原作段落，也不得改写原作最终事实。分支在章节内或章节末重新汇合。

### 2.2 演绎模式

完成原作模式后写入可持久化解锁状态。演绎模式复用同一套章节和素材，但允许：

- 条件化的补充场景和跨章路线；
- 星图比对、文明初始化等插件活动产生长期结果；
- 三种及以上替代结局；
- 存档、读档、checkpoint、回退、历史、已读与跳过能力参与验收；
- Runtime Inspector、trace 和 Studio 诊断解释路线为何发生。

原作模式与演绎模式必须使用声明式变量、条件和动作，不在 Markdown 中执行任意脚本。

## 3. 内容结构

实施前先建立 `demo/hamster/adv/adaptation.json`，记录：

- 两篇来源的标题、作者、URL、许可证、顺序和段落清单；
- 每个原文段落对应的 ADV 章节与稳定来源锚点；
- 完整人物表、别名、首次出现、关系和立绘需求；
- 场景表、时间、氛围、背景与关键 CG 需求；
- 原作模式必需内容和演绎模式新增内容的边界。

每个来源段落使用 `<!-- source:<source-id>/<section-id> -->` 标记进入剧本。确定性审计只证明“每个必需来源段落都有唯一、可定位的脚本映射”；语义忠实度仍由逐章人工审查与 `adv-review` 保证。

## 4. 美术与素材

角色卡为每名需要上场的角色定义统一 `imagePrompt`、服装、比例、色板和表情矩阵。最低表情集按角色职责裁剪，主角至少包含：

- `default`
- `smile`
- `curious`
- `worried`
- `sad`
- `determined`

背景按稳定场景 ID 生成；关键情节另建 CG，不把带角色的 CG 当作可复用背景。生成图先保存可追溯的本地工作记录，再导出透明 WebP 立绘和压缩背景。公开 manifest 记录逻辑 ID、远端 URL、尺寸、字节数、SHA-256、来源或模型、提示词版本、生成日期和内容许可证。

## 5. COS 约定

```text
games/hamster/v1/
├── characters/{character-id}/{pose}/{expression}.{hash}.webp
├── backgrounds/{scene-id}.{hash}.webp
├── cg/part-01/{shot-id}.{hash}.webp
├── cg/part-02/{shot-id}.{hash}.webp
├── audio/bgm/{track-id}.{hash}.ogg
├── audio/sfx/{sound-id}.{hash}.ogg
└── manifests/assets.json
```

- 哈希素材：`Cache-Control: public, max-age=31536000, immutable`。
- manifest：短缓存并重新验证；发布新版本时使用新版本目录。
- 公共读取只需要 `GET`/`HEAD`，不携带凭证时可允许 `Access-Control-Allow-Origin: *`，确保 Demo、文档、Studio 和 Canvas/WebGL 均能读取。
- 不开放公共写入；上传使用最小权限子账号或 STS 临时凭证。
- SecretId、SecretKey、SessionToken 不写入仓库、日志、Skill 或对话。
- 公共 COS 仅保存优化后的发行素材；源工程文件和未发布生成结果不进入公开目录。

## 6. Skill 分层

### `adv-adapt`

负责把已有小说、剧本或文章改编成可审计的 ADV.JS 项目：来源授权、章节映射、人物场景清单、忠实度模式、来源锚点、结构验证与内容审查。它不负责生成图片或上传云存储。

### `adv-art`

负责角色设定、表情矩阵、背景/CG 需求、生成与规格化、素材 manifest、缓存策略和发布前验证。通用 COS 操作委托给 `tencent-cloud-cos`，不复制 SDK 或密钥流程。

### `adv-hamster-demo`

只在处理 `demo/hamster` 时使用。它固定本作的来源顺序、A+ 模式、路径前缀、命名规则、许可和验收门槛，并组合 `adv-adapt`、`adv-art`、`adv-debug`、`adv-review` 与 COS 能力。任何其他游戏不得从它继承仓鼠专用常量。

## 7. 验收门槛

- 来源审计中两篇作品所有必需段落覆盖率为 100%，没有未知或重复来源锚点。
- 完整人物表中的可见角色都有角色卡；需要立绘的角色拥有已声明的表情集。
- 原作模式可从第一篇开头连续游玩到第二篇结尾，不进入演绎结局。
- 首次通关后演绎模式可被重新进入，至少三条结局路径可达且无死路。
- 每个远端素材均在 manifest 中，URL 位于 `games/hamster/v1/`，文件名包含内容哈希。
- `adv check`、分支覆盖、素材审计、单元测试、构建和浏览器 E2E 全部通过。
- README、ASSETS、内容许可证和文档站明确区分原作内容、改编新增内容与生成素材。
