# ADV.JS Studio 托管 AI 实施计划

> 状态：已确认，实施中
>
> 需求基线：[requirements.md](./requirements.md)
>
> 技术设计：[design.md](./design.md)

> 迁移说明（2026-08-18）：本文记录最初按 `www.yunle.fun/services/advjs-ai-runtime` 实施的历史路径。共享平台 Runtime 现已迁移到 `YunLeFun/api/services/ai-runtime`，ADV.JS v1 兼容层位于 `YunLeFun/api/packages/ai-runtime-advjs`；`www.yunle.fun` 仅保留冻结契约 fixture。文中的旧路径用于追溯，不代表当前部署拓扑。

## 1. 执行边界

本计划覆盖三个本地仓库：

- `YunYouJun/advjs`：`/Users/yunyou/repos/github.com/YunYouJun/advjs`
- `YunLeFun/www.yunle.fun`：`/Users/yunyou/repos/github.com/YunLeFun/www.yunle.fun`
- `YunYouJun/admin`：`/Users/yunyou/repos/github.com/YunYouJun/admin`

计划确认后，可以执行 T0-T18 的代码、测试、fixture、dry-run 脚本和本地集成工作，但不自动取得以下权限：

1. 创建或修改生产 CloudBase 集合、索引、安全规则和服务凭证；
2. 启用模型、购买或消耗资源点/存量 Token Credits、产生真实模型费用；
3. 注册或修改生产 SSO client；
4. 部署 `account-api`、`advjs-ai-runtime` 或 Admin；
5. 发放 Beta AI 点数、开启白名单或切换真实用户流量。

这些操作分别位于 T19-T21，必须在执行当时重新确认，不能由本计划的一次确认合并授权。

## 2. 实施约束

- 使用测试驱动顺序：先补失败测试或契约 fixture，再实现最小代码，最后重构。
- 默认测试只能使用 fake model executor，不得调用真实模型或产生费用。
- 账务金额只使用安全整数；禁止用浮点数保存或计算 `microPoints`、`microCny`。
- 浏览器不能写 AI 点数集合，也不能决定 `uid`、模型、价格、提示词版本或安全策略。
- `account-api` 是 AI 点数唯一写入者；Runtime 通过受信服务接口调用它。
- 现有 `cloudfunctions/ai-gateway` 保持兼容；新 REST/SSE 服务位于 `services/advjs-ai-runtime`。
- 不修改 `account-api/lib/wallet.js` 及其同步副本；AI 点数使用独立领域模块。
- Studio 首期只建立内部 Agent 抽象，不发布 `@advjs/agent`。
- 保留 ADV.JS 当前未提交的 Editor workspace 改造，不覆盖、不回退，也不混入无关修改。
- 若后续需要提交 Git，每个仓库按可独立回滚的关注点拆分，并使用 Conventional Commits。

## 3. 任务依赖与门禁

| 阶段               | 任务    | 产出                                    | 前置条件       |
| ------------------ | ------- | --------------------------------------- | -------------- |
| A 协议与账本       | T0-T3   | 基线、协议、账本、资源 manifest         | 本计划确认     |
| B Runtime 本地闭环 | T4-T10  | fake executor 可跑通的任务/SSE/结算闭环 | T1-T3          |
| C Studio           | T11-T16 | SSO、托管 AI、提案应用、生产 BYOK 隔离  | T1、T7-T10     |
| D Admin 与验收     | T17-T18 | 运营控制面与跨仓库自动化验收            | T2-T16         |
| E 生产资源         | T19     | CloudBase/SSO 资源实际变更              | 单独确认       |
| F 部署             | T20     | Staging/生产部署与真实模型 smoke test   | T19 + 单独确认 |
| G Beta 放量        | T21     | 赠送点数、白名单和逐能力开放            | T20 + 单独确认 |

## 4. 可执行任务

### T0. 锁定仓库基线与回归保护

- [x] 记录三个仓库的当前分支、HEAD、工作区状态和 Node/pnpm 版本，不修改现有用户改动。
- [x] 在 `advjs` 单独验证当前 Editor workspace seam 的相关测试，确认后续提案应用可以复用 `ProjectWorkspace` / `ProjectSourcePatch`。
- [x] 为 `www.yunle.fun/cloudfunctions/ai-gateway` 补充或锁定现有请求/响应回归测试，确保新 Runtime 不改变老消费者行为。
- [x] 建立不包含正文、密钥和个人信息的测试数据约定；fixture 统一使用固定测试 uid、appId 和 taskId。
- [x] 将每个仓库的基线结果写入实施记录，失败项在继续前说明是既有问题还是本次回归。

