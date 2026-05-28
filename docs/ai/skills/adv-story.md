# adv-story

`adv-story` 是 ADV.JS 的核心 Skill，允许 AI Agent 通过 CLI 命令驱动互动叙事。

- v0.2：上下文感知、多章节导航、角色一致性。
- v0.3：命名存档槽位、立绘 / BGM 富语义描述。

## 命令列表

| 命令                                                           | 说明                     |
| -------------------------------------------------------------- | ------------------------ |
| `adv context [--chapter <n>]`                                  | 加载项目上下文           |
| `adv play <script> --session-id <id> --json`                   | 加载剧本并启动播放       |
| `adv play next --session-id <id> --json`                       | 推进到下一个节点         |
| `adv play choose <n> --session-id <id> --json`                 | 在选项中做出选择         |
| `adv play back --session-id <id> [--steps N] --json`           | 回退到之前访问过的节点   |
| `adv play status --session-id <id> --json`                     | 查看当前会话状态         |
| `adv play save --session-id <id> --slot <name> [--note "..."]` | 保存命名存档（含元数据） |
| `adv play load --session-id <id> --slot <name> --json`         | 从命名存档恢复           |
| `adv play saves --session-id <id> --json`                      | 列出该会话的所有存档槽位 |
| `adv play delete-save --session-id <id> --slot <name>`         | 删除命名存档             |
| `adv play list --json`                                         | 列出所有活跃会话         |
| `adv play reset --session-id <id>`                             | 重置（删除）会话         |

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

**舞台状态 `stage`（v0.3）**

每个输出节点都附带 `stage`，描述当前的视觉/听觉舞台：

```json
{
  "type": "dialog",
  "character": "艾莉亚",
  "text": "...",
  "stage": {
    "background": "/img/school.png",
    "bgm": "calm-afternoon",
    "bgmHint": "calm",
    "tachieAscii": ["[艾莉亚:smile]"],
    "tachieRich": [
      { "name": "艾莉亚", "status": "smile", "appearance": "短发少女，校服外套白色围巾。" }
    ]
  }
}
```

- `tachieAscii` 始终存在，便于纯文本环境引用。
- `tachieRich`、`bgmHint` 仅在能从游戏目录读到 `.character.md` / 识别出 BGM 关键词时出现。

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
- **stage.tachieRich** — 引用 `appearance` 字段调整人物视觉描写
- **stage.bgmHint** — `calm / tense / sad / joyful / mysterious / epic / romantic` 等情绪标签，可调整叙述语气

## 回退（undo）

`adv play back` 用于「撤销最近一次推进」—— 比 `save/load --slot` 更轻量的反悔操作。

```bash
# 回退 1 步
adv play back --session-id story1 --json

# 回退 3 步
adv play back --session-id story1 --steps 3 --json
```

返回 JSON 含 `requestedSteps` 与 `poppedSteps` —— 后者是实际回退步数（历史不够时静默截断）。回退后 `status` 强制回到 `playing`，即使会话已 `ended` 或 `waiting_choice` 也能继续推进。

适用场景：

- 玩家「想再听一遍刚才那段台词」
- AI Agent 检测到误推进，自我纠正
- 调试时回退几步对比效果

与存档槽位的区别：

- `back` 是栈式 undo，按时间线性回退
- `save/load --slot` 是命名快照，可任意跳转

## 存档与读档（v0.3）

命名存档槽位适用于「重要选择前留底」「让玩家对比 BAD/GOOD END」等场景：

```bash
# 在关键选择前保存
adv play save --session-id story1 --slot before-fork --note "进入抉择前的存档"

# 列出所有存档
adv play saves --session-id story1 --json

# 想回到之前的状态
adv play load --session-id story1 --slot before-fork --json

# 用过的存档不再需要
adv play delete-save --session-id story1 --slot before-fork
```

存档元数据包含：`slot`、`createdAt`、`scriptPath`、`chapterTitle`、`currentIndex / totalNodes`、`previewText`、`note`。

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
