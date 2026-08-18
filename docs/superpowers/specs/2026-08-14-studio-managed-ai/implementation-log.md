# ADV.JS Studio 托管 AI 实施记录

## 2026-08-14 — T0 基线

### 仓库状态

| 仓库                     | 分支   | HEAD                                       | 初始工作区                                           |
| ------------------------ | ------ | ------------------------------------------ | ---------------------------------------------------- |
| `YunYouJun/advjs`        | `dev`  | `ba9ef2dec664da059cb39efe3c57de18df4a10f1` | 已有 Editor workspace 与规格文档未提交改动，必须保留 |
| `YunLeFun/www.yunle.fun` | `main` | `e2b0e0a04a0f56f2c6bb97888b6dce7ae55b9d15` | 干净                                                 |
| `YunYouJun/admin`        | `main` | `3f3c20a736f87cf0788de577dbe4831b7e635efc` | 干净                                                 |

工具版本：Node `v24.18.0`，pnpm `11.20.0`。

### 已确认测试 seam

1. Studio/Runtime v1 DTO 解析与版本化 fixture；
2. account-api AI 点数公共领域操作；
3. CloudBase 资源 manifest/dry-run CLI；
4. 既有 `cloudfunctions/ai-gateway` handler 与领域测试。

测试只通过这些公共边界观察行为；外部数据库、时间、随机数、模型与服务调用才允许替换。

### 基线结果

- `advjs`: `pnpm vitest run tests/unit/editor-workspace.test.ts` — 3/3 通过。
- `www.yunle.fun`: `pnpm exec vitest run tests/ai-gateway tests/account-api` — 341/341 通过。
- `admin`: `pnpm test` — 564/564 通过。

既有 `ai-gateway` 已有 42 个测试文件覆盖 relay、quota、budget、attestation、audit 和 account proxy；T0 复用并锁定这些测试，没有添加重复的表面测试。

### 安全边界

- 本阶段不调用 CloudBase 管理 API，不创建集合或索引。
- 本阶段不启用模型、不调用真实模型、不部署函数或 CloudRun。
- fixture 使用固定合成标识，不包含作品正文、密钥或真实个人信息。

## 2026-08-14 — T1 Agent/Runtime v1 协议

- Studio 新增纯 TypeScript `AgentRuntime`、任务、事件、提案、用量、点数和错误契约。
- Runtime 新增独立的 v1 wire DTO 与严格 parser。
- 两仓库各保存一份字节一致的版本化 fixture，覆盖创建、流式文本、提案、结算、完成、取消和失败。
- parser 拒绝非 v1 协议与缺失必填字段，剥离兼容性新增字段，并允许空项目文件和清空 Markdown 的 patch。
- 没有发布 `@advjs/agent`，也没有引入 Vue、Pinia、CloudBase 或模型 SDK 依赖。

验证：

- Studio 协议测试 5/5；ESLint 与 `vue-tsc --noEmit` 通过。
- Runtime 协议测试 5/5；ESLint 与独立严格 TypeScript 检查通过。
- 两份 `agent-runtime-v1.json` 通过 `cmp` 字节一致性检查。

## 2026-08-14 — T2 AI 点数账本

- 在 `account-api/ai-points.js` 建立与云币钱包完全独立的 microPoints 账本，没有修改同步的 `lib/wallet.js`。
- 实现 `beta_grant`、`reserve`、`settle`、`release`、`refund`、`adjust` 六类不可变流水。
- 账户更新与流水追加位于同一 CloudBase 事务；稳定文档 ID 与 operation hash 同时保护重放和幂等键语义冲突。
- `activeTask` 原子限制单用户并发 1；按 Asia/Shanghai 自然日限制 20 个任务和 500,000 microPoints。
- 退款从原任务唯一 settle 流水计算剩余可退金额，调用方不能凭空增加余额。
- 点数 action 使用独立 `ADVJS_AI_RUNTIME_ACCOUNT_API_TOKEN`，不接受通用 account-api token。
- 新增私有 action router、账户查询和流水分页；浏览器没有点数写入口。

验证：

- AI 点数领域、内部鉴权与路由共 18 个测试通过。
- 覆盖并发竞争、跨日结算、幂等冲突、超额结算回滚、日限额、安全整数溢出和退款上限。
- account-api + 既有 ai-gateway 回归：45 个测试文件、358 个测试通过。
- 定向 ESLint 与 Node 语法检查通过。

## 2026-08-14 — T3 CloudBase 资源 manifest

- 声明且只声明五个 server-only 集合与设计文档要求的复合索引。
- `ensure-ai-runtime-resources.mjs` 无参数时只读取本地 manifest，不访问网络、不读取凭证、不写资源。
- 本地 snapshot 模式能报告缺失资源、权限漂移、索引不一致和未知 `ai_*` 集合。
- dry-run 输出 action、风险和回滚建议；不会自动删除集合或索引。
- `--apply` 在任何 CloudBase 调用前强制校验完整 EnvId、instanceId、region、仓库内配置文件、环境确认和写入确认；生产另需二次口令。

验证：

- 资源 manifest/plan/CLI 测试 4/4 通过。
- AI Runtime + account-api + 老 ai-gateway 回归：47 个测试文件、368 个测试通过。
- 默认脚本输出确认 `network=false`、`applied=false`；没有运行 `--apply`。

## 2026-08-14 — T4 Runtime TypeScript 脚手架

