# CLI

`advjs` 提供了 `adv` 命令行工具，用于开发、构建、导出和互动播放 ADV.JS 项目。

## 安装

```bash
# 全局安装
pnpm add -g advjs

# 或在项目中使用
pnpm add advjs
```

## 命令总览

```bash
adv [command] [options]
```

| 命令              | 说明                                 |
| ----------------- | ------------------------------------ |
| `adv` / `adv dev` | 启动本地开发服务器（默认命令）       |
| `adv init`        | 从模板初始化新项目                   |
| `adv build`       | 构建可托管的 SPA                     |
| `adv export`      | 导出为视频                           |
| `adv config`      | 合并配置到单个 JSON 文件             |
| `adv play`        | 互动叙事播放（含存档 / 回退）        |
| `adv check`       | 验证剧本 / 角色 / 场景（可自动修复） |
| `adv context`     | 导出项目上下文供 AI 使用             |
| `adv debug`       | 分支图 / 覆盖率分析                  |

其中 `adv play`、`adv check`、`adv context`、`adv debug` 主要面向 AI Agent 协作（[Work with AI](/ai/skills/)），同时也可供人工使用。

全局选项：

| 选项            | 说明                       |
| --------------- | -------------------------- |
| `-t, --theme`   | 覆盖主题                   |
| `--lang`        | 语言（支持 `en`、`zh-CN`） |
| `-v, --version` | 显示版本号                 |
| `-h, --help`    | 显示帮助信息               |

## `adv init`

从内置模板初始化一个新的 ADV.JS 项目。

```bash
adv init [dir] [options]
```

### 选项

| 选项         | 默认值    | 说明                                                                 |
| ------------ | --------- | -------------------------------------------------------------------- |
| `--name`     | -         | 项目名称（替换模板中的 `{{projectName}}` 占位符）                    |
| `--force`    | `false`   | 覆盖已存在的文件                                                     |
| `--template` | `default` | 模板类型：`default`（校园恋爱）/ `galgame`（含好感度路线的恋爱游戏） |

### 模板

| 模板      | 内容                                                                                                            |
| --------- | --------------------------------------------------------------------------------------------------------------- |
| `default` | 校园恋爱骨架：单女主 + 「星之记忆」设定                                                                         |
| `galgame` | 美少女恋爱游戏：多女主 + 好感度系统 + 路线分歧，角色卡使用 `attributes.template: galgame`（生日/血型/好感度等） |

### 示例

```bash
# 在当前目录初始化（默认模板）
adv init

# 初始化到指定目录并命名
adv init my-game --name "我的游戏"

# 使用 galgame 模板
adv init my-galgame --template galgame --name "樱丘之恋"
```

## `adv dev`

启动本地开发服务器，支持热重载。这是默认命令，直接运行 `adv` 即可。

```bash
adv [entry] [options]
adv dev [entry] [options]
```

### 选项

| 选项          | 默认值  | 说明                                             |
| ------------- | ------- | ------------------------------------------------ |
| `-p, --port`  | `3333`  | 服务器端口（自动查找可用端口）                   |
| `-o, --open`  | `false` | 自动在浏览器中打开                               |
| `--remote`    | `true`  | 监听公共主机并启用远程控制                       |
| `--log`       | `warn`  | 日志级别（`error` / `warn` / `info` / `silent`） |
| `-t, --theme` | -       | 覆盖主题                                         |

### 快捷键

开发服务器运行中可使用以下快捷键：

| 快捷键   | 说明                 |
| -------- | -------------------- |
| `r`      | 重启服务器           |
| `o`      | 在浏览器中打开       |
| `e`      | 编辑 `adv.config.ts` |
| `Ctrl+C` | 退出                 |

### 示例

```bash
# 启动开发服务器
adv

# 指定端口
adv --port 8080

# 自动打开浏览器
adv -o

# 指定日志级别
adv --log info
```

## `adv build`

构建生产环境的 SPA（单页应用）。

```bash
adv build [entry] [options]
```

### 选项

| 选项           | 默认值  | 说明                                     |
| -------------- | ------- | ---------------------------------------- |
| `--outDir`     | `dist`  | 输出目录                                 |
| `--base`       | -       | 输出 base 路径                           |
| `--singlefile` | `false` | 构建为单文件，支持 `index.html` 直接打开 |
| `-t, --theme`  | -       | 覆盖主题                                 |

### 示例

```bash
# 默认构建
adv build

# 指定输出目录
adv build --outDir output

# 构建为单文件
adv build --singlefile

# 指定 base 路径（部署到子目录时）
adv build --base /my-game/
```

## `adv export`

