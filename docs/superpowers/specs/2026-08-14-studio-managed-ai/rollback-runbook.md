# 回滚 Runbook

回滚原则：先停止新增成本，再回滚无状态代码；账本与审计数据只追加修正，绝不删除或覆盖。

## 触发条件

- 认证/CORS 越权、密钥或正文泄露；
- 实际供应商成本、用户扣点或平台预算异常；
- 任务成功率骤降、解析/安全失败激增、SSE 大面积不可恢复；
- `reconcile_required` 超阈值或 account-api/Runtime 版本不兼容。

## 操作顺序

1. 通过 Runtime 管理接口将全局 `enabled=false`，填写原因、操作者和稳定幂等键；读回策略确认生效。
2. 保留所有任务、usage、预算、账户和交易快照，记录时间窗、版本与关联 taskId；不要清集合或直接改文档。
3. 等待/终止 Worker 新领取；对 running/settling 任务按状态机处理。usage 或结算未知时进入 `reconcile_required`，不得假定为 0。
4. 回滚 Studio/Admin/Runtime 到已验证版本；若 account-api 契约不兼容，最后回滚 account-api，期间保持 AI 关闭。
5. 重新运行健康、认证、CORS、老 `ai-gateway` 与只读账本回归。确认没有新模型调用后再判断服务恢复。
6. 错扣只通过 `refundAiPointsForTask`；其他余额修正只通过带原因的 `adjustAiPointsForUser`，都保留不可变流水。
7. 形成事故记录：影响窗口、taskId、用户数、供应商成本、点数差异、操作审计和修复版本。

恢复开放需要新的变更确认；回滚本身不自动授权重新启用模型或 Beta 流量。