- 将 `services/*` 纳入 `www.yunle.fun` workspace，创建私有包 `@yunlefun/advjs-ai-runtime`。
- 按 api、auth、contracts、domain、repositories、executors、worker、sse 与 capabilities 建立纯 TypeScript 分层。
- 时钟、ID、身份校验、account-api、模型、任务/用量/控制面 repository 和能力注册表均从 `RuntimeDependencies` 注入；领域层没有直接初始化 CloudBase SDK。
- 提供内存任务/用量/控制面 repository、内存 account-api、固定时钟、顺序 ID 与 fake model executor；测试不访问网络或云资源。
- 采用 CloudBase 云托管 Function Mode：构建产物由 `@cloudbase/functions-framework` 加载，配置 `/health` 函数路由，默认监听框架固定的 3000 端口。
- 健康检查只返回服务名、协议版本与布尔状态，不包含环境、模型、密钥或数据库信息。

验证：

- Runtime 合同测试 3/3、独立 TypeScript typecheck/build 与定向 ESLint 通过。
- `tcb-ff` 本地启动成功；`curl http://127.0.0.1:3000/health` 返回最小健康响应，随后通过 SIGINT 正常退出。
- `www.yunle.fun` Nuxt typecheck 通过。
- AI Runtime + account-api + 老 ai-gateway 回归：47 个测试文件、368 个测试通过。
- 未调用 CloudBase 管理 API、未部署服务、未启用模型、未产生真实模型费用。

## 2026-08-14 — T5 价格与平台预算

- 用 BigInt 中间值实现安全整数成本算法；每个 input/output/cached/reasoning usage bucket 独立向上取整后再求和。
- Beta pricing snapshot 固定 `userRateBps=10000`、固定能力费 0、最低费 0，并保留不可变 pricing version。
- 授权估算明确分离：用户只预占一个 attempt 的最大应付点数，平台按单次最大成本乘最大自动 attempts 预留。
- 建立 active policy 与 Asia/Shanghai 日预算领域文档；kill switch、模型开关和五项能力开关只接受服务端 policy。
- `PlatformBudgetService` 通过可替换的 `RuntimeControlRepository.transactDailyBudget` 完成原子预留、结算和释放；内存实现用于无云测试，后续 CloudBase 实现使用同一事务端口。
- 日实际成本达到或实际+预留将超过 50,000,000 microCny 时拒绝新预留；操作使用幂等键和语义指纹，冲突不会重复改变预算。

验证：

- Runtime 价格/预算/脚手架共 10 个测试通过。
- 覆盖逐 bucket 取整、缺失价格、未知版本、安全整数溢出、自动重试预算、并发争抢、幂等冲突、释放、东八区跨日和硬熔断。
- 独立 TypeScript typecheck/build 与定向 ESLint 通过；未访问 CloudBase 或真实模型。

## 2026-08-14 — T6 持久任务与 Worker lease

- 建立受守卫的 `authorizing -> queued -> running -> settling -> terminal` 状态机；只为自动重试、取消清理和不确定授权开放明确的恢复转换。
- `RuntimeTaskService` 先建立任务壳，再依次完成服务端 policy、account-api activeTask/余额/日限额与平台预算授权；授权失败不会调用模型，并尽力释放已完成的预占。
- `RuntimeWorker` 使用 owner、lease expiry、稳定 attempt 与 CAS claim；执行期间定时续租并向模型传递 AbortSignal，过期 lease 可由其他实例恢复。
- 每个 `taskId + attempt` 只写一条不可变 usage；恢复时发现已确认 usage 会直接进入对账，不会再次调用模型或重复结算。
- 自动重试的 attempt 标记平台承担；成功 attempt 或已确认的部分取消 usage 才向用户结算。无候选、上游失败、解析/安全失败共享“用户释放、平台记成本”终态编排。
- account-api 或预算结算/释放出现不确定结果时进入 `reconcile_required`，保留阻止新任务所需的预占状态；不会猜测金额。
- `RuntimeSweeper` 恢复无已确认 usage 的过期 lease，释放陈旧 authorizing 预占，并将卡住的 settling 或带已确认 usage 的失效 lease 送入对账。
- 新增 CloudBase repository 代码态适配：`ai_tasks` 事务更新/CAS claim、`ai_usage_records` 稳定 attempt、`ai_runtime_control` policy 与日预算事务。SDK 数据库对象仍通过结构化端口注入。

验证：

- Runtime 共 23 个测试通过，覆盖合法/非法状态、并发 claim、续租、过期恢复、授权并发 1、成功、自动重试、无候选、部分取消、排队取消、结算不确定、sweeper 与跨 repository 持久事务。
- CloudBase repository 测试只使用进程内 fake database，不连接真实 CloudBase。
- 独立 TypeScript typecheck/build、定向 ESLint，以及 account-api + 老 ai-gateway 368 项回归通过。

## 2026-08-14 — T7 Runtime REST、认证和授权

