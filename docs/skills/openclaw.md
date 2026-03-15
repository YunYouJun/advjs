# OpenClaw 集成

本指南介绍如何将 ADV.JS Skills 集成到 OpenClaw AI Agent 系统中。

## 概述

OpenClaw 是一个 AI Agent 运行时，通过读取 Skill 定义文件来理解可用的工具和工作流。ADV.JS 提供了 `adv-story` Skill，使 Agent 能够：

- 加载和播放 `.adv.md` 剧本
- 推进故事对话
- 处理分支选择
- 管理多个播放会话

## 集成步骤

### 1. 安装 ADV.JS CLI

```bash
pnpm add -g advjs
```

### 2. 注册 Skill

将 `skills/adv-story/SKILL.md` 文件路径注册到 OpenClaw 的 Skill 配置中。

### 3. 验证

运行测试命令确认 CLI 可用：

```bash
adv play skills/adv-story/examples/demo.adv.md --json
```

## 数据流

```
用户消息 → OpenClaw Gateway → Agent Runtime
                                    ↓
                            读取 SKILL.md 指令
                                    ↓
                        执行 adv play ... --json
                                    ↓
                            解析 JSON 输出
                                    ↓
                        格式化为自然语言回复
                                    ↓
                            回复用户
```

## JSON 输出格式

所有 `adv play` 命令支持 `--json` 参数，输出结构化数据便于 Agent 解析：

```json
{
  "type": "dialog",
  "character": "云游君",
  "status": "smile",
  "text": "欢迎来到 ADV.JS 的世界！"
}
```

支持的输出类型：`dialog`、`narration`、`choices`、`scene`、`text`、`end`

## 会话管理

每次 `adv play` 调用通过 `--session-id` 参数绑定会话：

- 会话持久化在 `~/.advjs/play-sessions/` 目录
- 同一 `session-id` 可跨多次命令调用
- 使用 `adv play reset --session-id <id>` 清理会话

## 最佳实践

1. **为每个用户会话生成唯一的 session-id**（如 UUID）
2. **始终使用 `--json` 参数**，确保输出可被程序解析
3. **在 choices 节点及时提示用户选择**，避免调用 `next` 时卡住
4. **处理 `type: "end"` 输出**，及时通知用户故事结束