验收：三个仓库基线可复现；现有 Editor 未提交改动未被覆盖；老 `ai-gateway` 行为有自动化保护。

建议验证：

```bash
pnpm vitest run tests/unit/editor-workspace.test.ts
pnpm --dir /Users/yunyou/repos/github.com/YunLeFun/www.yunle.fun test
pnpm --dir /Users/yunyou/repos/github.com/YunYouJun/admin test
```

_Requirements: R1, R3, R5, 6.4_

### T1. 冻结 Agent 与 Runtime v1 协议

- [x] 在 `advjs/apps/studio/src/agent/core/` 定义纯 TypeScript 的 `AgentRuntime`、能力标识、任务状态、领域事件、错误码和取消接口。
- [x] 定义 `AgentProposal`、`ProjectSourcePatch` 引用、用量摘要、点数摘要与 SSE cursor/offset 契约。
- [x] 在 `www.yunle.fun/services/advjs-ai-runtime/src/contracts/` 建立服务端 DTO schema，不复用 Vue、Pinia 或浏览器类型。
- [x] 新增版本化 JSON fixture，至少覆盖创建任务、流式增量、候选提案、失败、取消和完成。
- [x] 在 Studio 与 Runtime 两端分别解析同一组 fixture，拒绝未知破坏性版本并容忍向后兼容字段。
- [x] 明确 v1 不发布公共 `@advjs/agent` 包。

验收：同一 fixture 能被两端独立验证；核心契约不依赖 Vue、Pinia、CloudBase 或具体模型 SDK。

建议提交边界：`feat(studio): define internal agent runtime contracts`、`feat(ai-runtime): add v1 protocol contracts`

_Requirements: R3, R4, R5, R11, 6.2, 6.4_

### T2. 实现 account-api AI 点数领域模块

- [x] 先为赠送、预占、结算、释放、退款/冲正、人工调整编写纯领域与事务测试。
- [x] 新建独立 `ai-points` 模块；不得改动与 wxpay 同步的 `lib/wallet.js`。
- [x] 使用 `microPoints` 安全整数实现 `available`、`reserved`、`lifetimeGranted`、`lifetimeSpent` 和 `activeTask`。
- [x] 用稳定文档 ID/幂等键保证 grant、reserve、settle、release、refund、adjust 重入时只改变一次余额。
- [x] 在同一数据库事务中更新账户与追加不可变流水；修正只能追加冲正/调整流水。
- [x] 实现单用户并发 1、每日 20 个计费任务、每日 500 AI 点的服务端原子检查。
- [x] 增加内部服务接口与 Admin 查询/调整接口；用户接口只能读取自己的余额与流水摘要。
- [x] 覆盖并发竞争、跨日、安全整数边界、余额不足、重复请求和事务失败回滚。

验收：账务写入只有 account-api 能完成；所有余额变化都有不可变流水；并发和幂等测试通过。

建议提交边界：`feat(account-api): add ai point ledger`

_Requirements: R6, R7, R8, R10, R12, 6.1, 6.2, 6.4_

### T3. 建立 CloudBase 资源 manifest 与 dry-run 校验

- [x] 在 `www.yunle.fun` 增加声明式资源 manifest，且只包含五个集合：`ai_point_accounts`、`ai_point_transactions`、`ai_usage_records`、`ai_tasks`、`ai_runtime_control`。
- [x] 为设计文档列出的查询模式声明复合索引，标明唯一性、字段顺序和用途。
- [x] 将五个集合的浏览器权限声明为 `ADMINONLY`；禁止客户端直写和正文型日志扩散。
- [x] 增加 `scripts/ensure-ai-runtime-resources.mjs`，默认只做 manifest/dry-run；实际 `--apply` 必须显式参数与环境确认。
- [x] 为缺失 EnvId、生产环境误操作、权限漂移、索引漂移和未知集合写测试。
- [x] dry-run 输出拟变更项、风险和回滚信息，但不得在 T3 执行实际资源变更。

验收：无 CloudBase 写权限也能在 CI 校验资源定义；默认命令不会创建或修改资源。

建议提交边界：`chore(cloudbase): add ai runtime resource manifest`