- 新增版本化 Runtime REST：任务创建/查询/取消、本人 AI 点账户/流水，以及独立服务身份保护的 policy、sweep 与 reconcile 内部端点。
- 用户 bearer token 只通过 CloudBase Auth `auth/v1/user/me` 换取可信 `uid`；Runtime 不信任请求体里的身份。生产模式默认无允许 Origin，未配置时 fail closed。
- CORS 只回显精确白名单 Origin 并允许 credentials；创建任务强制 `Idempotency-Key`，相同语义重放同一任务，语义冲突返回稳定错误且不重复预占。
- 服务端递归拒绝客户端提交 uid、模型、供应商、价格、promptVersion 与 system prompt；请求体上限、速率限制、requestId 和脱敏日志均在统一入口执行。
- account-api 适配器使用独立服务 token 调用 AI 点数 action；用户 token 不向账务服务透传。Admin API 使用独立 audience `advjs-ai-runtime-admin`。
- 修正 CloudBase Function Mode 入口：请求体来自 `event`，URL/method/headers 来自 `context.httpContext`，并返回 `statusCode/headers/body` 集成响应。

验证：

- Runtime 11 个测试文件、35 个测试通过；独立 TypeScript typecheck/build 与定向 ESLint 通过。
- 本地 `tcb-ff` 冒烟验证 `/health` 为 200、预检为 204、创建任务为 201，且 CORS 与任务响应正确；随后通过 SIGINT 正常退出。
- account-api + 老 ai-gateway + 资源/协议 47 个测试文件、368 个测试通过。
- 未调用真实 CloudBase Auth、管理 API、account-api、模型或部署接口。

## 2026-08-14 — T8 可恢复 SSE

- 任务记录继续作为流状态真源，只维护累计 `streamText` 与单调 `streamRevision`，没有新增事件集合。
- Model Executor 增加异步 `onTextDelta` 端口；Worker 缓存跨 chunk 的 UTF-16 高代理项。为保证 T9 后置安全边界，原始 delta 先在内存缓冲，只有候选通过安全、parser 和项目校验后才发布累计 `streamText`，revision 始终单调。
- cursor 编码 attempt、stream revision、文本 offset、task version 与投影 phase。同 attempt 的旧 offset 只补缺失 delta；attempt 改变、未来 cursor、越界或拆分代理对时回退到完整 snapshot。
- SSE 以认证 fetch 使用 bearer token、精确 Origin 与任务所有权校验，支持 query cursor/offset 和 `Last-Event-ID`；heartbeat 不推进恢复 cursor，终态事件主动关闭连接。
- 投影支持状态快照、文本增量、候选、用量/点数、失败与完成；供应商 requestId、内部错误详情、正文型日志和服务凭证不会进入事件。
- CloudBase Function Mode 通过 `context.sse({ headers, keepalive: false })` 建立连接。真实框架返回只读 SSE 对象且已内置 UTF-8 encoder，因此没有调用会修改其内部状态的 `setEncoder()`。
- 连接关闭只终止只读投影，不写任务、不触发取消；用户取消仍使用 T7 的幂等 REST 端点。

验证：

- Runtime 12 个测试文件、44 个测试通过；覆盖 Unicode 分帧、旧/非法 cursor、attempt 切换、稳定终态重放、heartbeat、所有权、断连只读，以及经验证候选的结算前可见性。
- 独立 TypeScript typecheck/build、定向 ESLint 与 `git diff --check` 通过。
- 本地 `tcb-ff` 冒烟确认 SSE 为 200，精确返回 credentials CORS、`text/event-stream; charset=utf-8`，并立即输出版本化 `state.snapshot` 帧；连接由测试客户端超时断开后服务正常退出。
- account-api + 老 ai-gateway + 资源/协议 47 个测试文件、368 个测试通过；未连接云资源或真实模型。

## 2026-08-14 — T9 能力注册表、安全与提案校验

- 建立服务端唯一能力注册表，严格覆盖 `generate-outline`、`generate-chapter-draft`、`suggest-plot`、`simulate-roleplay` 与 `check-consistency`；五项均固定为 `model` executor。
- 每项能力固定输入字段、允许读取的项目路径、最大上下文、prompt/parser/safety/executor 版本、最大 token、千分温度、超时与最多两次自动 attempt。客户端不能新增字段或覆盖服务端 prompt。
- Runtime 只选取能力必需的 `adv/world.md`、`adv/outline.md`、角色卡与目标章节；无关文件不进入任务记录或 prompt。章节路径必须位于 `adv/chapters/*.adv.md` 且存在于请求基线。
- 输入前置与输出后置安全返回 `CONTENT_BLOCKED_MINOR`、`CONTENT_BLOCKED_NON_CONSENSUAL`、`CONTENT_BLOCKED_POLICY` 稳定原因码；正常成年恋爱、战争与情感主题不会被通配阻止。
- 原始模型流在 Worker 内存中隔离，输出通过安全与 schema 前不会写入公开 stream。安全阻止的 usage 记为平台承担，用户预占全额释放，任务终态为 `blocked`。
- 大纲与章节输出转换为绑定 `projectRevision` 的 raw-text proposal；路径、操作、patch 数量/大小、NUL、基线 revision 均在服务端校验，并在项目副本应用后调用 `@advjs/parser` 解析章节和角色卡。
- npm 尚未发布仓库当前的 `@advjs/parser@0.1.4`；Runtime 因此精确锁定已发布的 `0.1.3`，没有伪造或漂移版本。
- 任务记录保存 capability、policy、prompt、parser、safety、executor 与 pricing 版本；SSE 不输出供应商 requestId 或内部审核细节。

验证：

