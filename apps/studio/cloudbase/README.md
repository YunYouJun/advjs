# CloudBase 后端配置（Story Market 与托管资源）

Studio 的故事市场（浏览 / 发布 / 安装 / 评价 / 创作者主页）与游戏资源 catalog 跑在 CloudBase
（腾讯云开发，env：`VITE_TCB_ENV_ID`）之上，所有读写都走客户端 `@cloudbase/js-sdk`。
数据库结构、安全规则、索引和 Event 函数均在本目录版本化。

> 这些规则不在前端代码里生效。使用 `scripts/provision-db.js` 应用版本化规则和索引，
> 不要只在控制台手工维护线上状态。

## 1. 需要的集合

在 CloudBase 控制台 → 数据库 → 新建以下集合（若不存在）：

| 集合                    | 用途                                    | 写入方                                                                      |
| ----------------------- | --------------------------------------- | --------------------------------------------------------------------------- |
| `advjs_marketplace`     | 市场记录（已发布的世界/故事）           | 发布者本人；`downloads`/`ratingSum`/`ratingCount` 由 `marketStats` 云函数写 |
| `advjs_reviews`         | 评价（1–5 星 + 评论 + 点赞）            | `marketStats` 云函数（评价正文 + `likes`）                                  |
| `advjs_market_installs` | 安装去重台账（每「item × 用户」一行）   | 仅 `marketStats` 云函数                                                     |
| `advjs_review_likes`    | 点赞去重台账（每「review × 用户」一行） | 仅 `marketStats` 云函数                                                     |
| `advjs_reports`         | 作品举报与人工审核队列                  | 仅 `marketStats` 云函数                                                     |
| `advjs_assets`          | 已完成上传的游戏资源 catalog            | 仅 `advjsAssets` 云函数                                                     |
| `advjs_asset_paths`     | owner + game + path 的并发锁            | 仅 `advjsAssets` 云函数                                                     |
| `advjs_asset_uploads`   | 短时上传预留与完成状态                  | 仅 `advjsAssets` 云函数                                                     |
| `advjs_quota_accounts`  | 用户资源配额、已用和预留字节            | 仅 `advjsAssets` 云函数                                                     |

> `advjs_market_installs` / `advjs_review_likes` 是 `marketStats` 用来做「一次去重」
> 的台账（见 §3），客户端从不直接读写，规则设为全拒绝即可（见 §2）。

`advjs_assets`、`advjs_asset_paths`、`advjs_asset_uploads`、`advjs_quota_accounts`
同样只允许管理端访问。`advjs_projects` 允许 owner 读写自己的项目，且只允许读取
`published == true` 的他人项目；资源字节与 catalog 仍不直接开放给客户端数据库查询。

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
- [`security-rules/advjs_market_installs.json`](./security-rules/advjs_market_installs.json)、
  [`security-rules/advjs_review_likes.json`](./security-rules/advjs_review_likes.json) 与
  [`security-rules/advjs_reports.json`](./security-rules/advjs_reports.json)
  - **读/写**：全部 `false`。这些内部台账只有 `marketStats` 云函数（管理员权限）
    访问，客户端无需也不应直接读写。控制台预置项等价物：「仅管理端可读写」。

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
│       ├── index.js        #   CloudBase/COS 仓储与 Event action 适配器
│       ├── service.js      #   配额、路径锁、上传完成与预览领域服务
│       ├── test/           #   不依赖真实云资源的 Node 契约测试
│       └── package.json    #   CloudBase + COS Node SDK（只运行于服务端）
├── security-rules/         # 各集合安全规则 JSON（文件名 = 集合名）
├── database-indexes.json   # 资源 catalog 的唯一索引与查询索引
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

A. CloudBase CLI（`@cloudbase/cli`，先 `tcb login`）——`cloudbaserc.json` 已声明两个函数：

```
cd apps/studio/cloudbase
tcb fn deploy marketStats --force          # envId 取自 cloudbaserc.json
tcb fn deploy advjsAssets --force
```

B. CloudBase MCP（若环境可用）——`functionRootPath` 指向**父目录** `functions/`：

```
manageFunctions(action="createFunction",
  func={ name: "marketStats", type: "Event", runtime: "Nodejs18.15", timeout: 30 },
  functionRootPath="<repo>/apps/studio/cloudbase/functions")
# 之后只改代码 → action="updateFunctionCode"
```

### 建集合 + 配安全规则和索引（一条命令）

所有集合、安全规则和 `database-indexes.json` 声明的索引可由
`scripts/provision-db.js` 一次性创建并应用（幂等；凭据取自 `tcb login` 登录态或
`TENCENTCLOUD_*` 环境变量）：

