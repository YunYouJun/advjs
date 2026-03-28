# adv-create 示例会话

以下是一个完整的项目创建会话示例。

---

**用户**：我想做一个校园恋爱 AVG，背景是一个靠海的小城市。主角是一个转学生，班上有一个外表开朗但其实有秘密的班长。整体风格偏治愈系，类似 CLANNAD。大概 3 章的短篇。

**AI**：好的！让我来帮你创建这个项目。

根据你的描述，我整理了以下设定：

- **类型**：校园恋爱
- **基调**：治愈系，略带忧伤
- **灵感**：CLANNAD
- **章节数**：3 章短篇
- **主角**：转学生（男主）
- **女主**：外表开朗但有秘密的班长

开始创建项目：

```bash
adv init star-memory --name "星之记忆"
```

项目骨架已创建。现在让我来填充内容……

（AI 依次编辑 world.md、characters/、outline.md、scenes/、chapters/chapter_01.adv.md）

---

**AI**：项目创建完成！结构如下：

```
star-memory/
├── adv.config.json
├── adv/
│   ├── world.md          — 星见市世界观设定
│   ├── outline.md        — 3 章故事大纲
│   ├── glossary.md       — 术语表（星之记忆等）
│   ├── chapters/
│   │   ├── README.md     — 章节进度总览
│   │   └── chapter_01.adv.md — 第一章「转学第一天」
│   ├── characters/
│   │   ├── README.md     — 角色关系总览
│   │   ├── kai.character.md  — 主角·凯
│   │   └── aria.character.md — 女主·艾莉亚
│   └── scenes/
│       ├── README.md     — 场景清单
│       └── school-rooftop.md — 学校天台
```

验证结果：

```bash
adv check --root star-memory/adv
# ✓ Script syntax (1 file, 0 errors)
# ✓ Character references (all valid)
# ✓ Scene references (all valid)
# ✓ All checks passed!
```

你可以运行 `adv dev` 预览第一章，或者告诉我接下来要调整的内容！
