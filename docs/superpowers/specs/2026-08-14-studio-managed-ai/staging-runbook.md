# Staging Runbook

此文档是 T20 的执行资料，不授权部署。执行前必须完成 `production-gates.md` 中对应的独立确认。

## 目标顺序

1. 记录三个仓库 commit SHA、构建产物摘要、目标 CloudBase EnvId/region 与操作者。
2. 只读运行 `pnpm verify:managed-ai --require-builds` 和三仓测试矩阵。
3. 对资源 manifest 执行 dry-run；人工核对五个集合、索引、`ADMINONLY` 权限和最小权限服务身份。
4. 离线运行 `pnpm --filter @yunlefun/advjs-ai-runtime policy:manifest`，确认 policy 的 `enabled=false`、`modelEnabled=false`、五项 capability 全关，模型/价格版本与已审核快照一致。
5. 经单独授权后先部署 account-api，再部署 Runtime；policy bootstrap 必须是单独受控写入，只允许在 `policy:active` 不存在时新增，禁止覆盖。
6. Runtime 必须显式注入 canonical `ADVJS_AI_CLOUDBASE_ENV_ID`、精确 HTTPS `ADVJS_AI_ALLOWED_ORIGINS`、独立 `ADVJS_AI_ADMIN_TOKEN` 和 `ADVJS_AI_ACCOUNT_API_TOKEN`；两枚 token 不得相同。
7. 仅在前两项健康后部署 Admin；服务端分别配置 Runtime 管理凭证与 account-api AI 点数凭证，浏览器不得获得二者。
8. 经 SSO 独立授权后登记 staging 精确 Origin/redirect URI，验证 state、nonce、PKCE、匿名拒绝和 session 刷新。
9. 在 kill switch 关闭状态验证 `/health`、精确 CORS、鉴权、Admin 只读概览、策略读回和权限拒绝。
10. 使用 fake executor 验证创建、SSE resume、取消、lease 恢复、结算、提案应用/撤销和人工对账演练。
11. 只有取得“启用模型/产生真实费用”单独授权，才给独立测试账户运行一次最低上限真实 smoke；记录 model、四类 token、供应商成本、AI 点数与 taskId。
12. smoke 后立即恢复 `enabled=false`，核对任务、usage、点数账户、不可变流水和平台预算的关联。

## 放行条件

- 未授权阶段没有模型调用、点数发放、真实流量或 CloudBase 写操作。
- 健康检查不泄露环境、模型、凭证或数据库信息。
- 公开 SSE/Admin DTO/日志不包含 prompt、作品正文、供应商 requestId 或服务凭证。
- 账本差异为 0；任何不确定项进入 `reconcile_required`。
- 告警、kill switch、回滚负责人和回滚版本均已验证。

任一条件失败：停止后续步骤，保持 AI 关闭，并进入回滚或对账 runbook。