_Requirements: R8, R10, R12, 6.1, 6.2, 8_

### T4. 搭建 advjs-ai-runtime TypeScript 服务

- [x] 将 `services/*` 加入 `www.yunle.fun/pnpm-workspace.yaml`。
- [x] 创建包名为 `@yunlefun/advjs-ai-runtime` 的 `services/advjs-ai-runtime`，提供 build、typecheck、test、dev 和 start 脚本。
- [x] 按 `api`、`auth`、`contracts`、`domain`、`repositories`、`executors`、`worker`、`sse`、`capabilities` 分层。
- [x] 所有 CloudBase、时钟、id 生成器、account-api 和模型调用均通过可替换接口注入。
- [x] 实现内存 repository 与 fake account/model adapter，使普通测试无需云资源即可运行。
- [x] 增加健康检查，但不得在其中泄露环境、模型、密钥或数据库信息。

验收：新服务能在本地只用 fake adapter 启动、测试和退出；现有 Nuxt 与老云函数构建不受影响。

建议验证：

```bash
pnpm --dir /Users/yunyou/repos/github.com/YunLeFun/www.yunle.fun --filter @yunlefun/advjs-ai-runtime test
pnpm --dir /Users/yunyou/repos/github.com/YunLeFun/www.yunle.fun --filter @yunlefun/advjs-ai-runtime typecheck
```

建议提交边界：`feat(ai-runtime): scaffold managed ai service`

_Requirements: R3, R4, R11, 6.3, 6.4_

### T5. 实现价格快照与平台预算领域

- [x] 实现按 usage bucket 向上取整的整数成本公式与 `pricingSnapshot`。
- [x] 首期配置 `userRateBps=10000`、固定费 0、最低费 0，但保留版本字段而不暴露给客户端覆盖。
- [x] 区分用户预占（最多一个用户计费 attempt）和平台预算预留（最大自动 attempts）。
- [x] 在 `ai_runtime_control` 中设计 active policy 与按日 budget 文档，并用事务实现全局预算预留/释放。
- [x] 当平台当日实际供应商成本达到 ¥50 时硬熔断；kill switch、模型开关、能力开关均在服务端生效。
- [x] 对缺失 usage bucket、未知价格版本、整数溢出、并发预算争抢、跨日和重入编写测试。

验收：给定 pricing snapshot 与 usage 时成本结果确定；并发请求不能突破平台预算上限。

建议提交边界：`feat(ai-runtime): add pricing and budget controls`

_Requirements: R3, R6, R7, R8, R10, R12, 6.2_

### T6. 实现持久化任务状态机与 Worker lease

- [x] 实现 `authorizing -> queued -> running -> settling -> terminal` 状态机及合法转换守卫。
- [x] 创建任务时先执行白名单、限额、用户余额和平台预算授权；任一失败都不得进入模型调用。
- [x] 使用 `ai_point_accounts.activeTask` 作为用户并发 1 的权威锁，并在所有终态可靠释放。
- [x] Worker 使用 owner、leaseUntil、attempt 和 compare-and-set 领取任务；支持 lease 过期恢复。
- [x] 实现用户取消、自动重试、手动重新生成、平台失败、解析失败、安全阻止和上游超时的责任矩阵。
- [x] 结算不确定时进入 `reconcile_required`，不得猜测扣点、重复调用模型或静默吞错。
- [x] 增加 sweeper，恢复过期 lease、遗留预占和卡住的 settling 任务。
- [x] 使用 fake executor 覆盖成功、部分取消、无候选失败、自动重试平台承担和重复 Worker 领取。

验收：任务记录是状态真源；进程中断后可恢复；用户余额、平台预算和 activeTask 不泄漏。

建议提交边界：`feat(ai-runtime): implement durable task worker`

_Requirements: R4, R7, R8, R9, R10, 6.2, 6.3, 6.4_

### T7. 实现 Runtime REST、认证和授权

- [x] 实现设计文档中的创建、查询、取消、余额和 Admin API，统一返回版本化错误模型。
- [x] 通过 CloudBase Auth `user/me` 校验 bearer access token，拒绝匿名、过期或 uid 不一致会话。
- [x] 精确校验允许的 Studio Origin、HTTP method、header 和 credentials；生产不使用通配 CORS。
- [x] 创建请求必须提供 `Idempotency-Key`，重试返回同一任务或稳定冲突，不重复预占。
- [x] 客户端请求只能提交 capability 与允许的业务输入；拒绝 uid、模型、供应商、价格、promptVersion 和任意 system prompt 覆盖。
- [x] 内部 account-api 与 Admin 调用使用独立服务身份和最小权限，不复用浏览器 token。
- [x] 加入请求大小、速率、日志脱敏和稳定 requestId 测试。