- Runtime 13 个测试文件、51 个测试通过；覆盖五项注册完整性、严格输入、上下文裁剪、两阶段安全、成熟题材放行、三类结构化输出、项目 proposal、路径穿越、基线冲突、解析失败与平台承担阻止。
- 独立 TypeScript typecheck/build、定向 ESLint、`git diff --check` 通过。
- account-api + 老 ai-gateway + 资源/协议 47 个测试文件、368 个测试通过；未调用 CloudBase、真实模型或部署接口。

## 2026-08-14 — T10 CloudBase Model Executor（代码态）

Preflight：

- canonical 环境保持 `yunlefun-8g7ybcxc7345c490`，region 为 `ap-shanghai`。
- 首次只读检查时只有已失效免费 Token 包；用户随后自行购买 `10,000` 资源点，实时返回活动 `pkg_tcb_credits_10000`、`ResourceType=CREDITS`、`Status=0`。
- CloudBase 官方最新计费说明确认旧 Token 资源包已于 2026-06-18 下架，资源点套餐/资源包可以抵扣内置大模型 Token，因此按新计费体系继续 group readiness。
- `DescribeAIModels` 确认 `cloudbase` 为 builtin、`Status=1`，`deepseek-v4-flash` 已启用；同时已启用 `hy3-preview`、`deepseek-v4-pro`、`glm-5-turbo`、`glm-5v-turbo`。
- 权威目录中 `deepseek-v4-flash` 价格为每百万 Token 输入 1、输出 2、缓存 0.2；首期 ToC 默认策略优先采用该模型。没有执行 `UpdateAIModel`。

实现：

- Runtime 固定 `@cloudbase/node-sdk@^3.18.3`，新增可注入 `CloudBaseAiClient` 的 `CloudBaseModelExecutor`；生产工厂要求显式 canonical env，并且始终调用 `createModel('cloudbase')`。
- 任务创建时固化 policy 的 `providerGroup` 与 `model`；Worker 只传服务端 capability registry 构造的 system/user prompt、temperature 和 timeout，不把客户端语义输入直接交给 SDK。
- 并行消费 SDK `textStream` 与 `dataStream`，保存流式文本、供应商响应 ID，并将最终 usage 归一为输入、输出、缓存和推理四个桶。DeepSeek/OpenAI-compatible 原始 usage 明细存在时拆分缓存与推理子集；不存在时明确归零而不伪造。
- 用量记录新增 `providerGroup` 与 `model`；同一 `taskId + attempt` 仍唯一，并拒绝重复 `providerGroup + providerRequestId`。重复写、缺失/非法 usage、流中断和执行中 abort 进入 `reconcile_required`；已知部分 usage 以 `pending` 责任保存。
- 已有结算失败对账和自动重试平台承担规则保持不变；用户只为一个成功/取消的可用 attempt 结算。
- 默认 Function-mode 入口仍使用 fake dependencies，不连接 CloudBase 模型。真实 smoke test 只有在 `ADVJS_AI_REAL_MODEL_SMOKE=1` 且显式提供 env/model 时运行，本阶段保持 skipped。
- `AgentExecutor` 仅保留接口，没有启用或接入 CloudBase Agent Runtime。

验证：

- Runtime TypeScript typecheck、build 与定向 ESLint 通过。
- Runtime 14 个测试文件、57 个测试通过；另有 1 个真实模型 smoke test 默认 skipped，未产生模型费用。
- account-api + 老 ai-gateway + 资源/协议 47 个测试文件、368 个测试通过。
- 没有执行模型调用、模型启用、CloudBase 资源写入或部署。

## 2026-08-14 — T11 Studio 内部 AgentRuntime

实现：

- 在 Studio 建立 `core`、`managed`、`byok-dev`、`capabilities`、`proposals` 分层。核心契约、错误、运行会话与 task store 均为纯 TypeScript，不依赖 Vue、Pinia、CloudBase SDK 或具体模型供应商。
- `ManagedAgentRuntime` 只调用版本化 REST 与 authenticated fetch SSE；支持 bearer token、幂等创建/取消、跨 chunk UTF-8/SSE 分帧、cursor/`Last-Event-ID` 恢复、协议解析与服务端错误码归一。
- `ByokDevAgentRuntime` 必须从独立入口显式导入并提供 `enabled: true` 与 `development/test` mode；执行器通过依赖注入接入本地 provider，runtime 本身不保存 key。生产 barrel 不导出该实现，本地执行强制平台扣点为 0。
- 五项能力目录只保留语义输入与元数据；`aiAuthoring/agentRegistry.ts` 改为 runtime adapter，不再 import 五个旧 generator 或维护客户端 prompt handler 表。旧 UI 直连调用保留到 T15 逐入口迁移。
- 框架无关 task store 支持 snapshot 覆盖恢复、offset 连续的文本增量、offset 断裂回源、resume、cancel、终态与稳定错误；提案层将完成结果转换为待确认 candidate，不具备写项目能力。
- 修正 Runtime REST 查询/取消与 SSE 的契约偏差：用户端 `GET/cancel` 现在返回完整 `AgentTaskSnapshot`；用量汇总的 `totalTokens` 包含输入、输出、缓存输入和推理四个互斥桶。

验证：

