# adv-story

`adv-story` 是 ADV.JS 的核心 Skill，允许 AI Agent 通过 CLI 命令驱动互动叙事。

v0.2 新增：上下文感知、多章节导航、角色一致性。

## 命令列表

| 命令                                           | 说明               |
| ---------------------------------------------- | ------------------ |
| `adv context [--chapter <n>]`                  | 加载项目上下文     |
| `adv play <script> --session-id <id> --json`   | 加载剧本并启动播放 |
| `adv play next --session-id <id> --json`       | 推进到下一个节点   |
| `adv play choose <n> --session-id <id> --json` | 在选项中做出选择   |
| `adv play status --session-id <id> --json`     | 查看当前会话状态   |
| `adv play list --json`                         | 列出所有活跃会话   |
| `adv play reset --session-id <id>`             | 重置（删除）会话   |

## JSON 输出类型

所有带 `--json` 的命令返回结构化 JSON，包含以下类型：

**对话 `dialog`**

```json
{
  "type": "dialog",
  "character": "艾莉亚",
  "status": "smile",
  "text": "欢迎来到我们班！"
}
```

**旁白 `narration`**

```json
{
  "type": "narration",
  "text": "春风拂过校园，樱花花瓣在阳光中缓缓飘落。"
}
```

**选择 `choices`**

```json
{
  "type": "choices",
  "text": "请选择:\n  1. 好的，麻烦你了\n  2. 不用了，我自己逛逛就好",
  "options": [
    { "index": 1, "label": "好的，麻烦你了" },
    { "index": 2, "label": "不用了，我自己逛逛就好" }
  ]
}
```

**场景 `scene`**

```json
{
  "type": "scene",
  "text": "[场景] 学校天台 - 午后",
  "place": "学校天台",
  "time": "午后"
}
```

**结束 `end`**

```json
{
  "type": "end",
  "text": "— END —"
}
```

## 工作流

```
1. Context → adv context 了解项目世界观和角色
2. Start   → adv play <script> --session-id <id> --json
3. Loop    → adv play next / choose --session-id <id> --json
4. Present → 将 JSON 输出格式化为自然语言
5. Next    → 章节结束时，自动加载下一章
6. End     → 收到 type: "end" 时故事结束
```

## v0.2 新功能

### 上下文感知

播放前先执行 `adv context` 了解项目全貌，包括：

- 世界观设定（`world.md`）
- 角色描述（`characters/*.character.md`）
- 故事大纲（`outline.md`）
- 场景信息（`scenes/*.md`）

### 多章节导航

章节结束后自动引导用户进入下一章：

1. 检查 `outline.md` 中的章节列表
2. 询问用户是否继续
3. 加载下一章的 `.adv.md` 文件

### 角色一致性

参照 `adv context` 输出的角色信息：

- 对话呈现匹配角色性格
- 情绪状态影响叙述语调
- 不同章节间保持角色特征一致

## 呈现指南

- **dialog** — 以角色口吻呈现，包含角色名与情绪状态
- **narration** — 作为氛围描写呈现，使用斜体或引号
- **choices** — 清晰展示所有选项并请求用户选择
- **scene** — 结合 `scenes/*.md` 描述场景转换

## 剧本格式

ADV.JS 使用 `.adv.md` 格式编写剧本，基于 Markdown 扩展语法：

```markdown
---
plotSummary: 章节概要
---

【学校，白天，内景】

（旁白描述。）

> 内心独白。

@角色名(表情)
这是一句对话。

- 选项一
- 选项二
```

详细语法请参考 [AdvScript 语法指南](/guide/advscript/syntax)。
