# 托管 AI 自动化验收矩阵

本矩阵对应 T18。所有命令默认使用 synthetic fixture 与 fake executor，不访问真实模型、生产 SSO 或 CloudBase。

## 跨仓库闭环

| 场景             | 自动化证据                                                                                     | 核心断言                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 三端 v1 DTO 一致 | Studio `agentContracts.test.ts`、Runtime `contracts.test.ts`、Admin `ai-runtime-admin.test.ts` | 三份 JSON 字节一致，SHA-256 为 `49e09a599a19c3c20e6e0afee1e3a6d9883cb0f77774302a150dab5c21477b86`，三端独立解析 |
| 托管 AI 完整旅程 | Studio `managedAiEndToEnd.test.ts`                                                             | SSO access token、幂等创建、SSE 中断、cursor/Last-Event-ID 恢复、候选、结算、确认前零写入、应用与精确撤销       |

## 失败、限额与责任矩阵

| 场景                 | 自动化证据                                                                                                                | 期望结果                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 余额不足             | `tests/account-api/ai-points.test.js` — `rejects an insufficient task reservation...`                                     | 预占被拒，账户、每日额度和不可变流水不变                          |
| 并发任务             | account-api `allows only one concurrent active task`；Runtime worker `rejects a second active task before any model call` | 单用户只保留一个 `activeTask`，第二次请求不调用模型               |
| 日限额               | account-api `enforces twenty accepted tasks...` 与 `enforces the daily 500 AI point exposure limit`                       | 上海自然日 20 个任务、500 AI 点均由服务端原子限制                 |
| 平台预算熔断         | Runtime `budget.test.ts` — 并发预算与达到实际成本上限测试                                                                 | 预留不突破上限，实际供应商成本达到 ¥50 后硬停止，跨日恢复         |
| 用户取消             | Runtime API 幂等取消；worker queued/running 取消测试                                                                      | 排队取消释放双侧预占；已产生可用 usage 的执行中取消按实际用量结算 |
| 自动重试             | Runtime worker `charges automatic retry cost...`                                                                          | 失败 attempt 由平台承担，用户只承担最终成功 attempt               |
| 解析失败             | Runtime capability 严格 schema 测试；worker `releases user points when no usable candidate exists`                        | 不交付候选，用户预占释放，已发生供应商成本归平台                  |
| 安全阻止             | Runtime worker `blocks unsafe output before delivery...`                                                                  | 原始输出不发布，任务 `blocked`，用户不扣点，usage 归平台          |
| `reconcile_required` | Runtime worker 结算不确定/模型结果不确定测试；sweeper stuck settling；Admin reconcile API                                 | 保持预占、不猜金额、不重复模型调用，进入可审计人工队列            |

## 数据边界

- Runtime API 测试确认日志不包含创作输入或 bearer token。
- SSE 测试只解析公开 v1 event，断连不写任务；供应商 requestId 不进入公开投影。
- Admin 任务 DTO 测试拒绝创作输入、原始流和供应商 requestId。
- 三端 fixture 只使用 `project_fixture_*`、`task_fixture_*` 等固定 synthetic 标识，不含邮箱、手机号或真实密钥。
- Studio 与 Admin public build 由 `pnpm verify:managed-ai --require-builds` 扫描真实密钥形态、测试 token、供应商直连域名与生产 BYOK 标记。
