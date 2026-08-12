# 快速开始

这条路径从空目录开始，最终得到可公开访问的 Cloudflare Pages 游戏 URL。需要 Node.js 22 或 24；首发浏览器为 Chromium Stable。

## 安装与初始化

安装同一版本的 CLI 与 MCP Server：

```bash
npm install --global advjs@0.1.2 @advjs/mcp-server@0.1.2
```

以下命令块也是 launch 文档测试的事实源。

<!-- launch-journey:local:start -->

```bash
adv init rain-letter --template default --name 雨夜来信 --json
cd rain-letter
adv agent install --client codex --skills default --mcp --json
adv doctor . --client codex --json
adv check --json
adv build --json
```

<!-- launch-journey:local:end -->

`agent install` 支持 `codex`、`claude-code` 和 `cursor`，会原子合并配置并保留已有字段。`doctor` 会实际启动 MCP、完成握手并读取项目资源。

## 让 Agent 生成内容

在已安装的 Agent 中发出一句明确请求，例如：

> 使用 adv-create，在当前目录创建一个名为《雨夜来信》的最小游戏：一名角色、一个房间场景、一个章节和一次二选一；完成后运行 adv_validate。

Agent 写入的仍是标准 Markdown 项目。完成后再次运行 `adv check --json`；命令输出遵循仓库冻结的 [CLI Output v1 Schema](https://github.com/YunYouJun/advjs/blob/dev/tests/launch/contracts/cli-output.schema.json)，文档不维护第二份手写 JSON 示例。

## 用本地 Editor 精修

```bash
adv editor .
```

Editor 只监听 `127.0.0.1`，打开当前项目文件并直接使用源码试玩。Agent 在外部修改文件时，Editor 会刷新；如果本地还有未保存编辑，则先提示冲突，不静默覆盖。

保存并试玩后按 `Ctrl+C` 停止 Editor，再执行 `adv check --json` 和 `adv build --json`。本地 Editor 首发支持 Chromium Stable；Ubuntu 是完整支持环境，macOS 和 Windows 为 smoke 支持。

## 部署并分享

```bash
adv deploy --provider cloudflare-pages --project rain-letter --json
```

首次部署通过 `advjs` 内置的固定版本 Wrangler 完成 Cloudflare 授权并创建独立的 Direct Upload 项目；它不会占用 ADV.JS 官方 Editor 的 Git-integrated Pages 项目。普通部署总是重新 check 和 build，成功后验证入口 HTML、引用的 JS/CSS、MIME 与 SPA fallback。

项目目录会产生被 Git 忽略的 `.advjs/`：

- `deploy.json`：不含凭据的 provider/project 绑定；
- `releases/`：不可变 archive 与 artifact receipt；
- `deployments/`：每次上传各自的 deployment receipt。

需要恢复旧产物时，把 archive 与对应 `.release.json` 复制到空目录：

```bash
adv deploy --artifact ./release.tar.gz --receipt ./release.json --json
```

恢复模式会验证 archive、manifest 和逐文件 hash，并跳过重新构建。

## Studio 与首发限制

Studio 是移动端/Web 端的账号型 AI SaaS，可提供公共 AI 积分与轻量创作入口。它与 Editor 共用项目格式，但账号计费、云同步、移动端完整 AI 流程、Firefox 和 Safari 不属于上述本地首发闭环。
