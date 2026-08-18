# T19 CloudBase 与 SSO 只读预检

更新时间：2026-08-15（Asia/Shanghai）

## 1. 当前授权与结论

本轮用户确认只授权 T19 的只读 preflight、成本核算和精确变更清单。尚未授权：

- 创建或修改 CloudBase 资源；
- 保存、审批或发布 SSO Registry 草稿；
- 部署 account-api、Runtime、Admin 或 Studio；
- 启用模型、运行真实模型、产生费用；
- 发放、扣除或调整 AI 点数。

CloudBase CLI 管理身份已恢复，本地 manifest、SSO fixture、代码门禁、套餐、模型目录、CloudRun、Auth/Web Key、数据库和 active SSO Registry 均已只读核对。没有执行任何云端写入。T19 仍不能标记完成，因为 Gate A 与 Gate B 尚未取得独立写入授权，且部署前代码阻断项尚未处理。

只读查询期间发现一项独立安全事件：CloudBase `DescribeAIModels` 返回了某个既有 custom model group 的明文供应商 API Key。本文不记录该值，后续查询必须先在本地筛选允许字段。该 Key 被老 `ai-gateway` 的三个应用配置引用，不能无协调直接删除；必须在供应商侧轮换并同步更新 CloudBase custom group。

## 2. 目标环境

| 项目             | Production                               | Development                                 |
| ---------------- | ---------------------------------------- | ------------------------------------------- |
| CloudBase EnvId  | `yunlefun-8g7ybcxc7345c490`              | `yunlefun-dev-0ge03bdod37093d1`             |
| Region           | `ap-shanghai`                            | `ap-shanghai`                               |
| Model GroupName  | `cloudbase`                              | `cloudbase`                                 |
| Studio Origin    | `https://studio.advjs.org`               | `https://advjs-studio.yunle.localhost:3455` |
| Runtime 建议入口 | `https://api.yunle.fun/advjs-ai-runtime` | 待 development 网关实态确认                 |

Production EnvId 与 region 已在 `www.yunle.fun/cloudbaserc.json`、Admin runtime config 和 Studio 默认配置中交叉核对。后续所有管理操作必须继续传完整 EnvId，不接受别名或模糊环境名。

Production 为预付费标准版，NoSQL 实例 `tnt-2la6mncfo` 状态 `RUNNING`；Development 为体验版，NoSQL 实例 `tnt-5h8pxtjg4` 状态 `RUNNING`。

## 3. CloudBase 资源 diff

默认 manifest 命令已运行，结果为 `network=false`、`applied=false`，只声明以下五个集合：

| 集合                    | 权限        | 保留策略  | 索引                                                        |
| ----------------------- | ----------- | --------- | ----------------------------------------------------------- |
| `ai_point_accounts`     | `ADMINONLY` | 永久账本  | `user_id_unique(userId ASC)` 唯一                           |
| `ai_point_transactions` | `ADMINONLY` | 永久账本  | `user_created`、`task_created`、`idempotency_key`           |
| `ai_usage_records`      | `ADMINONLY` | 永久账本  | `task_attempt_unique` 唯一、`user_created`、`model_created` |
| `ai_tasks`              | `ADMINONLY` | 目标 7 天 | `user_status_created`、`status_lease_expiry`、`expires_at`  |
| `ai_runtime_control`    | `ADMINONLY` | 控制面    | 无额外索引                                                  |

资源脚本已补充严格只读的 `--inspect` 模式。它会读取集合、ACL 和索引并输出 `remoteCollections + manifests + plan`，但不会调用任何创建或修改 API；`--inspect` 与 `--apply` 互斥。已执行的 Production 预检命令为：

```bash
node scripts/ensure-ai-runtime-resources.mjs \
  --inspect \
  --environment=production \
  --env-id=yunlefun-8g7ybcxc7345c490 \
  --instance-id=tnt-2la6mncfo \
  --region=ap-shanghai \
  --config-file=cloudbaserc.json
```

Production 与 Development 的 live inspect 均返回：

- `remoteCollections=[]`，五个集合都不存在；
- `plan.safe=true`、`unsafe=[]`；
- 精确动作是新建 5 个空集合、设置 5 个 `ADMINONLY` ACL、创建 10 个索引；
- 不修改现有集合，不迁移数据，不启用应用流量。

当前还有一项保留策略缺口：manifest 的 `retention: 7d` 只是声明性元数据，脚本只创建 `expires_at` 索引；任务记录目前也没有写入 `expiresAt`，没有自动清理器。因为任务记录含输入上下文和流式正文，这项必须在部署前补齐，不能把索引误当成已生效的 7 天清理。

## 4. SSO Registry 精确新增项

现有 `studio-web` / `appId=studio` 是 `studio.yunyoujun.cn` 的旧客户端，保持不变。只读导出的 Production generation 7 / policy `2026-08-14.1` 与 Development generation 12 / policy `2026-08-03.2-dev` 均不存在 `advjs-studio-web`，因此拟议变更是新增客户端，不是覆盖旧客户端。

