# 对账 Runbook

目标是在不猜测 usage、不直接修改数据库的前提下，把 Runtime 任务、供应商用量和 account-api 不可变流水闭合。

## 单任务核对

1. 在 Admin 以 taskId 查询任务摘要，记录 uid、appId、状态、billingStatus、attempt、四类 token、供应商成本和点数。
2. 查询该用户账户与交易流水，按 taskId 查找 reserve、settle/release/refund/adjust；确认幂等键唯一且余额增量守恒。
3. 查询 Runtime usage attempts，按 `taskId + attempt` 核对 outcome、责任方和价格快照。供应商 requestId 只留在服务端调查面，不复制到浏览器或普通日志。
4. 若 account-api 响应曾丢失，先用原幂等键重读/重试；不要生成第二个语义相同的结算。
5. 仍无法确认实际 usage 时保持 `reconcile_required` 与用户预占，升级供应商侧核查；禁止按估算扣点或释放。
6. 已确认应结算：走 account-api 幂等 settle；已确认无用户责任：走 release；已发生错扣：走 task refund。人工差额只能追加 adjust。
7. 通过 Admin 的 reconcile 操作记录 human operator、service actor、reason、idempotency key；读回任务、账户和流水确认闭合。

## 每日批量核对

- 以 Asia/Shanghai `dateKey` 汇总 Runtime 成功/取消/失败/blocked/reconcile 状态。
- `sum(usage.providerCostMicroCny)` 应等于平台预算实际成本；pending usage 单列，不并入已确认用户收费。
- `sum(user-responsible usage.userChargeMicroPoints)` 应能按 taskId 对应 settle 流水；退款与人工调整单列。
- 账户 `available + reserved` 的变化应等于 grant、settle、release、refund、adjust 的追加式流水合计。
- 差异报告只含 uid/taskId/金额/状态等最小字段，不导出作品正文、prompt、token 或服务凭证。

对账完成标准：差异为 0，或每个差异都有负责人、原因、下一动作和审计记录；不得用删除历史流水“清零”。
