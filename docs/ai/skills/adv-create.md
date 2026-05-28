# adv-create

`adv-create` 是 ADV.JS 的项目创建 Skill，引导 AI Agent 从用户的概念描述出发，创建完整的视觉小说项目。

- v0.1：CLI 驱动，手写填充项目内容
- v0.3：改用 MCP 工具批量创建资产；场景写入时强制填 `imagePrompt`，打通 AI 图像生成链路

## 命令与工具

### CLI 命令

| 命令                           | 说明           |
| ------------------------------ | -------------- |
| `adv init [dir] --name <name>` | 初始化项目骨架 |
| `adv context --root <dir>/adv` | 查看项目上下文 |
| `adv check --root <dir>/adv`   | 验证项目完整性 |

### MCP 工具

| 工具                                                   | 说明                             |
| ------------------------------------------------------ | -------------------------------- |
| `create_character` / `create_characters`               | 创建角色（单条 / 批量原子）      |
| `edit_character`                                       | 修改角色字段（merge）            |
| `create_chapter` / `create_chapters`                   | 创建章节（单条 / 批量原子）      |
| `edit_chapter`                                         | 替换章节全文                     |
| `create_scene` / `create_scenes`（**含 imagePrompt**） | 创建场景（单条 / 批量原子）      |
| `edit_scene`                                           | 替换场景全文                     |
| `adv_validate`                                         | 项目完整性检查（同 `adv check`） |

「批量原子」语义：整批先校验（同批 id 不重复 + 目标文件不存在），通过后才写；任意冲突中止，**不写任何文件**。

## 工作流

```
1. Gather    → 收集用户的游戏想法（类型、基调、章节数、灵感来源）
2. Init      → adv init <dir> --name <name>
3. World     → 手写 world.md / outline.md / glossary.md（项目级散文，不适合 MCP 字段化）
4. Bulk      → create_characters / create_scenes 一次性提交所有角色与场景
5. Chapters  → create_chapters 提交章节骨架（frontmatter）；之后用 edit_chapter 填充剧本
6. Validate  → adv_validate（或 adv check）
7. Guide     → 提示用户 adv dev 预览
```

**为什么用批量工具**：bootstrap 阶段一次写 5-15 个角色 / 场景是常态。单条 N 次调用慢、易乱、出错没回滚；批量一次提交、整批原子，一目了然。

## imagePrompt 撰写指南

`AdvScene.imagePrompt` 是给 AI 画图的提示词，与 `description`（给读者看的散文）正交。**创建场景时永远填这个字段**，未来 `adv-art` 等工具可直接复用。

### 公式

```
[风格] + [主体] + [氛围 / 光照] + [质感关键词]
```

### 例子

| 场景中文       | imagePrompt（英文推荐）                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 雨天放学的天台 | `Anime style school rooftop in light rain, gray overcast sky, wet concrete reflections, lonely figure with umbrella, melancholic, watercolor aesthetic` |
| 深夜便利店     | `Cinematic late-night convenience store interior, fluorescent lighting, glass reflections of empty street, isolation, anime style`                      |
| 神社夏祭       | `Traditional Japanese summer festival at shrine, paper lanterns, warm orange glow, crowd in yukata, fireworks in night sky, anime watercolor`           |

### 反例（避免）

- ❌ `一个学校` — 太短、无风格关键词，AI 画出来千篇一律
- ❌ 中文长段落散文 — 与 `description` 重复，不利于 AI 图模型
- ❌ 包含动作 / 剧情 — imagePrompt 描述**舞台**，不描述**剧情**

## 使用场景

### 从零创建项目

```
用户：我想做一个校园恋爱 AVG，类似 CLANNAD，大概 3 章

AI（使用 adv-create skill）：
  1. 执行 adv init my-game --name "我的游戏"
  2. 写 adv/world.md / outline.md / glossary.md
  3. 调用 create_characters 一次提交全部角色
  4. 调用 create_scenes 一次提交全部场景（每条都带 imagePrompt）
  5. 调用 create_chapters 提交章节骨架，再用 edit_chapter 灌入剧本
  6. 调用 adv_validate 验证
  7. 提示 adv dev 预览
```

### MCP 调用示例

```js
// 批量创建场景（关键：每个场景都填 imagePrompt）
create_scenes({
  items: [
    {
      id: 'classroom',
      name: '教室',
      tags: ['内景', '学校'],
      imagePrompt: 'Anime style empty Japanese classroom, afternoon sunlight through windows, chalk dust in the air, watercolor aesthetic',
      description: '二年级三班的教室。窗外能看到樱花树。',
      atmosphere: '下午阳光透过窗户，黑板擦灰飞舞。',
      chapters: ['CH01 转学第一天']
    },
    {
      id: 'shrine',
      name: '神社',
      tags: ['户外', '夜晚'],
      imagePrompt: 'Traditional Japanese shrine at night, stone lanterns, gentle moonlight, cherry blossoms, cinematic anime',
      description: '山顶的小神社，主角们经常来许愿。',
      chapters: ['CH02 雨夜的告白', 'CH03 终章']
    }
  ]
})
```

### 项目创建后

可以配合其他 Skills 继续工作：

- **adv-story** — 播放测试刚创建的剧本
- **adv-debug** — `adv debug branches` 检查分支覆盖；`adv check --fix` 自动补未引用的角色 / 场景桩

## 参考

- [Skill 定义文件 - GitHub](https://github.com/YunYouJun/advjs/blob/main/skills/adv-create/SKILL.md)
- [示例会话 - GitHub](https://github.com/YunYouJun/advjs/tree/main/skills/adv-create/examples)
- [ADV.JS 项目结构](/guide/project-structure)
- `AdvScene.imagePrompt` 类型定义：`packages/types/src/game/scene.ts`