将交互过程自动录制为视频。基于 [Playwright Video Recording](https://playwright.dev/docs/videos#record-video) 实现。

```bash
adv export
```

- 需要安装 `@playwright/test` 依赖
- 导出分辨率为 1920×1080
- 视频保存至 `dist/videos/` 目录
- 截图保存至 `dist/screenshots/` 目录
- 默认导出格式为 `WebM`

### 格式转换

使用 [FFmpeg](https://ffmpeg.org/) 将 `WebM` 转换为 `MP4`：

```bash
ffmpeg -i dist/videos/test.webm dist/videos/test.mp4
```

也可使用 [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) 在浏览器中进行转换。

::: warning TODO

- 命令行导出：Playwright recordVideo 质量较低
- 浏览器录制：考虑使用浏览器原生 MediaRecorder 替代 RecordRTC
  :::

## `adv config`

将游戏配置合并为单个 `.adv.json` 文件，便于分发或 CDN 部署。

```bash
adv config [options]
```

### 选项

| 选项           | 默认值   | 说明                     |
| -------------- | -------- | ------------------------ |
| `-m, --merge`  | `true`   | 合并配置到单个文件       |
| `-t, --target` | `public` | 目标目录                 |
| `-b, --base64` | `false`  | 将图片转换为 base64 内联 |

### 示例

```bash
# 合并配置到 public 目录
adv config

# 合并并将图片转为 base64
adv config --base64

# 指定输出目录
adv config --target dist
```

## `adv play`

互动叙事播放器。支持两种模式：

- **交互模式** — 在终端中直接操作
- **Agent 模式** — 通过 `--session-id` 和 `--json` 供 AI Agent 调用

```bash
adv play <script.adv.md> [options]
```

### 选项

| 选项           | 说明                                    |
| -------------- | --------------------------------------- |
| `--session-id` | 用于持久化的会话 ID                     |
| `--json`       | 以 JSON 格式输出（默认 `false`）        |
| `--trace`      | 向 stderr 输出 Runtime JSON Lines trace |

### 交互模式

直接运行即可进入交互式 REPL：

```bash
adv play story.adv.md
```

交互模式中的指令：

| 指令                  | 说明                      |
| --------------------- | ------------------------- |
| `Enter` / `next`      | 推进故事                  |
| `choose <n>` / `<n>`  | 选择选项（编号从 1 开始） |
| `activity <json>`     | 完成当前待处理活动        |
| `status`              | 查看会话状态              |
| `reset`               | 重置会话                  |
| `quit` / `q` / `exit` | 退出                      |

### 子命令

```bash
# 推进到下一个节点
adv play next --session-id <id> [--json]

# 做出选择（编号从 1 开始）
adv play choose <number> --session-id <id> [--json]

# 用 JSON 结果完成待处理活动
adv play activity '<json>' --session-id <id> [--json]

# 回退到之前访问过的节点（撤销最近的推进）
adv play back --session-id <id> [--steps N] [--json]

# 查看会话状态
adv play status --session-id <id> [--json]

# 列出所有活跃会话
adv play list [--json]

# 重置（删除）会话
adv play reset --session-id <id>
```

### 存档与读档

支持两种方式：

**单文件快照**（便于分享 / 备份）：

```bash
# 导出快照到 JSON 文件（省略 --output 时打印到 stdout）
adv play save --session-id <id> --output save-01.json

# 从 JSON 快照恢复，可指定新的 session-id
adv play load save-01.json --session-id <id> [--json]
```

**命名存档槽位**（v0.3，适合「重要选择前留底」）：

```bash
# 保存到命名槽位（带备注）
adv play save --session-id <id> --slot before-fork --note "进入抉择前"

# 列出该会话的所有槽位（含元数据）
adv play saves --session-id <id> [--json]

# 从命名槽位恢复
adv play load --session-id <id> --slot before-fork [--json]

# 删除槽位
adv play delete-save --session-id <id> --slot before-fork
```

槽位名规则：字母、数字、`-`、`_`，最长 40 字符。每个槽位附带元数据（`chapterTitle`、规范 `address`、`visitedCount`、`previewText`、`note` 和更新时间）。剧情执行状态完整保存在 `RuntimeSnapshot` 中。

### 回退 vs 存档

| 方式                        | 适用场景                          |
| --------------------------- | --------------------------------- |
| `adv play back`             | 栈式 undo，按时间线性回退最近几步 |
| `adv play save/load --slot` | 命名快照，可在任意书签点之间跳转  |

### 示例

```bash
# 交互模式
adv play my-story.adv.md

# Agent 模式 - 启动故事
adv play my-story.adv.md --session-id story-1 --json

# Agent 模式 - 推进
adv play next --session-id story-1 --json

# Agent 模式 - 选择
adv play choose 1 --session-id story-1 --json

# 保存/读档
adv play save --session-id story-1 --output save-01.json
adv play load save-01.json --session-id story-1-restored --json

# 列出会话
adv play list --json

# 清理会话
adv play reset --session-id story-1
```

### JSON 输出

Agent 模式下返回结构化 JSON，详见 [Skills - JSON 输出类型](/ai/skills/adv-story#json-输出类型)。

## `adv check`

验证完整 RuntimeProgram、插件能力、剧本语法、角色引用一致性和场景完整性。

```bash
adv check [options]
```

### 选项

| 选项     | 默认值  | 说明                                                       |
| -------- | ------- | ---------------------------------------------------------- |
| `--root` | -       | 游戏内容根目录（默认从 `adv.config.json` 或 `./adv` 读取） |
| `--fix`  | `false` | 为未解析的 `@角色` / `【场景】` 引用自动生成桩文件         |

`--fix` 只创建新文件、**永不覆盖**已有文件；语法错误等需要人工修复。

Runtime 检查会把所有章节一起编译和链接，报告重复稳定 ID、无效跳转、非法条件/action/activity、未知插件能力和缺失插件。诊断使用稳定错误码，并在可用时输出源码文件、行和列。

默认执行时还会读取 `gameConfig.chapters`，检查其中声明在 `public/` 或其他项目路径下的 fountain 源；配置文件缺失会报告 `ADV_RUNTIME_CHAPTER_NOT_FOUND`。只有未提供章节配置时，才退回扫描内容根目录。

### 示例

```bash
# 检查项目
adv check

# 指定内容根目录
adv check --root ./game/adv

# 自动补齐缺失的角色 / 场景桩
adv check --fix
```

## `adv context`

导出项目上下文（世界观、角色、大纲、场景）供 AI 使用。

```bash
adv context [options]
```

### 选项

| 选项        | 说明                                   |
| ----------- | -------------------------------------- |
| `--root`    | 游戏内容根目录                         |
| `--full`    | 包含所有文件完整内容（角色/章节/场景） |
| `--chapter` | 仅输出指定章节编号的上下文             |

### 示例

```bash
# 输出项目概览
adv context

# 输出完整内容
adv context --full

# 仅输出第 2 章上下文
adv context --chapter 2
```

## `adv debug`

剧本分支分析工具，纯静态解析 AST，无需运行播放。

```bash
adv debug <subcommand> <script.adv.md> [options]
```

### `adv debug branches`

生成剧本的分支图（选项 / `go` 跳转）。

```bash
adv debug branches <script.adv.md> [options]
```

| 选项           | 默认值    | 说明                                  |
| -------------- | --------- | ------------------------------------- |
| `--format`     | `mermaid` | 输出格式：`mermaid` / `json` / `text` |
| `-o, --output` | -         | 写入文件（省略时输出到 stdout）       |

```bash
# 默认输出 Mermaid 流程图
adv debug branches adv/chapters/01.adv.md

# 结构化 JSON（便于驱动遍历）
adv debug branches adv/chapters/01.adv.md --format=json

# 写入文件
adv debug branches adv/chapters/01.adv.md -o branches.mmd
```

`json` / `text` 形态会标注 `kind: "dead"` 的死路径（选择后无任何后续节点）。

### `adv debug coverage`

在分支图基础上做静态可达性分析，给出汇总覆盖率指标。**省略剧本路径时聚合整个项目的所有章节**。

```bash
adv debug coverage [script.adv.md] [options]
```

| 选项           | 默认值 | 说明                                                         |
| -------------- | ------ | ------------------------------------------------------------ |
| `--root`       | -      | 游戏内容根目录（项目模式；默认 `adv.config.json` / `./adv`） |
| `--format`     | `text` | 输出格式：`text` / `json`                                    |
| `-o, --output` | -      | 写入文件                                                     |

```bash
# 单章节
adv debug coverage adv/chapters/01.adv.md

# 整个项目（扫描 chapters/ 下所有 .adv.md，输出汇总表）
adv debug coverage

# 指定内容根目录
adv debug coverage --root ./game/adv --format=json
```

单章节文本输出示例：

```text
# Branch Coverage

Scenes reachable : 3/3 (100%)
Choice points    : 2
Options          : 4
Endings reachable: 2
Distinct paths   : 4
Dead options     : 0

✓ No orphan scenes or dead paths detected.
```

项目模式（无剧本参数）输出汇总表：

```text
# Project Branch Coverage

| Chapter                    | Scenes | Choices | Options | Paths | Dead | Orphan |
| -------------------------- | ------ | ------- | ------- | ----- | ---- | ------ |
| chapters/chapter_01.adv.md | 2/2    | 2       | 4       | 4     | 0    | 0      |
| chapters/chapter_02.adv.md | 1/1    | 1       | 2       | 2     | 0    | 0      |
| **Total**                  | 3/3    | 3       | 6       | 6     | 0    | 0      |

✓ 2 chapter(s) clean — no orphan scenes or dead paths.
```

指标含义：

- `distinctPaths` —— 从 START 到终点的无环路径数（环会被剪枝；超大分支超过 5000 上限时 `pathsTruncated: true`）
- `orphanScenes` —— 被卡在 `choices` 节点之后、无任何选项指向的孤立场景
- `deadOptions` —— 选择后无后续节点的死选项

## 国际化

CLI 支持中英文双语，通过以下方式设置语言：

1. `--lang` 参数：`adv --lang zh-CN`
2. `LANG` 环境变量
3. 默认为英文