验收：未认证用户无法创建或读取任务；用户只能访问自己的任务；客户端不能操纵计费与模型策略。

建议提交边界：`feat(ai-runtime): add authenticated task api`

_Requirements: R2, R3, R4, R9, R10, R12, 6.1, 6.2_

### T8. 实现可恢复 SSE 传输

- [x] 任务记录维护累计 `streamText`、单调 `streamRevision`、状态和结果摘要，不新增首期事件集合。
- [x] SSE 端点使用 authenticated fetch，支持 cursor/offset 恢复、heartbeat、终态关闭和客户端取消。
- [x] Worker 更新流文本时保证 revision 单调；客户端重连不会重复拼接或遗漏文本。
- [x] 连接断开只停止投影，不自动把任务标记失败或取消。
- [x] SSE 返回状态、文本增量、候选、用量/点数摘要、错误和终止事件；敏感内部信息不得进入事件。
- [x] 覆盖分帧、UTF-8 边界、重复事件、旧 cursor、页面刷新、多个只读连接和终态恢复。

验收：任意时刻断开并重连后，客户端可从任务记录恢复相同最终结果，且不重复扣费。

建议提交边界：`feat(ai-runtime): add resumable task streaming`

_Requirements: R4, R7, R8, 6.2, 6.3, 6.4_

### T9. 实现服务端能力注册表、安全与提案校验

- [x] 为 `generate-outline`、`generate-chapter-draft`、`suggest-plot`、`simulate-roleplay`、`check-consistency` 建立服务端注册项。
- [x] 每个注册项固定输入 schema、promptVersion、输出 parser、最大 token、超时、自动重试和 executor 类型。
- [x] 首期五项全部标为 Model Executor；不得仅为形式统一路由到 Agent Runtime。
- [x] 实现输入与输出两阶段安全策略，返回稳定原因码；正常虚构成熟主题不得被一概阻止。
- [x] 对明确未成年人色情、非自愿色情等禁止内容阻止交付，并在无可用候选时释放用户预占。
- [x] 对项目型结果验证 patch 路径、操作类型和大小，在项目副本中应用并编译/解析通过后才标为可用候选。
- [x] 记录能力、promptVersion、parserVersion、safetyVersion 和 executorVersion，不记录不必要的完整正文。

验收：只有通过 schema、安全、patch 和项目校验的结果才进入 billable candidate；用户应用动作不参与计费判定。

建议提交边界：`feat(ai-runtime): add authoring capability registry`

_Requirements: R3, R5, R7, R9, R10, R11, 6.1_

### T10. 接入 CloudBase Model Executor（代码态）

- [x] 实现 `CloudBaseModelExecutor`，通过 `createModel('cloudbase')` 和流式接口调用服务端选择的模型。
- [x] 将供应商 requestId、模型、输入/输出/缓存/推理 token 和 attempt 写入用量记录。
- [x] 按实际 usage 与价格快照结算；自动重试额外 attempt 只进入平台成本，不重复计入用户收费。
- [x] 对缺失 usage、流中断、abort 不确定、供应商重复 requestId 和结算失败进入可对账状态。
- [x] 普通测试继续默认 fake executor；真实模型 smoke test 需要显式环境开关且此任务不执行。
- [x] 预留 `AgentExecutor` 接口，但不启用 CloudBase Agent Runtime，也不实现无真实用例的公共抽象。

验收：模型适配器具备完整 fake 合同测试；默认 CI 不访问网络、不启用模型、不产生费用。

建议提交边界：`feat(ai-runtime): add cloudbase model executor`

_Requirements: R3, R4, R7, R8, R10, R11, 6.4, 7_

### T11. 实现 Studio 内部 AgentRuntime

