# CloudBase 后端配置（Story Market 与资源存储）

Studio 的故事市场（浏览 / 发布 / 安装 / 评价 / 创作者主页）完全跑在 CloudBase
（腾讯云开发，env：`VITE_TCB_ENV_ID`）之上，所有读写都走客户端 `@cloudbase/js-sdk`。
代码已就绪，要让市场真正「上线」只剩两件事：**建集合** + **配安全规则**。

> 这些规则不在代码里生效——CloudBase 的数据库安全规则在控制台按集合配置。
> 本目录把规则以 JSON 形式版本化，便于审阅与复制粘贴。

## 1. 需要的集合

在 CloudBase 控制台 → 数据库 → 新建以下集合（若不存在）：

| 集合                    | 用途                                    | 写入方                                                                      |
| ----------------------- | --------------------------------------- | --------------------------------------------------------------------------- |
| `advjs_marketplace`     | 市场记录（已发布的世界/故事）           | 发布者本人；`downloads`/`ratingSum`/`ratingCount` 由 `marketStats` 云函数写 |
| `advjs_reviews`         | 评价（1–5 星 + 评论 + 点赞）            | `marketStats` 云函数（评价正文 + `likes`）                                  |
| `advjs_market_installs` | 安装去重台账（每「item × 用户」一行）   | 仅 `marketStats` 云函数                                                     |
| `advjs_review_likes`    | 点赞去重台账（每「review × 用户」一行） | 仅 `marketStats` 云函数                                                     |
| `advjs_reports`         | 作品举报与人工审核队列                  | 仅 `marketStats` 云函数                                                     |
| `advjs_asset_uploads`   | 单对象上传预约、状态和审计台账          | 仅 `advjsAssets` 云函数                                                     |
| `advjs_assets`          | 账号/项目隔离的私有资源目录             | 仅 `advjsAssets` 云函数                                                     |

> `advjs_market_installs` / `advjs_review_likes` 是 `marketStats` 用来做「一次去重」
> 的台账（见 §3），客户端从不直接读写，规则设为全拒绝即可（见 §2）。

> 市场还会顺带读写这些已有集合（账号/分享/通知阶段已建）：`advjs_projects`、
> `advjs_notifications`、`advjs_shortlinks`。本次上线不改它们的规则。

## 2. 安全规则

控制台 → 数据库 → 选中集合 → 权限设置 → **自定义安全规则**，粘贴对应 JSON：

- [`security-rules/advjs_marketplace.json`](./security-rules/advjs_marketplace.json)
  - **读**：`status == 'published'` 的记录任何人可见；作者可见自己的全部（草稿/下架）。
  - **写**：仅 `ownerId == auth.uid` 的作者可创建/更新/删除自己的记录。
    创建时客户端把 `ownerId` 设为当前 uid（见 `useMarketplace.publishProject`），
    伪造他人 uid 会因 `auth.uid != ownerId` 被拒，故安全。
- [`security-rules/advjs_reviews.json`](./security-rules/advjs_reviews.json)
  - **读**：公开。
  - **写**：仅评价者本人可创建/更新/删除自己的评价（`reviewerId == auth.uid`）。
    规则保持「仅本人可写」作为纵深防御；实际写评价正文与 `likes` 改由 `marketStats`
    云函数（管理员权限，绕过规则）完成，客户端不再直接写。
- [`security-rules/advjs_market_installs.json`](./security-rules/advjs_market_installs.json)
  、[`security-rules/advjs_review_likes.json`](./security-rules/advjs_review_likes.json)
  与 [`security-rules/advjs_reports.json`](./security-rules/advjs_reports.json)
  - **读/写**：全部 `false`。这些内部台账只有 `marketStats` 云函数（管理员权限）
    访问，客户端无需也不应直接读写。控制台预置项等价物：「仅管理端可读写」。
- [`security-rules/advjs_asset_uploads.json`](./security-rules/advjs_asset_uploads.json)
  与 [`security-rules/advjs_assets.json`](./security-rules/advjs_assets.json)
  - **读/写**：全部 `false`。资源物理坐标、预约和所有权只能由 `advjsAssets` 校验后读写；客户端通过云函数取得脱敏目录记录和短期预览 URL。

### 变量名兼容性

不同 CloudBase 版本里身份变量可能是 `auth.uid` 或 `auth.openid`。本仓库的客户端用
`authStore.userInfo.uid` 作为 `ownerId`/`reviewerId`，因此规则用 `auth.uid` 与之对齐。
若你的环境只认 `auth.openid`，把规则里的 `auth.uid` 换成 `auth.openid` 即可
（前提：登录态下两者指向同一用户）。控制台预置项的等价物：

- `advjs_marketplace`：「所有用户可读，仅创建者可读写」+ 手动收紧读为 `published || owner`。
- `advjs_reviews`：「所有用户可读，仅创建者可读写」。