- Studio 定向 Agent/authoring 测试 3 个文件、49 个测试通过；Studio 全量 43 个测试文件、390 个测试通过。
- Studio TypeScript typecheck、定向 ESLint 与生产 build 通过；构建产物中不存在 `byok-dev` 或 `ByokDevAgentRuntime`。构建仍报告既有 Ionic CSS `:host-context`/`::root` 警告，不影响成功退出。
- Runtime TypeScript typecheck、build、定向 ESLint 与 57 个默认测试通过，真实模型 smoke test 仍 skipped。
- account-api + 老 ai-gateway + AI Runtime 回归 47 个测试文件、368 个测试通过；`git diff --check` 通过。
- 没有真实模型调用、CloudBase 写入、模型开关变更或部署。

## 2026-08-14 — T12 云乐坊 SSO v3 会话（代码态）

实现：

- Studio 固定依赖 `@yunlefun/sso@^0.6.2`，新增独立 `advjs-studio-web` 配置 fixture：业务 `appId=advjs-studio`、scope 仅 `identity:bootstrap`，production 精确 Origin/redirect 为 `https://studio.advjs.org` 与 `https://studio.advjs.org/`，development 使用独立 `https://advjs-studio.yunle.localhost:3455/`。
- 登录入口改为单一“使用云乐坊账号登录”；调用 `startSsoRedirect` 完成顶层跳转，启动阶段用 `consumeSsoRedirect` 校验 state/nonce/issuer/PKCE 交易，再通过 `adoptSsoCode` 把一次性 custom ticket 采用到 `persistence: local` 的 Studio CloudBase Auth。短信验证码表单和 `signInWithSms/getVerification` 已从普通入口移除。
- 原页面只以同源相对路径保存在当前 tab 的 `sessionStorage`，10 分钟过期；外部 URL、`/login`、损坏或过期值统一回退 `/tabs/me`。非法回跳只显示稳定错误，不恢复登录。
- `useAuthStore` 不再持久化或信任旧 `loginState` 标记，也不调用 `hasLoginState/getLoginState`；只镜像 `auth.getSession()` 返回的真实非匿名 session。旧 SDK 已持久化 session 可安全恢复，恢复成功后删除旧 UI marker。
- CloudBase 初始化显式使用 `detectSessionInUrl: false`、`persistence: local`、region 和可选 publishable Web Key；服务端密钥不进入 Vite 配置。
- Runtime access-token getter 从 `getSession()` 读取短期 token，在到期前刷新；刷新/匿名/缺失 session 时先触发显式 session-expired handler，再由 managed transport 映射为 `unauthenticated`，模型请求不会发出。
- Provider 的签名 production/development Registry artifact 没有手工修改。`advjs-studio-web` 的正式 Registry apply 属于 T19 的独立授权门禁，真实 SSO smoke 属于 T20。

验证：

- SSO/session 测试覆盖精确配置、成功采用、原页面恢复、state/nonce 交易缺失、过期 code、匿名 session、旧会话迁移、token 刷新成功/失败、外部 return URL 与普通入口无短信登录。
- Studio 全量 44 个测试文件、398 个测试通过；TypeScript typecheck、定向 ESLint 和生产 build 通过。
- 生产 Login chunk 不含 `signInWithSms` 或 `getVerification`；构建仍只有既有 Ionic CSS `:host-context`/`::root` 警告。
- 没有修改/发布 SSO Registry、没有真实登录、CloudBase 写入、模型调用或部署。

## 2026-08-14 — T13 Studio AI 任务轨道与点数状态

实现：

- 新增严格解析的 `ManagedAgentPointsClient`，只通过与 Runtime 相同的 bearer authenticated transport 读取 `/v1/points/me`；账户返回的 `activeTask` 只作为服务端任务 ID 真源，再通过任务快照与 SSE 恢复完整状态。
- 新增 Pinia managed-agent 控制器封装纯 TypeScript `AgentTaskStore`：页面初始化读取点数和 active task，页面重新可见、窗口重新聚焦和网络恢复时主动回源；断线后使用 cursor 恢复 SSE，offset 不连续仍由底层 store 回源快照。
- 客户端暴露 `canStartTask` 并在服务端返回 active task 时禁用新提交，但 Runtime/account-api 继续作为并发 1、余额和额度的最终裁决者。取消、重连、终态保留和结算后点数刷新均走统一状态层，供 T15 的五个创作入口复用。
- 增加桌面 304px 右侧任务轨和窄屏/移动端 bottom sheet。控制台用 Ink/Purple/Gold/Mint/Red/Paper 色板与单一金色“任务磁带线”表达生命周期，展示可用、预占、预计上限、实际点数、流式文本与提案摘要；明确“预占暂时冻结”和“可用候选生成即计费，应用不重复收费”。
- 授权、排队、生成、结算、完成、取消、内容阻止、失败和需对账均有文字状态；错误只显示稳定用户文案和公开 requestId，不渲染服务端原始 message、审核规则、供应商细节或凭证。
- 任务状态使用 polite live region，主要操作满足至少 44px 触控目标，键盘焦点清晰，状态不只依赖颜色，循环信号遵循 `prefers-reduced-motion`。
- 修正 Tabs shell 的 Ionic 定位上下文：主区域现在以 relative/overflow boundary 约束绝对定位页面，避免桌面左导航和右任务轨被子页面覆盖。
- Runtime URL 必须显式配置 `VITE_ADVJS_AI_RUNTIME_URL`；生产只接受 HTTPS，本地仅允许 `localhost`/`.localhost` HTTP，缺失或非法值 fail closed。

验证：