Production checked-in artifact 仍是 generation 6，落后于 active generation 7。创建 Registry draft 前必须先同步最新 active artifact，不能基于旧 generation 直接发布。

Production 拟新增：

```json
{
  "clientId": "advjs-studio-web",
  "appId": "advjs-studio",
  "displayName": "ADV.JS Studio",
  "iconUrl": "https://studio.advjs.org/favicon.ico",
  "status": "active",
  "adapters": [{
    "kind": "web-sso",
    "consent": "trusted",
    "allowedScopes": ["identity:bootstrap"],
    "origins": ["https://studio.advjs.org"],
    "redirectUris": ["https://studio.advjs.org/"]
  }]
}
```

Development 只替换为：

- `iconUrl`: `https://advjs-studio.yunle.localhost:3455/favicon.ico`
- `origins`: `https://advjs-studio.yunle.localhost:3455`
- `redirectUris`: `https://advjs-studio.yunle.localhost:3455/`

会话继续使用 `startSsoRedirect -> consumeSsoRedirect -> adoptSsoCode -> CloudBase getSession()`；生产 SSO origin 为 `https://www.yunle.fun`，code exchange 为 `https://api.yunle.fun/sso-ticket`。不恢复 Studio 独立短信登录，不给浏览器新增服务凭证，不增加 wildcard Origin、redirect URI 或 scope。

Registry 写入必须走现有 draft、diff、production approval、CI release 和 read-back 流程。仅查看上述 diff 不构成保存草稿或发布授权。

CloudBase Web Auth 的 username、email、phone provider 当前均已启用，且存在一枚有效期至 2099 年的 publishable Web Key；本轮只读取了 Key 的元数据，没有输出 Key 值。安全域名目前包含 `*.yunle.fun` 和 `zero-echo.advjs.org`，但不包含 `studio.advjs.org`。Gate A 需增加精确安全域名 `studio.advjs.org`，不得增加 `*.advjs.org`。

## 5. 模型、AI 点数与价格快照

腾讯云公开资源点规则为 `1000 资源点 = ¥1`；当前产品设计为 `1 AI 点 = ¥0.001`。因此在 Beta 的 `userRateBps=10000`、固定费 0、最低费 0 下：

```text
1 CloudBase 资源点 = 1 AI 点
模型每百万 Token 的资源点价格 = 用户每百万 Token 的 AI 点价格
```

Live `DescribeAIModels` 显示 Production `cloudbase` group 已启用普通 `deepseek-v4-flash`，但未启用原厂直供 `deepseek-v4-flash-202605`。Live managed catalog 的普通版本价格为输入 ¥1、输出 ¥2、缓存命中 ¥0.2/百万 Token；原厂直供版本为输入 ¥1、输出 ¥2、缓存命中 ¥0.02/百万 Token。

首期建议直接使用已经启用的普通 `deepseek-v4-flash`，避免额外增加“启用模型”写操作。两者在短任务、低缓存命中时输入输出价格一致；原厂直供版本可在 Beta 数据表明确收益后另走 Gate E 启用。

若 live catalog 一致，建议价格快照为：

```text
version = cloudbase_deepseek-v4-flash_2026-08-15_v1
billingUnit = 1,000,000
inputMicroCnyPerUnit = 1,000,000
outputMicroCnyPerUnit = 2,000,000
cachedInputMicroCnyPerUnit = 200,000
reasoningMicroCnyPerUnit = 2,000,000
userRateBps = 10,000
fixedCapabilityFeeMicroPoints = 0
minimumChargeMicroPoints = 0
```

`reasoning` 按输出价格计，因为 Runtime 会从 completion token 中拆出 reasoning bucket。缺少该价格会在出现 reasoning usage 时使结算失败。

Production 当前计费周期为 2026-07-22 至 2026-08-21：标准版共有 330,000 资源点，已使用 195,350.41，剩余约 134,649.59；AI 模块当前用量为 0。另有 10,000 点资源包，有效期至 2027-08-14。历史 Token 免费包都已过期，没有可依赖的有效存量 Token 包。

按无缓存的能力上限估算：

| 能力                     | 最大输入/输出 Token | 单次用户预占上限 |
| ------------------------ | ------------------- | ---------------- |
| `generate-outline`       | 6000 / 2000         | 10 AI 点         |
| `generate-chapter-draft` | 8000 / 2500         | 13 AI 点         |
| `suggest-plot`           | 6000 / 1200         | 8.4 AI 点        |
| `simulate-roleplay`      | 6000 / 2000         | 10 AI 点         |
| `check-consistency`      | 8000 / 1500         | 11 AI 点         |

因此首个 Beta 能力建议只开 `suggest-plot`。20 tasks/day 对应最多约 168 AI 点，先于 500 AI points/day 额度触顶；平台为最多两次自动 attempt 预留约 16.8 AI 点等值成本/任务。真实收费以供应商 usage 和调用时不可变价格快照为准。

