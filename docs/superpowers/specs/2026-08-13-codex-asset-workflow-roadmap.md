# Codex 资产工作流与云端 Agent 路线图

状态：Phase 1-A 已实施；其余阶段已记录、未授权实施

日期：2026-08-13

适用范围：`@advjs/assets`、`advjs` CLI、`@advjs/mcp-server`、`adv-art`、Editor、Studio、CloudBase、COS

## 1. 已确认的产品边界

- Editor 面向本地专业创作，优先复用 Codex、Skills 与 MCP，不内嵌聊天框、AG-UI 或远程 Agent。
- Studio 面向未来 SaaS 与移动创作，届时通过云端自定义 Agent 提供受控生成与审核体验。
- 两端共享资产任务、候选、审核、清单和回执协议；只替换执行适配器与界面，不复制领域逻辑。
- 二进制图片、音频、视频和模型适合存储在 COS；Git 保存稳定清单、场景绑定、生成回执和其他可审阅文本。
- 私有创作对象与公开发行对象必须使用不同 namespace、权限、缓存和生命周期策略。

## 2. Phase 1-A：本地 Codex 闭环（已实施）

### 2.1 共享领域包

新增 `@advjs/assets`，只依赖 `@advjs/types`，包含：

- 原有 Asset Catalog 规范化、查询与 Profile 解析；
- 平台无关的生成任务、候选和审核状态机；
- 内联/分片 `adv/assets.json` 的纯变更规划器；
- Core 兼容导出，避免现有调用方迁移期间引用分裂。

它不包含 Vue、Pixi、Node 文件系统、CloudBase、COS、Provider SDK、缓存或全局单例。

### 2.2 本地状态流

```text
scene.imagePrompt
  → planned task
  → generated candidate (.adv/generated, ignored)
  → human review
  → rejected / explicitly accepted
  → registered hashed asset + catalog + scene assetId + receipt
```

生成成功不等于接纳。接纳要求显式确认；覆盖既有稳定 ID 还需要第二次独立授权。写入采用路径约束、媒体签名/尺寸/哈希校验、任务所有权、乐观并发检查与失败回滚。

### 2.3 Codex 和 Editor

- `adv-art` 以 Codex 内置生图作为首选执行器，但协议不依赖该 Provider；
- 内置结果从 `$CODEX_HOME/generated_images` 复制到项目任务候选目录，原件不移动、不删除；
- CLI 提供 `adv assets plan|ingest|reject|accept`；MCP 提供对应 `adv_asset_*` 工具；
- Editor 仅提供 Codex/Skills/MCP 就绪检查、修复命令复制、按场景复制标准任务文本、项目刷新；
- Editor 复用既有外部文件监听和冲突处理，并通过受鉴权桥接把已接纳本地资源解析为预览 Blob URL。

## 3. 现有云端能力审计（复用，不重建）

Studio 的 CloudBase `advjsAssets` 已具备以下基础：

- CloudBase 身份获取和 owner/project 路径隔离；
- `private/accounts/{ownerId}/projects/{projectId}/...` 私有对象键；
- 上传 grant、staging、哈希/字节/MIME 校验和提交事务；
- 配额预留/释放、同路径上传锁与幂等提交；
- `referenceCount` 和 `published` 删除保护；
- 私有源对象清理、健康检查和数据库安全规则。

因此后续不新建第二套“authoring COS 服务”。优先把这套服务适配到 `@advjs/assets` 的任务、候选、回执和稳定 `assetId` 契约。

## 4. Phase 1-B：共享执行适配器（待实施）

目标是让 Editor 本地 Codex 与 Studio 云端执行复用同一用例服务，而不是共享 UI。

