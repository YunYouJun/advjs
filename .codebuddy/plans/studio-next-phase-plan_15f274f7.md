---
name: studio-next-phase-plan
overview: 制定 ADV.JS Studio 下一阶段开发计划（Phase M13-M16），聚焦四条主线：角色情感弧光可视化、混元图片生成集成、Capacitor 原生打包准备、文档完善与路线图更新。同步完善 docs/guide/studio.md 文档，补充已完成的 M12 工作记录并规划后续 roadmap。
todos:
  - id: update-m12-complete
    content: 将 Phase M12 从"部分完成"更新为已完成状态，补充 E2E 测试等完整技术实现记录
    status: completed
  - id: plan-m13-m14
    content: 新增 Phase M13（情感弧光+批量导入）和 Phase M14（MCP 扩展+导出增强）计划章节
    status: completed
    dependencies:
      - update-m12-complete
  - id: update-roadmap-status
    content: 更新"其他计划"列表和"已知待优化项"的完成状态标记，调整路线 tip 提示内容
    status: completed
    dependencies:
      - plan-m13-m14
  - id: validate-doc
    content: 使用 [mcp:advjs] adv_validate 验证项目结构，确保文档描述与代码实际一致
    status: completed
    dependencies:
      - update-roadmap-status
---

## 用户需求

制定 ADV.JS Studio 下个阶段的开发计划，并完善 `docs/guide/studio.md` 文档。

## 产品概述

ADV.JS Studio 已完成 Phase 1-27 + M1-M12 + L1-L3 全部工作（57 个组件、31 个页面、12 个 Store、115 个单元测试），代码中仅剩 1 处 TODO（Hunyuan 图片生成）。需要基于 M12 已完成的群聊分支树、项目模板库、E2E 测试等工作，梳理下一阶段路线，并将路线计划完整写入文档。

## 核心内容

1. **Phase M12 完成收尾** -- 将 Phase M12 从"部分完成"更新为"已完成"，标记群聊分支树、项目模板库、E2E 测试的完成状态；更新路线图中的进展 tip

2. **制定 Phase M13 计划** -- 角色情感弧光可视化（基于已有的 `EmotionalState` affinity/trust/mood 数据和日记 mood 字段，新增历史趋势折线图组件）+ 批量角色导入（CSV/JSON 解析 → `.character.md` 批量生成）

3. **制定 Phase M14 计划** -- MCP Server 功能扩展（当前 `@advjs/mcp-server` 已有 `adv_validate` 工具 + 8 个 Resources + 3 个 Prompts，需扩展更多工具如角色/章节 CRUD、项目统计等）+ 对话导出增强（EPUB/PDF 格式）

4. **更新路线图与已知待优化项** -- 同步所有已完成工作的标记状态，重新组织后续路线的优先级描述，清理已解决的待优化项

5. **文档结构优化** -- 确保 Phase M12 已完成部分的技术实现记录完整，后续计划描述清晰、可执行

## 技术栈

- 文档: VitePress Markdown (`docs/guide/studio.md`)
- 参考数据来源: 现有代码库中的 Store/Component/Utils 实现细节

## 实现方案

本任务的核心是**文档编写**，不涉及代码实现。需要：

1. **重构 Phase M12 区块**：将当前 `Phase M12（部分完成）` 标题改为 `Phase M12：群聊分支树 + 项目模板库 + E2E 测试 ✅`，保留现有技术实现记录，删除"部分完成"标记
2. **重组后续计划区块**：将当前 `Phase M12：后续计划` 重写为 `Phase M13` 和 `Phase M14` 两个明确的阶段计划，按优先级排列待实现功能
3. **更新路线提示**：更新进展说明 tip 内容，反映最新状态
4. **同步"其他计划"和"已知待优化项"**：标记新完成项，调整未完成项的 Phase 归属

**关键技术决策**：

- Phase M13 聚焦**角色情感弧光可视化**和**批量角色导入**，因为这两项直接增强创作体验，且有成熟的数据层基础（`EmotionalState` + `CharacterDiaryStore.mood`）
- Phase M14 聚焦**MCP Server 扩展**和**对话导出增强**，因为 MCP Server 已有完整的基础架构（Resources/Tools/Prompts），扩展成本低且生态价值高
- Capacitor 原生打包和混元图片生成保留为独立里程碑，因为前者需要 iOS/Android 环境配置，后者依赖服务端 SDK，均为跨系统工作

## 实现备注

- 文档修改范围集中在第 1206-1251 行（Phase M12 区块）和第 1306-1333 行（其他计划列表）
- 需确保所有 `{#phase-xxx}` 锚点 ID 不冲突，新增 `{#phase-m13}` 和 `{#phase-m14}`
- 保持文档风格一致：每个 Phase 包含功能概述、实现内容列表、技术实现细节（已完成的 Phase）或规划要点（计划中的 Phase）
- Mermaid 图等无需新增，文本描述即可

## 架构设计

无代码架构变更，仅文档结构调整。

## 目录结构

```
docs/guide/
└── studio.md  # [MODIFY] 完善 Phase M12 完成记录，新增 Phase M13/M14 计划，更新路线图和待优化项
```

## Agent Extensions

### MCP

- **advjs**
- 用途: 完成文档编写后，使用 `adv_validate` 验证当前项目结构完整性，确保文档中描述的功能与代码实际状态一致
- 预期结果: 确认项目通过校验，文档中引用的文件路径和功能描述与实际代码匹配

### SubAgent

- **code-explorer**
- 用途: 在编写文档时如需验证特定代码细节（如 Store 接口、组件 Props、数据结构），使用 code-explorer 精确查找
- 预期结果: 获取准确的代码结构信息，确保文档技术描述的准确性