公开资料只用于预估，不能替代 live API：

- [CloudBase 资源点与 Token 价格](https://cloud.tencent.com/document/product/876/127357)
- [CloudBase 资源点换算与扣费顺序](https://cloud.tencent.com/document/product/876/56375)
- [存量 CloudBase Run 价格](https://cloud.tencent.com/document/product/1243/47823//)

## 6. CloudBase Run 建议

建议创建独立服务 `advjs-ai-runtime`，通过现有 `api.yunle.fun` 网关的精确路径 `/advjs-ai-runtime` 暴露，而不是覆盖当前根路径 CloudRun 服务 `api`。这样 Studio 的 `VITE_ADVJS_AI_RUNTIME_URL` 可以设为 `https://api.yunle.fun/advjs-ai-runtime`，现有 CSP 已允许 `https://api.yunle.fun`。

Production 当前有三个正常服务：container `api`、container `play-game-server`、function `support-api`；不存在 `advjs-ai-runtime`。现有 `api` 是 1 CPU / 2 GiB、MinNum 0、MaxNum 5 的 public container。新 Runtime 应保持独立服务和独立回滚边界。

初始规格建议：

- 0.5 CPU、1 GiB；MinNum 1、MaxNum 3；
- public ingress，但应用层只允许 `https://studio.advjs.org` 精确 CORS；
- TLS 复用 `api.yunle.fun`，不新增 wildcard；
- Runtime 无状态，任务、lease、usage 和 policy 全部落 CloudBase 数据库；
- SSE 需要禁用代理缓冲并验证长连接超时；
- kill switch 初始及部署后均为关闭 AI。

按公开存量 CloudBase Run 价格，常驻 0.5 CPU + 1 GiB 的计算底价为：

```text
(0.5 × ¥0.055 + 1 × ¥0.032) × 720 小时 = ¥42.84/月
```

即约 42,840 资源点/月；不含公网出流量（公开价 ¥0.8/GB）、构建（公开价 ¥0.05/分钟）、日志、存储和模型 Token。该页面明确只适用于存量 CloudBase Run，必须在 live environment 查询后才能作为最终预算。若 MinNum 0，常驻计算底价可降为 0，但首期 SSE 和任务恢复会承担冷启动风险，因此不建议直接用于 production Beta。

## 7. 部署前代码阻断项状态

以下不是云资源 apply 内容；本地装配项已在 T20 预备阶段完成，云配置项仍会阻止部署：

1. [x] Production composition 已接入 CloudBase repositories、CloudBase Auth、account-api 和真实 model executor；Fake 只在显式 `ADVJS_AI_RUNTIME_MODE=local-fake` 下使用。
2. [x] Runtime 已增加独立 Admin Bearer verifier，固定 `advjs-ai-runtime-admin` audience，使用常量时间凭据比较，并强制与 account-api token 分离。
3. [x] 生产入口已启动非重叠 Worker/Sweeper 循环并处理 SIGTERM/SIGINT；Worker 批量上限、轮询、lease 和 sweep 间隔均由受校验配置控制。
4. [x] 新任务写入创建时间后 7 天的 `expiresAt`；sweep 只删除已解决终态正文，保留 `reconcile_required` 直到人工对账完成。
5. [ ] CloudRun service 不存在；网关 route、SSE timeout/缓冲和新服务 MinNum/MaxNum 仍需在创建前形成 apply diff。
6. [x] 已增加只新增、不覆盖的受控 policy bootstrap 脚本与清单；默认 `enabled=false`、`modelEnabled=false` 且五项能力全关。本轮仅运行离线 manifest 测试，没有执行 bootstrap apply。

## 8. 只读清单结果

1. [x] EnvId、region、套餐类型、环境与数据库状态已读回。
2. [x] 套餐资源点、资源包、历史 Token 包与本周期用量已读回。
3. [x] `cloudbase` group 的已启用模型与 managed catalog 实时价格已读回。
4. [x] CloudRun 服务列表与现有 `api` 规格已读回；新服务和 route 尚不存在。
5. [x] Production / Development 数据库 live inspect 已完成，两个环境的五个集合都不存在。
6. [x] Auth provider 与 publishable Web Key 元数据已确认；发现缺少 `studio.advjs.org` 安全域名。
7. [x] Production / Development active SSO envelope 已导出，确认是 additive client diff。
8. [x] CloudBase 专项代码审查已完成：`--inspect` 仅调用 `DescribeTable` / `DescribeDatabaseACL`，与 `--apply` 互斥，且目标参数在网络访问前完成校验；未发现适用规则违规。

下一步优先处理已暴露的既有 DeepSeek custom group Key。完成轮换后，再分别请求 Gate A“创建 CloudBase 资源”和 Gate B“保存/发布 SSO Registry”确认；两项仍不能合并授权。