- 定义 `AssetGenerationExecutor`、`CandidateStore`、`AssetRegistrar` 等小接口；
- `LocalCodexExecutorAdapter` 调用 MCP/CLI，候选保存在 `.adv/generated`；
- `RemoteAgentExecutorAdapter` 调用云端任务 API，候选保存在私有 COS；
- 两端共享任务 schema、状态迁移、审核命令、回执和错误码；
- Provider 参数保存在执行元数据，不进入 Core Runtime 或场景卡。

进入条件：Phase 1-A 在真实项目中完成至少一次背景生成、拒绝重试与接纳回放。

## 5. Phase 2：Studio 云端 Agent（待实施）

新增 `@advjs/agent` 的前提是至少出现 Editor 本地适配器和 Studio 远程适配器两个真实消费者。该包可以封装 Agent 任务、事件和领域 UI 组合逻辑，但不承载通用按钮/弹窗；通用视觉原语仍属于 `@advjs/gui`。

云端建议能力：

- CloudBase Auth：用户、组织、项目角色与审批权限；
- CloudBase DB：任务、候选、审核决策、成本、配额与回执索引；
- 私有 COS：源图、候选、可编辑中间产物；
- CloudRun/云函数网关：模型密钥托管、Provider 调用、回调和长任务；
- 队列/状态机：取消、重试、幂等、超时和并发控制；
- 日志与指标：taskId/traceId、费用、延迟、失败分类和审计；
- AG-UI：只作为 Studio 的远程 Agent 事件/交互协议，不进入 Editor 或 Asset Core。

Studio UI 可以提供生成、对比、审核、成本和队列工作台，但必须消费 Phase 1 的共享用例，不能直接修改清单或复刻状态机。

## 6. Phase 3：私有创作到公开发布（待实施）

- 私有对象：短期签名访问、禁止公共缓存、按账号/项目隔离；
- 正式本地资产：Git 工作区 `adv/assets/**`，内容哈希不可变命名；
- 公开发布对象：`games/{gameId}/v{major}/...`，immutable cache；
- 稳定 manifest 最后发布，短缓存/再验证；
- 发布是一次明确提升操作，不把私有 authoring key 当公开 URL；
- 任务/候选/回执与发布清单保持可追踪关联。

## 7. 安全与契约待办

优先级 P0，进入云端阶段前完成：

- 审计并对齐 Studio 客户端 `assetUpload`、CloudBase `advjsAssets` 与 `@advjs/assets` schema，消除字段和错误码漂移；
- 搜索并轮换任何历史预览密钥、长期 COS 密钥或被前端包暴露的 token；文档与测试只保留占位符；
- 云端模型与 COS 使用短期凭证和最小权限，禁止把密钥放进 Prompt、Skill、manifest、回执或浏览器日志；
- 给任务、候选与接受接口补租户越权、重放、配额绕过、路径穿越和内容替换测试；
- 明确内容许可、敏感内容审核、删除/保留策略与审计日志期限。

## 8. 明确延期的想法

- `@advjs/agent` 包与共享 Agent 领域 UI；
- Studio 的 AG-UI、自定义 Agent 和审核工作台；
- 云端图像/音频 Provider 编排、成本路由与批量生成；
- 私有候选跨设备同步、团队评论与多人审批；
- 从私有 COS 到公共 COS/CDN 的提升发布；
- Character/CG/缩略图/音频沿用同一任务协议的扩展；
- 自动裁切、超分辨率、背景移除、格式规格化和差异对比；
- 生成任务恢复、队列监控、预算上限与用量分析。

这些事项记录在此，但不属于 Phase 1-A 的完成条件，也不应为了“未来可能需要”提前创建空包或第二套 UI。

## 9. 后续阶段启动门槛

每次进入下一阶段前必须重新审计现状：

1. 是否已有相同能力或可扩展接口；
2. 是否至少有两个真实消费者证明值得拆包；
3. 是否保持 `assetId`、任务 schema 和回执单一权威；
4. 是否把平台/Provider 细节留在适配器；
5. 是否有人工接纳、权限、成本和失败恢复的端到端测试。