- 新增 6 项协议/状态/UI 测试，覆盖点数解析、URL 安全边界、刷新恢复、SSE resume、并发 1、取消释放、流式/点数/计费说明、余额不足和内部错误脱敏。
- Studio 全量 45 个测试文件、404 个测试通过；TypeScript typecheck、定向 ESLint、生产 build 与 `git diff --check` 通过。
- 生产构建产物不含 `byok-dev`、`ByokDevAgentRuntime` 或测试私有错误文本；构建仍只有既有 Ionic CSS `:host-context`/`::root` 警告。
- 使用本地 Vite + headless Chromium 实际检查 1440×1000 桌面任务轨、390×844 移动 dock 与点击打开的 bottom sheet；均未访问线上服务。
- 没有真实登录、模型调用、CloudBase 写入、SSO Registry 修改或部署。

## 2026-08-14 — T14 提案预览、应用与撤销

实现：

- 新增框架无关的提案审阅服务与 Studio `ProjectWorkspace` 适配器。项目 revision 由排序后的完整文本文件映射计算 SHA-256；候选必须同时绑定当前 `projectId` 与 `projectRevision`，应用前再次读取工作区并拒绝基线漂移。
- 统一 proposal model 展示摘要、计费点数、影响文件、结构化操作和逐文件 before/after diff。Runtime 到达的 proposal 只进入 Pinia 候选状态，只有用户点击确认后才调用写入事务。
- patch 先通过 `@advjs/core` 的路径与操作校验应用到内存副本，再使用 `compileProject` 校验。项目原本已有的阻断诊断不会错误阻止无关改动，但提案新引入的阻断诊断会在写盘前拒绝。
- 多文件提交在每次写入前重新比对原始字节；任一写入失败会按反序恢复所有已触及文件。成功应用返回精确 before/after 快照与 revision，撤销前要求项目仍处于应用后的 revision，避免覆盖用户后续编辑。
- 增加桌面居中、移动端全屏的审阅 modal，包含清晰的“应用提案”、安全撤销、冲突、编译诊断和稳定错误状态；没有自动应用路径，也不展示服务端原始异常。
- COS 只读项目和未提供可写 filesystem 的工作区在本阶段 fail closed，不尝试旁路写入。

验证：

- 新增 6 项提案事务测试，覆盖预览不写盘、显式应用、精确撤销、非法路径、基线冲突、新增编译错误、多文件部分失败回滚和撤销冲突。
- Studio 全量 46 个测试文件、410 个测试通过；TypeScript typecheck、定向 ESLint、生产 build 与 `git diff --check` 通过。
- 构建仍只有既有 Ionic CSS `:host-context`/`::root` 警告；没有真实模型调用、CloudBase 写入、SSO Registry 修改或部署。

## 2026-08-15 — T15–T16 Studio 托管能力迁移与生产 BYOK 隔离

实现：

- 五个创作入口统一通过 `useManagedAuthoring` 启动 `ManagedAgentRuntime`。大纲、章节草稿进入提案审阅；情节建议和角色扮演以服务端校验后的结构化结果显示在任务轨；一致性检查保持只读诊断。
- 能力上下文按服务端同一白名单裁剪，只发送所选章节、角色卡与必要的 world/outline 文件；项目 revision 仍由完整文本项目计算，缺失已保存来源时 fail closed。
- Studio AI 设置页只展示托管服务状态、AI 点数、并发/额度、结算和隐私说明。生产路由、菜单与中英文文案不再提供模型供应商、模型、Base URL 或 API Key 配置。
- 通用聊天、角色聊天、群聊、智能素材导入、图片生成、云端 TTS/ASR 等未登记入口从生产路由或页面移除；内容抽取、日记和世界事件 fail closed；Embedding 只保留不调用供应商的本地关键词回退。
- 旧 `advjs-studio-ai` 凭证只通过启动时单向 `removeItem` 删除，不读取、解析、记录或上传。开发 BYOK Runtime 只存在于显式 `agent/byok-dev` 入口，生产 barrel 不导出。
- Vite 生产守卫同时扫描模块图和最终 JavaScript，禁止旧 AI store/client、byok-dev、供应商直连域名和凭证字段名。源码边界测试锁定五个入口、生产路由、设置页、文案和清理顺序。
- 新增完整 AI 能力盘点与用户边界文档；明确 Studio 是云乐坊 SSO + AI 点数的托管 SaaS，Editor 是开放的本地 Codex/Skills/MCP 与 BYOK 工作流。
- 首期范围按已确认的简化策略收口：只有五项已登记文本能力进入 Gateway；内容抽取和 Embedding 不为凑齐表面能力而复用错误价格，待各自登记 capability、上下文、安全规则与价格后再开放。

验证：

- Studio 全量 48 个测试文件、422 个测试通过；TypeScript typecheck 与全量 ESLint 通过。
- Studio 生产 build 通过，静态守卫未发现旧 BYOK 模块、直连客户端、供应商域名或凭证字段；额外真实密钥模式扫描零命中。
- 文档检查通过（36 个文件），`git diff --check` 通过。
- 构建仍只有既有 Ionic CSS `:host-context`/`::root` 警告；没有真实登录、模型调用、CloudBase 写入、账务操作、SSO Registry 修改或部署。

## 2026-08-15 — T17 Admin AI 运营控制面

实现：

