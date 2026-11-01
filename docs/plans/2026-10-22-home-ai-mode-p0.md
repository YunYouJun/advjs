# 首页 AI 模式 P0：无尽列车

日期：2026-10-22。状态：代码已完成，未提交；真实密钥实测与示例旅程待做（见文末）。设计与全部决策见[首页 AI 模式设计](../specs/2026-10-22-home-ai-mode-design)，本计划只拆任务和验收。

## 范围

P0 交付电车皮肤上的无尽列车：访客填入自己的密钥后，AI 按站写 `.adv.md`，引擎编译、播放，项目区实时显示正在写的文件。剧本语言跟随站点（中文站写中文，`/en/` 写英文）。

不在 P0：自由输入、人生模拟器、运行续玩、额度提示、导出压缩包（见设计 §17）。不改动 Studio。

## 任务

### 1. `@advjs/core/project` 子路径

- `packages/core/build.config.ts` 增加 `src/project/index` → `project` 入口；`package.json` 的 `exports` 增加 `./project`。
- 根 `tsconfig.json` 增加 `@advjs/core/project` 路径。
- 文档站 `docs/vite.config.ts` 把 `@advjs/core/project`、`@advjs/parser`、`@advjs/audio`、`@advjs/assets`、`@advjs/ai` 别名到源码。

### 2. `@advjs/ai` 改结构

- 现有的剧本 JSON 生成、混元工作流和类型移到 `src/node.ts`，以 `@advjs/ai/node` 导出，行为不变；`scripts/*` 改为从 `../src/node` 导入。
- 根入口 `src/index.ts` 只导出浏览器可用的 `chat` 和 `story`，不得引用 `node:*`、`process`、`dotenv` 或任何 SDK。
- `src/chat/`：`streamChat`（SSE、单块读取超时、有限重试、可选 `onUsage`）、`testAiConnection`、`AiApiError`、`AI_PROVIDER_PRESETS`。
- `build.config.ts` 增加 `node` 入口；`package.json` 的 `exports` 增加 `./node`。

### 3. `story` 会话

`packages/ai/src/story/`，只依赖 `@advjs/types`，编译函数由调用方注入：

- `source.ts`：提取（去掉外壳）、读取 frontmatter 的 `plotSummary` 和标题、给标题补锚点、定位结尾的选项块（跳过围栏代码块）、选项标签转义。
- `validate.ts`：设计 §5.3 的结构检查，按语言使用长度上限，结果为带行号的问题列表。
- `links.ts`：接受下一段时改写做出选择的章节：选中项指向下一段，其余指向 `unwritten#unwritten`。
- `prompt.ts`：按“稳定前缀在前”组装消息，系统规则用英文写一份，并指定剧本语言。
- `session.ts`：`createStorySession`，包括 `generate`（流式、编译、校验、修复一次、备用段）、`accept`、`files`、`usage`。网络、鉴权、限流错误直接抛出，不使用备用段。

### 4. 无尽列车种子与模式

- `docs/.vitepress/theme/components/home/ai/seeds/endless-tram/{zh,en}/`：`adv.config.json`、`adv/settings/game.json`、`adv/world.md`、`adv/characters/xiaoyun.character.md`、`adv/chapters/tram/01-depart.adv.md`（手写开场，结尾是不带目标的选项）、`adv/chapters/unwritten/01.adv.md`；种子根目录下的 `fallback.adv.md` 是备用段模板。
- 种子不放进 `stories/`，以免进入构建期的编译结果和首屏的源码高亮数据。
- `ai/modes/endless-tram.ts`：变量白名单（`memories` 只能 `push-unique`，最多保留 8 项）、引擎变量 `stop`、选项 2–3 个、提示词片段。

### 5. 首页接入

- 共享模块：
  - 把 `scripts/home-stories.ts` 里计算节点源码位置的逻辑抽成 `data/story-map.ts`；
  - 把 `stories.data.ts` 的配色角色映射抽成 `data/source-roles.ts`；
  - 构建脚本和 AI 运行共用这两个模块。
- `composables/player.ts`：
  - 同一 Program ID 换 Program 时不重置；
  - 新增 `continueAt(to, variables)`，换运行时后保留对白记录和站点轨迹；
  - 记录 `lastChoice`。
- 首屏只新增 `composables/ai-mode.ts`：开关状态和一个按需加载器。其余都放在 `components/home/ai/` 下，点击后才加载：
  - 运行控制 `run.ts`：编译、源码映射、高亮、生成与接受、错误状态；
  - 设置面板 `HomeAiSettings.vue`；
  - 浏览器端高亮 `highlight.ts`。
- `HomeScriptDemo.vue`：
  - AI 模式下播放运行中的故事，项目区显示种子文件和已生成的段落；
  - 生成中新文件逐行出现；
  - 切换皮肤即退出 AI 模式。