```
pnpm install
pnpm --dir apps/studio/cloudbase/scripts provision
```

> **当前线上环境（`yunlefun-8g7ybcxc7345c490`）已完成全部步骤**：市场与资源集合已建、
> 安全规则和资源索引已应用；`marketStats` 已通过 `downloads` 自增回归，`advjsAssets`
> 已通过服务身份 HEAD 新桶的健康检查。函数无需对外 HTTP 访问，保持 Event `callFunction` 即可。
> 其余既有云函数（`shortlink`、`collab-auth`）后续也应迁入 `functions/` 以统一管理。

## 5. 灌示例数据（可选）

不想空市场上线，可在 App 内灌几条 demo：

> 我的 → （连点版本号开启开发者选项）→ 开发者选项 → 市场工具 → **填充示例市场数据**

需先登录。示例记录 `ownerId` = 当前用户、`projectId` 以 `demo-` 开头、无安装包
（安装按钮对其禁用），可用同页「清除我的示例数据」一键删除。
这一步同时验证了发布写入路径与安全规则是否真的放行。

## 6. AdvJS 托管游戏资源

新上传统一进入私有桶 `yunlefun-advjs-prod-1325586649`（`ap-shanghai`）。历史桶
`advjs-1325586649`（`ap-guangzhou`）保持不变，不作为新写入目标，也不在本次接入中迁移。

浏览器不再配置或保存 COS SecretId/SecretKey。上传链路为：

1. Studio 使用 CloudBase 登录态调用 `advjsAssets.reserveUpload`。
2. 云函数从可信上下文派生 uid，校验 `adv-projects/<gameId>/<path>`、MIME、最大 512 MiB
   和用户配额，并在事务内预留路径与字节。
3. 浏览器只获得 15 分钟、限定到单个 staging 对象、固定 Content-Type/Content-Length 的 PUT URL。
4. `finalizeUpload` 对 HEAD 结果、字节、类型与 SHA-256 做完整性校验，再写入私有稳定 Key 与 catalog。
5. Drive 从 `advjs_assets` 读取完成态资源；用户选中资源时，Drive 服务端调用
   `createDrivePreview` 换取 5 分钟签名预览 URL。

Catalog 同时保存 COS `versionId`，预览固定到该不可变版本；provider copy 成功但数据库事务失败时，
旧 catalog 仍指向旧版本。Catalog 提交成功后才尽力删除 staging，失败时可安全重试，生命周期负责兜底回收。

桶策略要求：默认私有、版本控制 Enabled、AES256 默认加密；清理未完成分片和 7 天 staging，
保留 private/derived 非当前版本 30 天，绝不自动过期 `published/sha256/`。CORS 仅允许
`https://studio.advjs.org` 的 PUT/GET/HEAD 与 `https://drive.yunle.fun` 的 GET/HEAD。

`advjsAssets` 使用平台运行身份访问 COS，不配置浏览器云密钥。仅服务端环境变量：

| 变量                        | 说明                                     |
| --------------------------- | ---------------------------------------- |
| `ADVJS_ASSET_BUCKET`        | `yunlefun-advjs-prod-1325586649`         |
| `ADVJS_ASSET_REGION`        | `ap-shanghai`                            |
| `ADVJS_DEFAULT_QUOTA_BYTES` | 默认每用户 5 GiB，可由 quota 文档覆盖    |
| `ADVJS_DRIVE_PREVIEW_TOKEN` | Drive 与函数共享的高熵、可轮换服务端密钥 |

部署后使用 `serviceHealth`（必须携带 preview token）验证函数运行身份可以 HEAD 桶；不要通过
函数详情、日志或前端配置回显 token。删除只允许未发布、无活动消费者引用的 private 源对象，
并且永不删除 immutable published copy。

## 7. Studio Pages 生产发布

Cloudflare Pages 项目名为 `advjs-studio`，生产分支为 `dev`。Monorepo 中的 Studio 依赖
`packages/*` 构建产物，平台构建配置必须保持为：

| 配置        | 值                                          |
| ----------- | ------------------------------------------- |
| 构建命令    | `pnpm run build && pnpm run studio:build`   |
| 输出目录    | `apps/studio/dist`                          |
| 生产环境 ID | `VITE_TCB_ENV_ID=yunlefun-8g7ybcxc7345c490` |

不能只执行 `pnpm run studio:build`，否则干净构建环境中尚未生成 `@advjs/types`、
`@advjs/core` 与 `@advjs/parser` 的类型和入口文件。紧急恢复时可以在本地完成同一构建顺序后，
将 `apps/studio/dist` 直传到现有 `advjs-studio` 项目；不要新建同名站点或绕过
`studio.advjs.org` 的 Pages 自定义域绑定。