## 3. 跨用户计数写入（路径 B：`marketStats` 云函数）

下列字段由**非作者**写入目标文档，会被上面的「仅作者可写」规则**拒绝**。它们现在
统一走 [`marketStats`](./functions/marketStats/index.js) 云函数——以管理员权限（绕过
安全规则）做原子 `_.inc()` 自增，并带轻量校验与「一次去重」：

| 操作     | 客户端入口                          | 云函数 action        | 写入字段                                                               | 校验 / 去重                                                                  |
| -------- | ----------------------------------- | -------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 安装计数 | `useMarketplace.incrementDownloads` | `incrementDownloads` | `advjs_marketplace.downloads`                                          | 登录用户每「item × 用户」只计一次（`advjs_market_installs`）；匿名安装按次计 |
| 评分聚合 | `useMarketplace.submitReview`       | `submitReview`       | `advjs_reviews`（评价正文）+ `advjs_marketplace.ratingSum/ratingCount` | 需登录；rating 限 1–5 整数；同一用户重复评价 → 更新并按差值修正聚合          |
| 评价点赞 | `useMarketplace.likeReview`         | `likeReview`         | `advjs_reviews.likes`                                                  | 需登录；每「review × 用户」只点一次（`advjs_review_likes`），幂等            |
| 作者回复 | `useMarketplace.replyToReview`      | `replyReview`        | `advjs_reviews.authorReply`                                            | 仅作品作者；单层回复；敏感词与长度校验                                       |
| 作品举报 | `useMarketplace.reportProject`      | `reportProject`      | `advjs_reports`                                                        | 需登录；每「item × 用户」一条 pending 记录；原因枚举                         |

举报审核保持最小流程：在 `marketStats` 云函数配置逗号分隔的
`ADVJS_MODERATOR_UIDS` 环境变量，审核端调用 `moderateReport`，decision 仅支持
`dismiss` 或 `unlist`。后者把对应市场记录改为 `unlisted`，不引入额外工作流服务。

约定：

- 客户端用 `cloudApp.callFunction({ name: 'marketStats', data: { action, ... } })` 调用，
  返回 `{ error }`（失败）或 `{ ok: true, ... }`（成功），与仓库既有云函数
  （`shortlink`、`collab-auth`）的返回约定一致。
- 调用方 uid 由云函数从 `getCloudbaseContext(context).TCB_UUID` 解析，**不信任**客户端
  传入的 uid；它与 Web SDK 的 `authStore.userInfo.uid` 是同一个 CloudBase 用户。
- 评价写入整体由云函数完成（评价正文 + 聚合），保证原子且聚合差值不可伪造；因此
  `submitReview` 不再在客户端直接写 `advjs_reviews`。
- 安全规则保持「仅作者可写」，云函数是这些字段的**唯一**特权写入者。

> 去重台账缺失时（集合没建），函数会**降级为「照常累加」**而非报错中断——先把集合
> 建好，去重才会生效。

> 历史：早期「路径 A（MVP）」接受计数不累加（卡片显示 0 / —）。现已由本节的路径 B
> 取代，计数/评分会真实累加。

## 4. 云函数：目录与部署约定

本仓库的 CloudBase 云函数统一放在 **`apps/studio/cloudbase/functions/<name>/`**：

```
apps/studio/cloudbase/
├── cloudbaserc.json        # tcb CLI 部署配置（envId + functionRoot + 函数声明）
├── functions/              # 云函数源码（约定：functions/<name>/）
│   ├── .gitignore          #   忽略 node_modules（依赖部署时自动安装）
│   ├── marketStats/
│   │   ├── index.js        #   exports.main = async (event, context)（Event 函数）
│   │   └── package.json    #   声明依赖（@cloudbase/node-sdk）
│   └── advjsAssets/
│       ├── contract.js     #   输入校验、隔离对象键和脱敏投影
│       ├── index.js        #   reserve/complete/list/preview Event 函数
│       └── package.json    #   CloudBase + COS Node SDK（只运行于服务端）
├── security-rules/         # 各集合安全规则 JSON（文件名 = 集合名）
└── scripts/                # 运维脚本
    └── provision-db.js     #   建集合 + 应用安全规则（幂等，由 security-rules/ 驱动）
```

- **函数类型**：Event 函数（`exports.main(event, context)`），由 `callFunction` 触发，
  不监听端口、无需 `scf_bootstrap`。
- **运行时**：Node.js 18（`Nodejs18.15`）。运行时一经创建不可更改。
- **依赖**：Event 函数在部署时按 `package.json` 自动安装依赖，**不提交也不上传**
  `node_modules`（见 `functions/.gitignore`）。
- **functionRootPath**：指向**父目录** `apps/studio/cloudbase/functions`，不是函数子目录。

### 部署云函数（二选一）

