# 路线图

ADV.JS Skills 体系的发展方向。

## 当前版本 (v0.3)

### Skills

- ✅ `adv-story` v0.3 — 互动叙事播放 + 命名存档槽位 + 立绘/BGM 富语义 + 回退（undo）
- ✅ `adv-create` v0.3 — MCP 驱动的项目创建 + 强制 imagePrompt + 原子批量
- ✅ `adv-debug` v0.3 — 分支图（Mermaid/JSON/Text）+ 自动补桩

### CLI

- ✅ `adv init` — 项目初始化
- ✅ `adv play` 命令组 — JSON 输出 + 会话持久化 + 命名存档槽位 + 回退
- ✅ `adv check [--fix]` — 语法/角色/场景验证 + 自动桩生成
- ✅ `adv context` — AI 上下文导出
- ✅ `adv debug branches` — AST 分支图导出
- ✅ `adv debug coverage` — 分支覆盖率报告（可达场景 / 路径数 / 孤立场景 / 死路径）

### MCP Server

- ✅ Resources：`adv://project/overview`、`adv://characters/*`、`adv://chapters/*`、`adv://scenes`
- ✅ 创建工具：`create_character / create_chapter / create_scene`（单条）
- ✅ 批量原子工具：`create_characters / create_chapters / create_scenes`
- ✅ 编辑工具：`edit_character / edit_chapter / edit_scene`
- ✅ `adv_validate`、`project_stats`、`search_content`、`list_files`

## 已完成版本

### v0.2

- adv-story 加入上下文感知 + 多章节导航 + 角色一致性

### v0.1

- 三个 skill 雏形 + 基础 CLI（init/play/check/context）+ MCP 雏形

## 近期计划 (v0.4)

### 推迟自 v0.3 的两项

- [ ] adv-create 交互式模板选择（多类型模板）—— 需先解决「模板腐烂」问题：用单模板 + AI 填充 vs 维护多套
- [ ] adv-debug 对话质量评分 —— 需先设计 LLM rubric + 评分 schema + 误报抑制

### 待规划

- [ ] 自动存档触发器（章节切换/选择前自动 quicksave）—— 现已有槽位存储，缺触发策略
- [ ] character `imagePrompt` 字段 —— 当前只有 scene 有 imagePrompt；扩展到角色立绘
- [ ] MCP `adv://branches/{chapter}` / `adv://coverage/{chapter}` resource —— 把分支图 / 覆盖率做成 MCP resource

## 长期目标

### Agent 生态

- [ ] 多 Agent 协作叙事（多角色扮演）
- [ ] 实时观众互动（投票选择分支）

### 创作工具

- [ ] `adv-art` — AI 辅助资源生成（消费现有 scene.imagePrompt）
- [ ] `adv-audio` — 音效/BGM 智能推荐（消费现有 bgmHint）
- [ ] `adv-review` — AI 剧本质量审查

### 平台支持

- [ ] Web Widget 嵌入
- [ ] Discord Bot 集成
- [ ] 微信小程序集成