- [x] 在 `apps/studio/src/agent/core/` 保持纯契约，在 `managed/`、`byok-dev/`、`capabilities/`、`proposals/` 分层。
- [x] `ManagedAgentRuntime` 只通过 Runtime REST/SSE 工作，不导入模型 SDK 或用户 API key store。
- [x] `ByokDevAgentRuntime` 只允许明确的本地开发环境启用，并实现与 managed runtime 相同的合同测试。
- [x] 用 adapter 将现有 `agentRegistry.ts` 的五项调用迁移到新 runtime；迁移期避免同时维护两套 prompt 真源。
- [x] 增加 task store，处理快照恢复、SSE 增量、取消、终态和稳定错误码。
- [x] 确认核心目录没有 Vue、Pinia、CloudBase SDK 和具体供应商依赖。

验收：同一能力可以在测试中切换 managed fake 与 byok-dev fake；生产构建只能选择 managed runtime。

建议提交边界：`feat(studio): add internal agent runtime`

_Requirements: R1, R3, R4, R11, 6.4_

### T12. 迁移 Studio 至云乐坊 SSO v3 会话

- [x] 将 `@yunlefun/sso` 加入 Studio 依赖并注册 `advjs-studio-web` 的本地配置 fixture。
- [x] 使用 `startSsoRedirect -> consumeSsoRedirect -> adoptSsoCode` 完成 top-level redirect 登录与回跳。
- [x] 以 CloudBase Auth `getSession()` 为身份真源并拒绝匿名会话，移除对废弃登录状态 API 的新依赖。
- [x] 在首期将 SSO code 兑换为现有 Studio 可用的持久 CloudBase 会话，保证项目、资产和协作访问不回归。
- [x] 为 Runtime 提供短期 access token 获取/刷新逻辑；会话过期时终止收费任务创建并引导重新登录。
- [x] 迁移期保留安全的旧会话恢复，但普通用户主入口不再展示独立短信登录。
- [x] 覆盖成功回跳、state/nonce 错误、过期 code、匿名 session、刷新失败和原页面恢复。

验收：用户一次云乐坊登录后可访问原有 Studio 数据和托管 AI；非法回跳或匿名状态不能创建任务。

建议提交边界：`feat(studio): adopt yunlefun sso session`

_Requirements: R2, R3, 6.1, 6.3_

### T13. 实现 Studio AI 任务轨道与点数状态

- [x] 增加桌面任务轨道和移动端 bottom sheet，展示授权、排队、生成、结算、完成、取消、阻止和需对账状态。
- [x] 用 authenticated fetch 消费 SSE，并在页面刷新、切后台、网络恢复时主动读取任务快照。
- [x] 显示可用/预占 AI 点、预计上限、实际消费和“生成候选即计费”的清晰说明。
- [x] 并发为 1 时禁用新的计费提交并显示现有任务，不依赖客户端作为最终限额控制。
- [x] 提供取消、重连、复制 requestId 和适度错误说明；不暴露内部审核规则、供应商密钥或完整调试信息。
- [x] 延续现有 Purple/Gold 品牌和字体，在创作区使用紧凑的工业化控制台布局。
- [x] 使用真实按钮、文本标签、焦点管理、ARIA live region 和 reduced-motion 兼容。

验收：登录、余额不足、流式、断线恢复、取消、失败、阻止和完成均有可理解且可访问的界面状态。

建议提交边界：`feat(studio): add managed ai task rail`

_Requirements: R2, R4, R6, R7, R9, R10, 6.3_

### T14. 实现提案预览、应用与撤销

- [x] 用统一 proposal model 展示摘要、影响文件、结构化操作和可读 diff。
- [x] 服务端结果到达后只保存为候选，不在用户确认前修改项目持久状态。
- [x] 客户端再次校验 patch path 与基线 revision，并通过现有 `ProjectWorkspace` 应用。
- [x] 应用前保存逆向 patch/快照；应用失败时保持原项目，应用成功后提供撤销。
- [x] 检测生成期间项目已变化的冲突，禁止静默覆盖并允许用户重新预览。
- [x] 覆盖 apply、undo、部分失败、非法路径、基线冲突和编译失败。

验收：未确认、失败或冲突的提案均不会改变项目；成功应用可以可靠撤销。

建议提交边界：`feat(studio): add reviewable agent proposals`

_Requirements: R5, R7, R11, 6.2, 6.4_

### T15. 迁移首批五项创作能力并隔离生产 BYOK