- Runtime 新增受独立服务身份保护的任务查询和每日运营概览。任务 DTO 只包含 task/request/user/app/capability/model/status、四类 token、供应商成本、点数和时间，不返回创作输入、项目文件、候选正文、原始流、lease 或供应商 requestId。
- 查询支持东八区日期、用户、appId、能力、模型、状态与 offset cursor；概览同时返回 active policy、Beta 点数准入说明、单用户限额、平台预算、状态分布与 reconcile 队列。
- kill switch、模型/能力开关和人工 reconcile 强制要求操作原因、Human operator 与 `Idempotency-Key`；Runtime 同时记录实际管理员和调用服务身份，重复提交返回同一语义结果，冲突复用返回 409。
- Admin 增加 `/ai-runtime` 页面、类型、BFF 与服务端 adapter。`ai-runtime:view` 可授予 admin；`ai-runtime:manage` 为 owner-only。只读和写路由在服务端鉴权中间件逐项登记，未知 API 继续失败关闭。
- AI 点数 Beta 授权、人工调整与按任务退款只调用 account-api 的专用私有 action，并使用独立 `accountApiToken`；Admin 不直接更新账户集合或既有流水。所有操作包含 operator、reason、task（退款/对账）和稳定幂等键。
- 页面展示任务、成本、用量、预算、策略、账户与追加式流水；危险操作要求明确原因并精确输入 `AI RUNTIME`、taskId 或用户 UID。重试沿用打开对话框时生成的同一幂等键。
- Beta 准入继续以 AI 点数授权为真源，不新建第二套易漂移白名单。Runtime 管理 token 与 account-api AI 点数 token 分离，均只存在于 Admin 服务端 runtime config。

验证：

- Runtime TypeScript typecheck、build、定向 ESLint、`git diff --check` 与全部 60 个默认测试通过；真实模型 smoke test仍保持 skipped。
- Admin 全部 571 个测试、全量 ESLint、生产 build、`git diff --check` 通过；客户端构建产物未发现管理 token 配置名或测试密钥。
- Admin `vue-tsc --noEmit` 仍只报告仓库既有的 3 条 GitHub secrets 类型错误，均位于本次未修改文件；新增 AI Runtime 页面、BFF、类型和 adapter 没有类型错误。
- 未调用真实 Runtime、CloudBase、account-api、模型、SSO Registry 或部署接口，没有账务写入或真实费用。

## 2026-08-15 — T18 跨仓库验证与上线资料

实现：

- Studio、Runtime 与 Admin 保存同一份字节级 Agent Runtime v1 fixture，并分别锁定解析结果与哈希。原始 JSON SHA-256 为 `49e09a599a19c3c20e6e0afee1e3a6d9883cb0f77774302a150dab5c21477b86`。
- Studio 新增 fake 完整旅程：以 SSO access token 创建幂等任务，消费首段 SSE，在快照 503 后使用 cursor 与 `Last-Event-ID` 恢复，接收完成快照、候选和结算，再验证用户确认前零写入、应用提案与精确撤销。
- 新增验收矩阵，逐项绑定余额不足、并发任务、每日任务/点数限制、平台预算熔断、取消、自动重试、解析失败、安全阻止和 `reconcile_required` 的业务测试。余额不足额外补充“任务预占失败且账户/每日额度/流水不变”的账本用例。
- 新增 `verify-managed-ai-release.mjs` 只读检查：三端 fixture 字节/哈希一致、synthetic 数据约定、真实密钥形态、手机号/邮箱、测试 token、供应商直连域名和 public build BYOK 标记。脚本默认不联网、不写云资源，`--require-builds` 强制三个构建目录存在。
- 生成 staging、回滚、对账 runbook、告警清单和生产门禁检查表。CloudBase 资源、SSO Registry、account-api、Runtime、模型真实费用、Admin 与 Beta 放量继续是互相独立的确认门禁。
- T0 的 Editor workspace 文件与新增适配器仍全部存在，相关 seam 测试保持通过；没有覆盖或回退用户原有 Editor 改动。

验证：

- ADV.JS Studio 49 个测试文件、424 个测试通过；根 TypeScript typecheck、全量 ESLint（0 error，保留既有 UnoCSS 顺序 warning）、Studio 生产 build、文档检查和 `git diff --check` 通过。
- 三仓构建产物扫描覆盖 1927 个文本文件，没有发现真实密钥形态、测试 token、供应商直连或生产 BYOK 标记；三份 fixture 字节一致。
- Editor workspace seam 3/3 通过；老 `ai-gateway` 独立回归 11 个文件、65 个测试通过。
- `www.yunle.fun` 全量 188 个测试文件、1170 个测试通过；Nuxt typecheck/build、全量 ESLint 和 `git diff --check` 通过。Runtime 独立 typecheck/build 通过，60 个默认测试通过，1 个真实模型 smoke 保持 skipped。
- 云站全量测试首次运行时，production Registry 的 source 与 dist 恰在并发复制窗口被读取，出现 1 次瞬时字节差异；构建完成后四个 registry 文件源/产物哈希一致，定向 13/13 与全量 1170/1170 重跑通过。未修改、生成或发布 Registry。
- Admin 572 个测试、全量 ESLint、生产 build 与 `git diff --check` 通过。`vue-tsc --noEmit` 仍只有既有 GitHub secrets 适配的 3 条类型错误；本次 AI Runtime 页面、BFF、类型与 adapter 没有新增类型错误。
- 没有访问真实模型、生产 SSO 或 CloudBase，没有部署、启用模型、发放/调整点数或产生真实费用。T19-T21 未开始。

