# 路线图

ADV.JS Skills 体系的发展方向。

## 当前版本 (v0.2)

- ✅ `adv-story` v0.2 — 互动叙事播放（上下文感知 + 多章节导航 + 角色一致性）
- ✅ `adv-create` v0.1 — 从概念描述创建完整项目
- ✅ `adv-debug` v0.1 — 分支覆盖分析和一致性检查
- ✅ CLI `adv init` 命令 — 项目初始化
- ✅ CLI `adv play` 命令组 — JSON 输出 + 会话持久化
- ✅ CLI `adv check` 命令 — 语法/角色/场景验证
- ✅ CLI `adv context` 命令 — AI 上下文导出
- ✅ MCP Server — 标准化 AI 交互接口

## 已完成版本 (v0.1)

- ✅ `adv-story` v0.1 — 基础互动叙事播放
- ✅ CLI `adv play` 命令组
- ✅ JSON 输出格式支持
- ✅ 会话持久化

## 近期计划 (v0.3)

### 增强 adv-story

- [x] 存档/读档功能（命名槽位 + 元数据，`adv play save/load/saves/delete-save --slot`）
- [x] 角色立绘状态富语义描述（`stage.tachieRich`，含 `appearance`）
- [x] 背景音乐情绪提示（`stage.bgmHint`）

### 增强 adv-create

- [x] 自动生成 imagePrompt（MCP `create_scene` / `create_scenes` 含 `imagePrompt` 字段，由 AI Agent 直接填写）
- [x] 批量场景/角色创建（MCP `create_characters` / `create_chapters` / `create_scenes` 原子批量工具）
- [ ] ~~交互式模板选择~~ → 推迟到 v0.4，权衡：多模板维护成本 vs 单模板 + AI 填充

### 增强 adv-debug

- [x] 自动修复简单问题（`adv check --fix`，自动生成角色/场景桩）
- [x] 分支路径可视化（`adv debug branches`，支持 Mermaid / JSON / Text）
- [ ] ~~对话质量评分~~ → 推迟到 v0.4，需先做评分 schema 与 LLM 集成设计

## v0.3.x 完成总结

- adv-story：命名存档槽位、立绘 / BGM 富语义
- adv-debug：`adv debug branches`（Mermaid / JSON / Text）、`adv check --fix` 自动补桩
- adv-create：MCP `create_scene` / `edit_scene` + 三个域的原子批量工具，场景写入强制 imagePrompt

剩余 2 项（交互式模板 / 对话质量评分）推迟到 v0.4。

## 长期目标

### Agent 生态

- [ ] 多 Agent 协作叙事（多角色扮演）
- [ ] 实时观众互动（投票选择分支）

### 创作工具

- [ ] `adv-art` — AI 辅助资源生成（场景背景、角色立绘）
- [ ] `adv-audio` — 音效/BGM 智能推荐
- [ ] `adv-review` — AI 剧本质量审查

### 平台支持

- [ ] Web Widget 嵌入
- [ ] Discord Bot 集成
- [ ] 微信小程序集成