- [x] 将剧情大纲、章节草稿、情节建议、角色扮演和一致性检查入口迁移到 `AgentRuntime`。
- [x] 删除这些入口对 `useAiSettingsStore`、供应商 baseURL/model/key 和浏览器直连 `aiClient` 的生产依赖。
- [x] 将 Studio 生产 AI 设置页替换为 AI 服务状态、点数、任务额度和隐私说明。
- [x] BYOK 配置只保留在明确的开发入口/环境变量中，不出现在生产路由、菜单、localStorage schema 或用户文案。
- [x] 加入生产构建静态守卫，发现供应商 key 字段、直连 URL 或 byok-dev import 时构建失败。
- [x] 图片、TTS 和无托管 ASR 入口保持隐藏；浏览器本地 Web Speech 可保留并明确标识为本地能力。

验收：生产包中首批五项只能经 ManagedAgentGateway；普通用户看不到 API Key 和模型供应商配置。

建议提交边界：`refactor(studio): route authoring through managed ai`

_Requirements: R1, R3, R6, R11, 7_

### T16. 收口其余 Studio 生产 AI 调用

- [x] 盘点 `apps/studio` 中所有文本生成、聊天、抽取、Embedding、图像、TTS、ASR 和模型配置引用，形成可验证清单。
- [x] 将首批五项文本生成迁移到统一 Gateway；内容抽取和 Embedding 在登记独立服务端能力与价格前保持 fail closed 或确定性本地回退。
- [x] 对暂未迁移且会产生供应商调用的入口在生产环境 fail closed，不允许回退到浏览器直连。
- [x] 删除或隔离遗留 API key 持久化数据，并提供不上传旧 key 的本地清理迁移。
- [x] 加入源码与构建产物扫描，验证生产包不包含真实 key、供应商密钥字段或未批准直连域名。
- [x] 更新用户文档，明确 Studio 托管服务与 Editor 本地/BYOK 的产品边界。

验收：Studio 生产环境所有在范围内的 AI 请求都经过统一 Gateway；无托管实现的入口被隐藏而非暗中直连。

建议提交边界：`refactor(studio): complete managed ai migration`

_Requirements: R1, R3, R11, 6.1, 7_

### T17. 实现 Admin AI 运营控制面

- [x] 在 `admin` 增加 AI Runtime 页面、路由、类型和 API adapter，不允许浏览器直接写账本集合。
- [x] 展示任务状态、用户、appId、能力、模型、用量分项、供应商成本、用户点数、requestId 和日期过滤。
- [x] 展示 active policy、白名单、用户限额、平台预算、kill switch、模型/能力开关和 reconcile 队列。
- [x] 赠送、调整、冲正和 reconcile 操作必须调用 account-api/Runtime 管理接口，包含操作人、原因、关联任务和幂等键。
- [x] 危险操作使用清晰确认与结果回执；禁止直接覆盖账户余额或修改既有流水。
- [x] 为权限拒绝、过滤聚合、重复提交、kill switch 和审计字段写自动化测试。

验收：运营者可观察和安全纠错，但所有账务写入仍由 account-api 事务完成且留下审计记录。

建议提交边界：`feat(ai): add runtime operations console`

_Requirements: R8, R10, R12, 6.1, 6.2_

### T18. 完成跨仓库验证与上线资料

- [x] 三端运行同一 v1 fixture contract tests，防止 DTO 漂移。
- [x] 使用 fake executor 完成从 SSO 测试身份、创建任务、SSE 断线恢复、候选、结算、应用和撤销的自动化场景。
- [x] 覆盖余额不足、并发任务、日限额、平台熔断、用户取消、自动重试、解析失败、安全阻止和 reconcile_required。
- [x] 运行三个仓库的定向测试、typecheck、lint 和 build；将既有失败与本次回归分开记录。
- [x] 对日志、SSE、Admin、数据库 fixture 和构建产物做密钥/正文/PII 泄露检查。
- [x] 生成 staging runbook、回滚 runbook、对账 runbook、告警清单和生产门禁检查表。
- [x] 确认 T0 时的 Editor 未提交改动仍完整，老 `ai-gateway` 回归测试仍通过。

验收：本地/CI 在不访问真实模型和生产 CloudBase 的条件下跑通完整闭环；具备进入生产 preflight 所需资料。

建议验证：

