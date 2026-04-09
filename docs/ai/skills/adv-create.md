# adv-create

`adv-create` 是 ADV.JS 的项目创建 Skill，引导 AI Agent 从用户的概念描述出发，创建完整的视觉小说项目。

## 命令列表

| 命令                           | 说明                 |
| ------------------------------ | -------------------- |
| `adv init [dir] --name <name>` | 初始化项目骨架       |
| `adv context --root <dir>/adv` | 查看生成的项目上下文 |
| `adv check --root <dir>/adv`   | 验证项目完整性       |

## 工作流

```
1. Gather    → 收集用户的游戏想法（类型、基调、章节数、灵感来源）
2. Init      → adv init <dir> --name <name>
3. Customize → 填充 world.md、characters/、outline.md、scenes/
4. Write     → 生成第一章剧本 chapter_01.adv.md
5. Validate  → adv check 验证项目完整性
6. Guide     → 提示用户 adv dev 预览
```

## 使用场景

### 从零创建项目

```
用户：我想做一个校园恋爱 AVG，类似 CLANNAD，大概 3 章

AI：（使用 adv-create skill）
    1. 执行 adv init my-game --name "我的游戏"
    2. 根据用户描述填充 world.md、characters/、outline.md
    3. 生成第一章剧本
    4. 执行 adv check 验证
    5. 提示 adv dev 预览
```

### 项目创建后

创建完成后，可以配合其他 Skills 继续工作：

- **adv-story** — 播放测试刚创建的剧本
- **adv-debug** — 检查分支覆盖和一致性

## 参考

- [Skill 定义文件 - GitHub](https://github.com/YunYouJun/advjs/blob/main/skills/adv-create/SKILL.md)
- [示例会话 - GitHub](https://github.com/YunYouJun/advjs/tree/main/skills/adv-create/examples)
- [ADV.JS 项目结构](/guide/project-structure)