- `TramStage.vue`：
  - 常驻“AI”开关；
  - AI 模式下线路图改为按已接受的站点线性延伸（起点加最近 6 站）；
  - 生成中显示“行驶中”和已经写出的站名；
  - 出错时可以重试或打开设置；
  - “下车”后显示车票（经过的站、`memories`），可以“再坐一趟”或回到末班电车。
- 中英文案加入 `data/copy.ts`。

### 6. 密钥设置

- `ai/settings.ts`：
  - 默认只存 `sessionStorage`，勾选“在此设备上记住”后才写 `localStorage` 的 `advjs:home-ai`；“清除”同时清空两处；
  - 自定义地址只接受 `https` 和本机地址。
- 面板：
  - 选择服务商、填写模型和密钥，保存前测试连接；
  - 写明请求会发往的主机，并建议单独创建一个密钥；
  - 密钥输入框为 `type="password"`、`autocomplete="off"`，焦点留在面板内，`Esc` 关闭。

### 7. 首屏守卫

- 在文档站的 Vite 配置中加入插件：生成产物时，计算应用入口和首页页面块的静态导入闭包。闭包中若出现 `packages/ai/`、`packages/parser/`、`packages/core/src/project/` 或 `shiki`，构建直接失败。

### 8. 示例旅程脚本

- `scripts/home-ai-sample.ts`：用同一个会话和种子，在 Node 中按语言生成一段示例旅程，写到 `ai/samples/endless-tram/<locale>/`。需要 `DEEPSEEK_API_KEY`，生成后人工审读再提交。
- 首页在没有密钥时提供“看一段示例旅程”，用运行控制以只读方式播放示例（不调用模型）。

## 验收

1. 单元测试（Vitest）通过：
   - `chat` 的 SSE 解析、超时、错误分类和 `usage`；
   - `story` 的每条校验规则、修复、备用段、链接改写、标签转义；
   - 用假的流式客户端连续生成三站后，导出的文件经 `compileProject` 编译无错误；
   - 中英文种子和备用段都能编译；
   - 密钥的会话存储、持久存储与清除；
   - 播放器换 Program 后保留对白记录。
2. `pnpm lint` 对改动文件无错误；`@advjs/ai` 和 `@advjs/core` 能用 `unbuild` 构建；首页静态构建通过首屏守卫。
3. 浏览器中（拦截 `chat/completions`，回放录制的 SSE）：
   - 中英文首页都能开启 AI 模式、填写设置、生成三站并下车；
   - 修复失败时使用备用段；
   - 网络错误可以重试；
   - 切换皮肤会中止请求并回到手写故事；
   - 窄屏（约 320px）布局正常。
4. AI 分块 gzip 后的大小写入验收记录；超过 300 KB 时按设计 §10 改用逐行着色器。

## 需要用户提供

- 一个 DeepSeek 密钥（或在本机设置 `DEEPSEEK_API_KEY`），用于设计 §16.2 的实测：从浏览器发出真实请求并流式返回、连续 30 站的等待时间和修复率，以及生成中英文示例旅程。没有密钥时，以上各项在验收记录中标为未验证。

## 验收记录（2026-10-22）

已验证：

- 单元测试 30 项通过：`tests/unit/ai/chat-client.test.ts`、`tests/unit/ai/story-session.test.ts`、`tests/unit/home/ai-settings.test.ts`。会话测试使用真实的 `compileProject` 和中英文种子，模型回复由假的流式客户端回放。
- `@advjs/core` 与 `@advjs/ai` 用 `unbuild` 构建通过；`@advjs/ai` 的浏览器入口产物没有任何 `import`。
- 首页静态构建（`vitepress build`）通过，首屏守卫生效。AI 分块：主块 503 KB / gzip 152 KB；markdown、yaml、json 语法与设置、图层等小块合计约 gzip 17 KB，总计约 gzip 169 KB，低于 300 KB 预算，保留 shiki。
- `scripts/home-stories.ts` 改用共享的 `story-map.ts` 后，五个手写故事的编译结果与改动前逐字节一致。
- 浏览器（开发服务器，页面内替换 `fetch` 回放流式回复，未发出真实请求）：
  - 中文页：开启 AI → 填写设置 → 测试连接（1 token）→ 发车 → 生成两站；
  - 第一次写错时显示“正在修正”，修正后通过；
  - 两次都写错时使用备用段并提示；网络失败后可以重试；下车后显示车票；“再坐一趟”从始发站重新开始；
  - 切换皮肤和按 Esc 取消都会退出 AI 模式；
  - 英文页生成英文站点，提示词要求英文；
  - 320px 宽度无横向溢出，线路图和设置面板完整显示；
  - 设置默认只写入 `sessionStorage`。

未验证：

- 真实密钥下浏览器发出的 `POST` 与流式响应（目前只验证了预检）、连续 30 站的等待时间、每段 token 数、修复率和备用段使用率；
- 中英文示例旅程尚未生成（`scripts/home-ai-sample.ts` 已就绪，需要密钥），所以“看一段示例”按钮暂不出现；
- 端到端测试（Playwright 拦截请求）尚未编写。