```bash
pnpm lint
pnpm typecheck
pnpm --filter @advjs/studio exec vitest run
pnpm --filter @advjs/studio build

pnpm --dir /Users/yunyou/repos/github.com/YunLeFun/www.yunle.fun test
pnpm --dir /Users/yunyou/repos/github.com/YunLeFun/www.yunle.fun typecheck
pnpm --dir /Users/yunyou/repos/github.com/YunLeFun/www.yunle.fun build

pnpm --dir /Users/yunyou/repos/github.com/YunYouJun/admin test
pnpm --dir /Users/yunyou/repos/github.com/YunYouJun/admin typecheck
pnpm --dir /Users/yunyou/repos/github.com/YunYouJun/admin build
```

_Requirements: R1-R12, 6.1-6.4_

## 5. 生产操作任务（计划确认不等于授权）

### T19. [生产资源门禁] CloudBase 与 SSO preflight/provision

- [ ] 重新向用户展示并确认 canonical EnvId、region、资源点/存量 Token Credits 状态、目标 GroupName、已启用模型和实时价格。
- [ ] 展示 `advjs-studio-web` 的 production/development 精确 Origin、redirect URI 和 session 方案。
- [ ] 运行资源脚本 dry-run，展示五个集合、权限、索引、凭证、保留策略的完整 diff。
- [ ] 展示 CloudBase Run 最小实例、公开 ingress、域名、TLS、CORS 和月度最低成本预估。
- [ ] 分别取得“创建 CloudBase 资源”和“注册/修改 SSO client”的明确授权后才执行 apply。
- [ ] apply 后立即读回验证权限与索引；偏差时停止，不继续部署。

验收：资源实态与 manifest 一致，未授权资源没有变化，凭证遵循最小权限。

_Requirements: R2, R3, R8, R10, R12, 8_

### T20. [部署门禁] Staging、模型与生产部署

> 2026-08-15：本地 production composition、独立服务鉴权、Worker/Sweeper 生命周期、7 天任务清理和 fail-closed policy bootstrap 已完成；以下部署、真实模型与费用项目仍未授权，因此 T20 保持未完成。

- [ ] 分别确认 account-api 部署、Runtime 部署、模型启用/真实费用和 Admin 部署，不合并授权。
- [ ] 先部署 staging，保持 kill switch 关闭 AI，对健康检查、认证、CORS、SSE、账本和 lease 做 smoke test。
- [ ] 使用独立测试额度显式运行一次真实模型 smoke test，并向用户报告实际 usage、供应商成本和映射点数。
- [ ] 完成真实 SSO、任务恢复、提案应用、取消与对账演练后，才允许部署生产。
- [ ] 生产部署后继续保持全局 AI 关闭，验证版本、资源、日志脱敏、告警和回滚路径。

验收：代码已部署但未向真实 Beta 用户开放；真实费用和点数映射得到核验；任何失败可回滚或熔断。

_Requirements: R2-R10, R12, 8_

### T21. [Beta 放量门禁] 发放点数与逐能力开放

- [ ] 确认 `initialGrantMicroPoints`、首批 uid 白名单、20 tasks/day、500 AI points/day 和 ¥50/day 平台硬上限。
- [ ] 通过 account-api 赠送交易发放 Beta 点数，不直接修改余额文档。
- [ ] 先仅对管理员开启一个低成本能力，再逐项开启其余能力；每次开关变化留下审计记录。
- [ ] 观察任务成功率、取消率、解析/安全失败、平台实际成本、用户扣点和对账差异。
- [ ] 达到预算、异常率或对账阈值时自动 kill switch；不得依赖客户端发布止损。
- [ ] Beta 结束后评审价格映射、赠送额度和是否需要积分批次，再决定是否开放云币兑换。

验收：只有已授权白名单用户能使用已开启能力；成本上限与账本对账有效；可以服务端即时停用。

_Requirements: R6-R10, R12, 8_

## 6. 完成定义

T0-T18 的“代码实施完成”需要同时满足：

1. 对应自动化测试、typecheck 和 lint 通过；
2. 默认 CI 没有真实模型调用和生产资源写入；
3. Studio 生产构建无用户 BYOK、供应商密钥或浏览器直连路径；
4. 所有任务、用量和点数交易可通过稳定 taskId/requestId/idempotencyKey 关联；
5. AI 结果只能以提案交付，用户确认前不写项目，确认后可撤销；
6. 三个仓库的变更、既有问题和未执行的生产门禁均在交付说明中列清。

T19-T21 只有在各自单独确认、实际验证和回滚准备完成后，才能分别标记完成。
