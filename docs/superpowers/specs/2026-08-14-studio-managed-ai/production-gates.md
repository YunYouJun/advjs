# 生产门禁检查表

T0–T18 的代码确认不等于以下生产授权。每个门禁必须展示精确 diff/成本/回滚方案并单独取得明确确认。

## Gate A：CloudBase 资源 apply（T19）

- [ ] 确认 canonical EnvId、region、目标 GroupName、资源点/存量 credits 和实时模型价格。
- [ ] 展示资源 dry-run：仅五个集合、索引、`ADMINONLY` 权限、服务身份、保留策略。
- [ ] 验证脚本默认 dry-run，生产 `--apply` 需要环境确认与操作者记录。
- [ ] 单独授权后 apply；立即读回权限与索引，偏差即停止。

## Gate B：SSO Registry（T19）

- [ ] 展示 `advjs-studio-web` 的 production/development 精确 Origin、redirect URI、scope 与 session 方案。
- [ ] 确认不恢复 Studio 独立短信登录，不新增浏览器服务凭证。
- [ ] 单独授权后修改 Registry；读回并做非法 Origin/state/nonce 失败验证。

## Gate C：account-api 部署（T20）

- [ ] 构建与回归包含老 `ai-gateway`；变更仅增加独立 AI 点数领域与私有 action。
- [ ] 备妥前一版本；确认账本迁移只追加、不改 `wallet.js`、不直写历史流水。
- [ ] 单独授权部署；只读验证 action 权限和事务，不发放真实点数。

## Gate D：Runtime 部署（T20）

- [x] 生产依赖装配使用 CloudBase repositories/auth/account-api/model adapter；local fake 仅在显式开发模式启用。
- [ ] 配置精确 CORS、管理 audience、独立 account-api token、lease/sweeper 和最小实例。
- [x] 已准备只新增、不覆盖的 fail-closed policy bootstrap 清单与严格 apply 门禁，尚未执行云端写入。
- [ ] 单独授权后部署并 bootstrap；读回确认 policy `enabled=false` 后完成无模型健康检查。

## Gate E：模型启用与真实费用（T20）

- [ ] 展示模型 ID、GroupName、实时费率、测试 token 上限和最坏成本。
- [ ] 使用独立测试账户与最低上限；单独授权后只运行一次真实 smoke。
- [ ] 记录四类 token、供应商成本、AI 点数、taskId；之后立即关闭 AI 并对账。

## Gate F：Admin 部署（T20）

- [ ] Runtime 管理 token 与 account-api token 分离且仅在服务端；owner-only 写权限已验证。
- [ ] public build 泄露扫描通过，危险操作要求 reason、精确确认和稳定幂等键。
- [ ] 单独授权后部署；只读页面先验收，再验证受控写操作。

## Gate G：Beta 点数与逐能力开放（T21）

- [ ] 确认初始赠送、uid 范围、20 tasks/day、500 AI points/day、¥50/day 硬上限。
- [ ] 点数只通过 account-api `beta_grant` 不可变交易发放，不直接改账户文档。
- [ ] 先只对管理员开放一个低成本能力；每次开关均带审计和回滚条件。
- [ ] 观察成功、取消、解析/安全失败、成本、扣点和对账差异后再逐项扩大。

任一 gate 未勾完：保持 AI 关闭，不把前一 gate 的确认解释为后一 gate 的授权。