## 2026-08-15 — T19 CloudBase 与 SSO 只读 preflight

实现与核对：

- CloudBase CLI 管理身份恢复；所有读取都显式使用 canonical EnvId。Production `yunlefun-8g7ybcxc7345c490` 与 Development `yunlefun-dev-0ge03bdod37093d1` 均位于 `ap-shanghai` 且状态正常。
- 资源脚本新增严格只读 `--inspect`，与 `--apply` 互斥。Production / Development 的 live inspect 都确认五个目标集合不存在，安全 plan 为新建 5 个空集合、设置 5 个 `ADMINONLY` ACL、创建 10 个索引，未发现未知 AI 集合或索引漂移。
- Production 标准版当前周期 330,000 资源点、已用 195,350.41，AI 模块用量为 0；另有有效 10,000 点资源包，历史 Token 免费包均已过期。
- Production `cloudbase` group 已启用普通 `deepseek-v4-flash`；managed catalog 同时提供但尚未启用原厂直供 `deepseek-v4-flash-202605`。首期预案改为复用已启用普通版本，不额外扩大模型写入范围。
- Production 现有三个正常 CloudRun 服务，没有 `advjs-ai-runtime`；现有 container `api` 为 1 CPU / 2 GiB、MinNum 0、MaxNum 5。新 Runtime 继续建议独立服务和 `/advjs-ai-runtime` 精确网关路径。
- CloudBase Web Auth 的 username/email/phone provider 和 publishable Web Key 元数据正常，但安全域名缺少 `studio.advjs.org`；后续 Gate A 只增加该精确域名。
- Live SSO Registry 确认 Production generation 7、Development generation 12 均不存在 `advjs-studio-web`，拟议变更仍是 additive。Production checked-in generation 6 落后于 live generation 7，draft 前必须先同步 active artifact。
- 只读 `DescribeAIModels` 意外返回既有 custom model group 的明文供应商 API Key；未在文档记录或使用该值。该 group 被老 `ai-gateway` 三个应用引用，需先在供应商侧协调轮换，再继续任何模型或部署写操作。

验证与门禁：

- 新增资源 inspect 测试 5/5、定向 ESLint、ADV.JS 文档检查和 `git diff --check` 通过；CloudBase 专项语义审查确认 inspect 路径只读、目标先校验且与 apply 互斥，未发现适用规则违规。
- 没有创建集合、修改 ACL/索引或安全域名，没有保存/发布 SSO Registry，没有启用模型、部署、调用模型、产生费用或操作 AI 点数。
- T19 仍未完成：DeepSeek Key 轮换、Gate A 与 Gate B 分别授权及 apply/read-back 尚待处理。

## 2026-08-15 — T20 本地生产装配（无云写入）

实现：

- Runtime 入口改为 fail-closed production composition：显式读取 canonical EnvId、精确 HTTPS Origin、独立 Admin/account-api 凭据和受范围约束的生命周期参数；默认装配 CloudBase repositories、CloudBase access-token verifier、account-api 私有 action、`cloudbase` group 模型执行器和服务端能力目录。
- `createFakeRuntimeDependencies()` 只在 `ADVJS_AI_RUNTIME_MODE=local-fake` 下使用。生产缺少 EnvId、Origin 或强凭据时在任何业务处理前失败，不回退 Fake。
- 新增固定 `advjs-ai-runtime-admin` audience 的 Admin Bearer verifier；凭据以 SHA-256 等长摘要做常量时间比较，配置层强制 Admin 与 account-api token 分离。
- 新增非重叠后台生命周期：进程启动后串行 drain queued task、周期 sweep，并在 SIGTERM/SIGINT 停止继续调度；轮询、批量、lease、stale 与 sweep 参数全部有上下界。
- 新任务写入 `createdAt + 7d` 的 `expiresAt`；sweep 原子删除已过期且已解决的 completed/cancelled/blocked/failed 任务正文，但绝不自动删除 `reconcile_required`，避免丢失未决账务恢复入口。usage 与点数流水继续长期保留且不保存正文。
- 默认 policy 构造改为全局、模型和五项 capability 全部关闭；增加固定 `deepseek-v4-flash` 价格快照的 bootstrap manifest，以及默认离线、apply 需环境/写入/production 三重精确确认且永不覆盖既有 policy 的脚本。
- 增加 Runtime `.env.example`，只列非敏感配置名与占位值；生产日志不输出 prompt、正文、token 或原始 uid，uid 仅记录短哈希。

验证与门禁：

- Runtime TypeScript typecheck、build、16 个测试文件 67/67 通过，真实模型 smoke 仍 skipped；新增生产配置、管理鉴权、生命周期、CloudBase 原子过期清理测试通过。
- policy bootstrap 与资源脚本定向 7/7 测试通过；policy 测试仅运行无网络 manifest 和写入门禁失败路径。
- `www.yunle.fun` 全量 189 个测试文件、1173/1173 通过；定向 ESLint 与两仓 `git diff --check` 通过，ADV.JS 文档检查 36/36 通过。
- 本阶段没有调用 CloudBase/SSO/模型，没有创建资源、bootstrap policy、部署服务、操作点数或产生费用。T20 部署 Gate C–F 仍未授权，任务不能标记完成。