A. CloudBase CLI（`@cloudbase/cli`，先 `tcb login`）——`cloudbaserc.json` 已声明 `marketStats`：

```
cd apps/studio/cloudbase
tcb fn deploy marketStats --force          # envId 取自 cloudbaserc.json
```

B. CloudBase MCP（若环境可用）——`functionRootPath` 指向**父目录** `functions/`：

```
manageFunctions(action="createFunction",
  func={ name: "marketStats", type: "Event", runtime: "Nodejs18.15", timeout: 30 },
  functionRootPath="<repo>/apps/studio/cloudbase/functions")
# 之后只改代码 → action="updateFunctionCode"
```

## 5. 私有素材上传：`advjsAssets`

Studio 的资源发布使用以下固定契约：

```text
local asset + assetId
  → reserveUpload
  → exact-object presigned PUT (15 min)
  → completeUpload
  → HEAD + actual SHA-256 verification
  → private content-addressed object + catalog row
```

支持的 action：

| action           | 用途                                     | 是否访问 COS |
| ---------------- | ---------------------------------------- | ------------ |
| `health`         | 登录态与函数可用性检测                   | 否           |
| `reserveUpload`  | 校验请求、写预约、签发一个对象的 PUT     | 是           |
| `completeUpload` | 校验 staging、服务端复制、登记目录       | 是           |
| `listAssets`     | 返回不含 bucket/key/owner 的项目资源记录 | 否           |
| `getPreviewUrl`  | 为调用者自己的一个资源签发短期 GET       | 是           |

函数环境变量：

```text
ADVJS_ASSET_BUCKET=yunlefun-advjs-prod-1325586649
ADVJS_ASSET_REGION=ap-shanghai
ADVJS_ASSET_PUT_TTL=900          # 可选，限制在 60—1800 秒
ADVJS_ASSET_PREVIEW_TTL=300      # 可选，限制在 60—1800 秒
ADVJS_ASSET_MAX_BYTES=...        # 可选，全局上限；仍受媒体类型上限约束
ADVJS_ASSET_MAX_PENDING=20       # 可选，每个账号的并发预约上限
```

COS 凭据只能由云函数运行角色提供，或作为服务端 `TENCENTCLOUD_SECRETID`、`TENCENTCLOUD_SECRETKEY`、`TENCENTCLOUD_SESSIONTOKEN` 注入。不得使用 `VITE_*`，不得复制到 Studio 设置、数据库记录或部署日志。

推荐桶配置：默认私有；仅函数角色可读写 `staging/accounts/*` 与 `private/accounts/*`；staging 一天生命周期清理；CORS 只允许正式 Studio Origin 与本地开发 Origin 的 `PUT,GET,HEAD`，请求头允许 `Content-Type,x-cos-meta-*`。不要把该私有桶直接绑定到公共素材 CDN。

部署前需要显式确认目标环境和桶。仓库声明函数与规则不代表线上已部署；检查后再运行：

```bash
cd apps/studio/cloudbase
tcb fn deploy advjsAssets --force

cd scripts
npm install
node provision-db.js
```

### 建集合 + 配安全规则（一条命令）

§1 的 6 个集合与 §2 的安全规则可由 `scripts/provision-db.js` 一次性创建并应用（幂等，
由 `security-rules/*.json` 驱动；凭据取自 `tcb login` 登录态或 `TENCENTCLOUD_*` 环境变量）：

```
cd apps/studio/cloudbase/scripts
npm install
node provision-db.js          # envId 取自参数 / $VITE_TCB_ENV_ID / cloudbaserc.json
```

> **市场链路的当前线上环境（`yunlefun-8g7ybcxc7345c490`）已完成既有步骤**：5 个市场集合已建，
> 其中 `advjs_reports` 于 2026-08-11 创建并设为客户端不可读写；`marketStats` 已部署评论校验、作者单层回复、
> 举报和 `dismiss` / `unlist` 审核 action，并配置审核员 UID。部署后已核对线上源码、函数状态与 CLS 执行日志，
> 无登录态探针均按预期被拒绝且举报集合保持空。新增加的 2 个资源集合与 `advjsAssets` 仍需按本节单独部署和验证；
> 函数无需对外 HTTP 访问，保持默认（仅 `callFunction`）即可。
> 其余既有云函数（`shortlink`、`collab-auth`）后续也应迁入 `functions/` 以统一管理。

## 6. 灌示例数据（可选）

不想空市场上线，可在 App 内灌几条 demo：

> 我的 → （连点版本号开启开发者选项）→ 开发者选项 → 市场工具 → **填充示例市场数据**

需先登录。示例记录 `ownerId` = 当前用户、`projectId` 以 `demo-` 开头、无安装包
（安装按钮对其禁用），可用同页「清除我的示例数据」一键删除。
这一步同时验证了发布写入路径与安全规则是否真的放行。
