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

| 命令              | 说明                           |
| ----------------- | ------------------------------ |
| `adv` / `adv dev` | 启动本地开发服务器（默认命令） |
| `adv build`       | 构建可托管的 SPA               |
| `adv export`      | 导出为视频                     |
| `adv config`      | 合并配置到单个 JSON 文件       |
| `adv play`        | 互动叙事播放                   |

全局选项：

| 选项            | 说明                       |
| --------------- | -------------------------- |
| `-t, --theme`   | 覆盖主题                   |
| `--lang`        | 语言（支持 `en`、`zh-CN`） |
| `-v, --version` | 显示版本号                 |
| `-h, --help`    | 显示帮助信息               |

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

| 选项           | 说明                             |
| -------------- | -------------------------------- |
| `--session-id` | 用于持久化的会话 ID              |
| `--json`       | 以 JSON 格式输出（默认 `false`） |

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
| `status`              | 查看会话状态              |
| `reset`               | 重置会话                  |
| `quit` / `q` / `exit` | 退出                      |

### 子命令

```bash
# 推进到下一个节点
adv play next --session-id <id> [--json]

# 做出选择（编号从 1 开始）
adv play choose <number> --session-id <id> [--json]

# 查看会话状态
adv play status --session-id <id> [--json]

# 列出所有活跃会话
adv play list [--json]

# 重置（删除）会话
adv play reset --session-id <id>
```

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

# 列出会话
adv play list --json

# 清理会话
adv play reset --session-id story-1
```

### JSON 输出

Agent 模式下返回结构化 JSON，详见 [Skills - JSON 输出类型](/ai/skills/adv-story#json-输出类型)。

## 国际化

CLI 支持中英文双语，通过以下方式设置语言：

1. `--lang` 参数：`adv --lang zh-CN`
2. `LANG` 环境变量
3. 默认为英文
