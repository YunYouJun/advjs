# Studio iPhone／iPad 原生 App 验收报告

- 日期：2026-10-21 创建，随各阶段更新。
- 状态：P1 完成（共享层下沉、引擎接口 v1、Node 与 JavaScriptCore 双端 golden、Studio 单测进 CI）。P0 三项可行性已在模拟器完成，功能清单已确认并锁定，登录配置已上线、待用户在模拟器中本人登录。用户决定以 iOS 模拟器验收，不要求实机。N3、N14、N15 部分有证据，其余未开始；N12 不适用。
- 范围：[实施计划](../plans/2026-10-21-studio-native-ios)的验收证据；设计与决策见[设计规格](../specs/2026-10-21-studio-native-ios-design)。
- 边界：本报告只记录实际运行结果。验收以 iOS 模拟器为准（用户 2026-10-21 决定），实机差异列为风险。

## 环境

| 项目         | 值                                                                                                                |
| ------------ | ----------------------------------------------------------------------------------------------------------------- |
| 主机         | macOS 26.6.2（25G83），Apple Silicon                                                                              |
| Xcode        | 27.1（27A9275），iOS SDK 27.1，Swift 6.4                                                                          |
| 模拟器运行时 | iOS 27.0（24A434）；另有 iOS 18.3。无 iOS 26 运行时。                                                             |
| 模拟器       | 本任务新建的 `ADVSpike iPhone 18 Pro`（iPhone19,2）与 `ADVSpike iPad Pro 11 M5`（iPad17,2），未使用其他会话的设备 |
| 实机         | iPhone 15 Pro（iPhone16,1）在 `devicectl` 中可见，状态 unavailable（未连接）；无 iPad                             |
| Node／pnpm   | 24.18.0／12.12.1                                                                                                  |
| 构建类型     | 探针 App 为 Debug（JavaScriptCore 与 WebKit 性能不受 Swift 构建配置影响，Release 数据待真机）                     |

## 基线

- 工作树 `claude/epic-bhabha-22e2ce`，基于 `dfc45b9e`，开始时干净。`dev` 主工作区有其他会话未提交的桌面端、文档站与 `packages/core`／`editor-sdk` 改动，本任务未读写、未暂存。
- 主计划与交接文档原先只存在于 `dev` 工作区（未跟踪）。按父会话要求，本分支逐字节复制提交（SHA-1 `6390a293…`、`5e81d79b…`），连同计划索引与 Studio 路线图条目；模拟器验收的修订单独提交。
- 新增目录只有 `apps/studio-ios/`（全部标注 SPIKE）与本报告、设计规格；未改动 `apps/studio`、`packages/*` 源码与 lockfile。为构建播放器执行过 `pnpm -C packages/unocss build`，产物在已忽略的 `dist/`。

## 引擎可行性

命令（仓库根目录）：

```bash
pnpm exec tsx apps/studio-ios/spike/engine/build.ts
pnpm exec tsx apps/studio-ios/spike/engine/build.ts --minify
pnpm exec tsx apps/studio-ios/spike/engine/golden.ts
```

```bash
xcodebuild test -project apps/studio-ios/spike/ios/StudioSpike.xcodeproj -scheme StudioSpike -destination 'platform=iOS Simulator,name=ADVSpike iPhone 18 Pro' -destination 'platform=iOS Simulator,name=ADVSpike iPad Pro 11 M5'
```

产物：`engine.js` 1,317,315 字节，`engine.min.js` 656,044 字节（gzip -9 后 165,675 字节）。宿主预置以 banner 形式置于所有模块之前。依赖闭包不含 `node:`、Vue、Pixi 模块（构建插件拦截）。体积前三：zod 553.8 KiB、`@advjs/core` 119.5 KiB、js-yaml 115.6 KiB（未压缩）。

Golden 用例共 160 个（`cases.json` SHA-256 `2d3bb9df…a795daf`，`expected.json` SHA-256 `a1f95bd2…bcba0d5`）：

| 组别                 | 用例 | 内容                                                                                                                      |
| -------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------- |
| 项目编译             | 7    | golden-project、diagnostics valid／broken、Flow demo、仓鼠（模块配置快照）、仓鼠与 starter 的 `public/md/chapters` 旧布局 |
| 章节 AST             | 19   | 仓鼠与 starter 全部 `public/md/chapters/**/*.adv.md`                                                                      |
| 内容解析与序列化往返 | 124  | 62 个文件各解析、序列化一次：角色、场景、地点、音频、章节（仓鼠、golden-project、life-story、Flow demo）                  |
| 资源目录、结构化补丁 | 2    | 仓鼠 `assets.json` 规范化；frontmatter 与 JSON 字段补丁                                                                   |
| 宿主 API             | 6    | UTF-8 编码、SHA-256、`structuredClone`：空串、ASCII、CJK、emoji、孤立代理项、7 万字                                       |
| 错误归一             | 2    | 未知操作、非对象输入                                                                                                      |

一致性结果：

| 比较                                         | 结果                            |
| -------------------------------------------- | ------------------------------- |
| Node（TypeScript 源码）vs Node（打包产物）   | 160／160 逐字节一致             |
| Node vs macOS `jsc`（两种产物）              | 160／160 逐字节一致             |
| Node vs iOS 27 模拟器 JavaScriptCore，iPhone | 160／160 逐字节一致（两种产物） |
| Node vs iOS 27 模拟器 JavaScriptCore，iPad   | 160／160 逐字节一致（两种产物） |

过程中发现并修正的问题：首轮在无 Web API 环境中 6 个编译用例失败（`TextEncoder is not defined`），补齐宿主预置后通过；macOS `jsc` 首轮 1 个差异来自 V8 与 JavaScriptCore 的异常文本不同，改为输入校验与稳定错误码后通过。

性能与内存（`engine.min.js`，每次全新进程，`-autorunEngine`，各 3 次）：

| 设备（模拟器） | 加载 evaluate | 160 例冷运行 | 160 例热运行 | 仓鼠编译 冷／热    | golden-project 冷／热 | 进程内存 基线→加载后→冷运行后→热运行后→释放后            |
| -------------- | ------------- | ------------ | ------------ | ------------------ | --------------------- | -------------------------------------------------------- |
| iPhone19,2     | 41–82 ms      | 448–727 ms   | 268–328 ms   | 121–201／81–102 ms | 29–50／1.8–5.4 ms     | 22.3 → 44.6 → 107.7–120.0 → 112.0–128.3 → 105.6–122.6 MB |
| iPad17,2       | 49–56 ms      | 492–513 ms   | 233–260 ms   | 129–163／60–78 ms  | 33–43／1.5–8.1 ms     | 22.7 → 44.3 → 117.8–123.1 → 126.4–133.7 → 122.0–128.0 MB |

参考：同机 Node 运行源码时仓鼠编译 35 ms、golden-project 1.4 ms。模拟器与其他会话共用 CPU，数值波动较大。内存在释放 `JSContext` 后不回落，已登记为设计规格中的首要风险。

**真机待验**：加载、编译耗时与内存在 iPhone 15 Pro 与 iPad 上重测（Release 构建、Instruments Allocations 与 VM Tracker）。

## 播放器可行性

命令：

```bash
cd apps/studio-ios/spike/player && ../../../../node_modules/.bin/vite build
```

产物：`spike/out/player` 共 16 个文件、1.6 MB（主 JS 1,067.0 kB，gzip 330.9 kB；CSS 252.5 kB）。探针工程 `project` 为 Fixture `spike/fixtures/offline-player`：立绘 `xiaoyun.webp`、背景 `room.svg`、20 秒 AAC BGM、两个选择支、官方 `star-map/compare` 活动。

自动场景（`-autorunPlayer`）：引擎在 JavaScriptCore 中编译出游戏配置 → 打开 `advjs-player://project/__player/index.html` → `load` → 推进到选择支 → 原生存档 → 选择「先看星图」→ 完成活动 → 读档 → 越界探测 → 暂停 → 关闭。

| 检查项                            | iPhone 第 3 次                                                     | iPhone 第 4 次        | iPad 第 1 次（开机后首次） |
| --------------------------------- | ------------------------------------------------------------------ | --------------------- | -------------------------- |
| 结果                              | 通过                                                               | 通过                  | 通过                       |
| 页面 `ready`                      | 1,021 ms                                                           | 863 ms                | 3,437 ms                   |
| 打开到首个节点                    | 1,431 ms                                                           | 1,062 ms              | 3,918 ms                   |
| 播放器初始化                      | 397 ms                                                             | 190 ms                | 435 ms                     |
| 引擎加载 + 编译                   | 222 ms                                                             | 150 ms                | 205 ms                     |
| 安全上下文、`crypto.subtle`       | 是                                                                 | 是                    | 是                         |
| 背景、立绘                        | `room`、`xiaoyun.webp` 200                                         | 同左                  | 同左                       |
| BGM                               | `playing`，206 分段读取约 70 次                                    | 同左                  | 同左                       |
| 暂停后 BGM                        | `paused`                                                           | `paused`              | `paused`                   |
| 插件活动                          | `star-map/compare` 完成，`starMatched=true`、`starMatchScore=0.93` | 同左                  | 同左                       |
| 存档快照                          | 1,065 字节，写入 Application Support                               | 同左                  | 同左                       |
| 读档后光标                        | `start#node-4`，与存档一致                                         | 同左                  | 同左                       |
| 越界路径（4 种）                  | 全部 404                                                           | 全部 404              | 全部 404                   |
| 外部 `fetch`                      | 被拦截                                                             | 被拦截                | 被拦截                     |
| App 进程内存 打开前→试玩中→关闭后 | 20.5 → 33.0 → 32.9 MB                                              | 19.8 → 33.0 → 33.0 MB | 20.5 → 33.2 → 33.1 MB      |

截图（已移出仓库，链接指向提交 `d1c02b15` 中的原文件）：[iPhone 首个场景](https://github.com/YunYouJun/advjs/blob/d1c02b1513131fa4a23b6ec6c5a939e6c9dc850c/apps/studio-ios/spike/evidence/iphone-player-first-scene.jpg)、[星图活动](https://github.com/YunYouJun/advjs/blob/d1c02b1513131fa4a23b6ec6c5a939e6c9dc850c/apps/studio-ios/spike/evidence/iphone-player-star-map.jpg)、[读档后的选择支](https://github.com/YunYouJun/advjs/blob/d1c02b1513131fa4a23b6ec6c5a939e6c9dc850c/apps/studio-ios/spike/evidence/iphone-player-restored-choice.jpg)、[iPad 首个场景](https://github.com/YunYouJun/advjs/blob/d1c02b1513131fa4a23b6ec6c5a939e6c9dc850c/apps/studio-ios/spike/evidence/ipad-player-first-scene.jpg)。探针把播放器放在竖屏 16:9 小窗内，游戏内工具栏与活动面板重叠属于预期；全屏横屏呈现在 P4 实现。

发现：游戏内设置写入 `localStorage`（7 个键），非持久数据存储下关闭即丢失；iPad 上 WebView 的 UA 为 Macintosh。均已写入设计规格。

**真机待验**：断网（飞行模式）运行、首帧时间、WebContent 进程内存与关闭后回落、切后台媒体暂停、横屏全屏。

## 原生登录可行性

| 步骤                                                      | 结果                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 协议核对（`@yunlefun/sso` 0.6.2）                         | 顶层授权 + PKCE S256 + nonce；回跳片段 `#ylf_sso=` 只含一次性授权码；回调地址必须为 HTTPS；兑换接口 `https://api.yunle.fun/sso-ticket` 返回 CloudBase custom ticket。                                                                                                      |
| HTTPS 回调（`advjs-studio-web`，`studio.advjs.org/`）     | 失败，系统错误原文：Application with identifier org.advjs.studio.spike is not associated with domain studio.advjs.org. Using HTTPS callbacks requires Associated Domains using the `webcredentials` service type for studio.advjs.org.                                     |
| 自定义 scheme 回调（对照）                                | 会话正常弹出系统确认框「想要使用 www.yunle.fun 登录」（[截图](https://github.com/YunYouJun/advjs/blob/d1c02b1513131fa4a23b6ec6c5a939e6c9dc850c/apps/studio-ios/spike/evidence/iphone-signin-consent.jpg)）。未点击继续：后续需要用户本人账号，且回跳仍是 HTTPS，无法完成。 |
| 过早启动会话                                              | 窗口尚未成为 key 时启动返回 `WebAuthenticationSession` 错误 3（presentation context invalid）；P5 只在用户点击后启动。                                                                                                                                                     |
| `studio.advjs.org/.well-known/apple-app-site-association` | HTTP 200，`text/html`（SPA 回落页），不是 AASA。`advjs.yunle.fun` 同样。                                                                                                                                                                                                   |
| `www.yunle.fun/.well-known/apple-app-site-association`    | 有效 JSON，`applinks` 与 `webcredentials` 只列出 `QT792GAY4C.fun.yunle.apps` 与 `.native-dev`。                                                                                                                                                                            |
| 授权码兑换、CloudBase 会话                                | 未执行，依赖上一步回调。                                                                                                                                                                                                                                                   |

结论：协议与系统能力可行；端到端需要设计规格「服务端与账号依赖」一节的全部变更，以及用户在真机上本人登录。

## 登录配置准备（2026-10-21 下午）

用户答复：使用 Lan Yang 的团队，经管理后台走通配置。依据云生 iOS 已上线的同类接入（`YunYouJun/life` 的 `docs/guide/yunlefun-sso.md`）准备如下，均未部署：

| 项目                 | 结果                                                                                                                                                                                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Team                 | 钥匙串签名证书 `Apple Distribution: Lan Yang (QT792GAY4C)`，与云乐坊、云生 App 同一 Team。                                                                                                                                                                 |
| 兑换的 `Origin` 约束 | `sso-ticket` 只接受与授权码绑定的注册 Origin；云生原生端显式发送 `Origin` 头。原判断「需要服务端放行无 Origin 请求」作废，`sso-ticket` 不需改动。                                                                                                          |
| Studio 托管文件      | 新增 AASA、`/auth/callback` 回落页与 `_headers`；`pnpm studio:build` 通过，`dist/` 含这些文件，Service Worker 导航回落 `denylist` 含 `/auth/callback` 与 `/.well-known/`。                                                                                 |
| Registry 候选        | `apps/studio-ios/sso/production-advjs-studio-ios.draft.json` 基于 generation 15（`production:15:0878fb78ac3d5ac3924f`）只新增 `advjs-studio-ios`；`pnpm sso:registry validate` 通过，content hash `d26fea9a…d725f374`，security hash `4083fb82…17315613`。 |
| Provider 修复        | `www.yunle.fun` 分支 `feat/advjs-studio-ios-sso` 提交 `7edb8de`：应用探索页排除本客户端。新增测试在撤掉修复时失败、恢复后 8 项全部通过。                                                                                                                   |
| 探针签名             | Bundle ID 改为 `org.advjs.studio.dev`、Team `QT792GAY4C`；模拟器构建的 simulated entitlements 含 `application-identifier = QT792GAY4C.org.advjs.studio.dev` 与 `webcredentials:`／`applinks:studio.advjs.org`。                                            |
| 探针登录链路         | 改为 `advjs-studio-ios` 与 `/auth/callback`；兑换带 `Origin`，随后 `signin/custom`、`user/me`、`user/signout`，日志只记录状态码与字段是否存在。端到端运行需等上表各项上线，并由用户本人在系统浏览器中登录。                                                |

### 上线进度

用户于 2026-10-21 同意全部执行（发布托管文件、合入 Provider 修复、提交 Registry 草稿并发起生产审批），并确认云端项目采用工作副本、首版不采集遥测。

| 步骤            | 状态                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Studio 托管文件 | `dev` 有仓库规则禁止直推，经 [YunYouJun/advjs#77](https://github.com/YunYouJun/advjs/pull/77)（只含托管提交）合入 `dev`：`ef8a1500`，2026-10-21 17:03。                                                                                                                                                                                                                                                                                                                                                                     |
| Provider 修复   | [YunLeFun/www.yunle.fun#134](https://github.com/YunLeFun/www.yunle.fun/pull/134) CI 通过后合入 `main`：`d7ab1f13`。                                                                                                                                                                                                                                                                                                                                                                                                         |
| Registry 草稿   | `draft:nBvX9KppJE5ggLAz`，基线 `production:15:0878fb78ac3d5ac3924f`；远端 diff 只新增 `advjs-studio-ios`，content hash 与 security hash 和本地校验一致。                                                                                                                                                                                                                                                                                                                                                                    |
| 生产审批        | `approval:KaDDYBhEWAi-KJ8g`，绑定 `main` `d7ab1f13`，飞书通道，用户已批准；[Registry Release](https://github.com/YunLeFun/www.yunle.fun/actions/runs/39573813844) 于 17:02 启动。                                                                                                                                                                                                                                                                                                                                           |
| 回调地址修复    | 线上 `/auth/callback` 被 Cloudflare Pages 以 308 重定向到 `/auth/callback/`（目录索引）。改为发布 `auth/callback.html`，本地 `wrangler pages dev` 核对 200 与全部响应头；随 [YunYouJun/advjs#78](https://github.com/YunYouJun/advjs/pull/78) 合入 `dev`：`18d03656`。                                                                                                                                                                                                                                                       |
| Registry 发布   | 发布 PR [YunLeFun/www.yunle.fun#135](https://github.com/YunLeFun/www.yunle.fun/pull/135) 自动合入 `main`：`823803f`。[Registry Deploy](https://github.com/YunLeFun/www.yunle.fun/actions/runs/39575086812) 中 `desktop-auth`、`sso-registry-admin` 已更新，`sso-ticket` 的 COS 代码上传 60 秒超时，intent 记为 `deployment_failed`；`sso-ticket` 仍运行 generation 15，新客户端返回 `403 client_unknown`（fail-closed）。                                                                                                   |
| 部署重试        | 重跑失败运行在第一步「记录 merged」处被管理面拒绝（`release_status_conflict`），手工记录需要 CI 专用令牌。经用户同意修复流水线：[YunLeFun/www.yunle.fun#136](https://github.com/YunLeFun/www.yunle.fun/pull/136) 增加按 merge commit 重试的手动入口（只允许 `main` 上最新的发布，管理面仍只接受 `deployment_failed → deploying`），合入 `1928c7c`。以 `823803fc` [重试](https://github.com/YunLeFun/www.yunle.fun/actions/runs/39586705230)成功，三个生产消费者全部部署。                                                   |
| 线上校验        | 18:48 `verify-registry.mjs`：`advjs-studio-ios` 的注册回调返回 200（显式授权）；Web 根地址作回调 403 `return_url_not_allowed`、未注册来源 403、越权 scope 400、缺少 PKCE 400。不登录、不签发授权码。                                                                                                                                                                                                                                                                                                                        |
| Apple 关联      | AASA 17:07 上线，Apple CDN 18:38 起返回正确 JSON，`verify-deployment.mjs --apple-cdn` 六项全部通过。开发者模式直连源站时 `swcd` 下载始终未完成；改回 CDN 模式并抹掉模拟器重装后，19:01、19:03 两次仍未关联，19:04:32 第三次起系统接受 HTTPS 回调并弹出「StudioSpike 想要使用 www.yunle.fun 登录」（[截图](https://github.com/YunYouJun/advjs/blob/d1c02b1513131fa4a23b6ec6c5a939e6c9dc850c/apps/studio-ios/spike/evidence/iphone-signin-https-callback-accepted.jpg)）。当时本机 load average 约 480，`swcd` 下载明显变慢。 |

## 协作评估

```bash
pnpm exec tsx apps/studio-ios/spike/collab/yjs-interop.ts
```

Studio 使用的 yjs 13.6.32 打包后在 macOS `jsc` 中运行：应用 Node 生成的更新、插入与删除文本、回传增量，Node 应用后两端文本一致（含 emoji），`converged: true`。iOS JavaScriptCore 上的同一验证在协作立项时补做。

## 平台调研

| 项目           | 结果                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| Swift 配置     | 探针以 Swift 6、`SWIFT_STRICT_CONCURRENCY = complete`、部署目标 iOS 26.0 构建，零警告。                             |
| CI runner      | GitHub 2026-10-15 宣布 `xcode-27` runner 镜像 GA（Apple Silicon，macOS 27）；`macos-26` 镜像只有 Xcode 26.5／26.6。 |
| 系统版本分布   | Apple 2026 年 6 月数据：iOS 26 占全部兼容 iPhone 79%、近 4 年机型 86%；iPadOS 26 为 68%、79%。                      |
| Capacitor 分发 | 仓库无 `DEVELOPMENT_TEAM`，版本 1.0（1），发布清单未执行；用户确认从未上传 App Store Connect。                      |

来源：[Xcode 27 runner image generally available](https://github.blog/changelog/2026-10-15-xcode-27-runner-image-generally-available)、[iOS 26 adoption grows but still lags slightly behind iOS 18](https://9to5mac.com/2026/06/10/ios-26-adoption-grows-but-still-lags-slightly-behind-ios-18/)。

## P1：共享层下沉与引擎包

分支 `feat/studio-ios-p1`，基于 `origin/dev` `18d03656`，独立工作树，开始时干净；`dev` 检出目录中其他会话的未提交改动未读写。环境同上表，另建本任务专用模拟器 `ADV Studio iPhone 18 Pro`（`387BBFAB…`）与 `ADV Studio iPad Pro 11 M5`（`E0CA58D7…`），均为 iOS 27.0；未使用 P0 会话的 `ADVSpike` 设备。

### Web Studio 回归

| 检查                | 命令                                                                                                      | 结果                                                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 基线（改动前）      | `pnpm -C apps/studio exec vitest run`                                                                     | 74 个文件、517 项通过                                                                                                  |
| 改动后              | 同上                                                                                                      | 69 个文件、472 项通过；移出的 5 个内容格式测试文件（45 项）改到 `tests/unit/parser/`，与新增的保留规则测试共 93 项通过 |
| Studio 类型检查     | `pnpm -C apps/studio exec vue-tsc --noEmit`                                                               | 0 错误                                                                                                                 |
| 共享包与 CLI        | `pnpm vitest run tests/unit/parser tests/unit/assets tests/unit/runtime tests/unit/cli tests/unit/client` | 93 个文件、584 项通过（先 `pnpm prepare:workspace unit`）                                                              |
| 资源与音频          | `pnpm vitest run tests/unit/assets tests/unit/audio`                                                      | 60 个文件、605 项通过，含新增的 HTTPS 链接差分测试                                                                     |
| CI 合约与工作区准备 | `pnpm vitest run tests/unit/tooling/`                                                                     | 23 个文件、180 项通过                                                                                                  |

行为变化（均为修复或收紧，见设计规格架构决策 7）：编辑保存保留未知 frontmatter 字段、未知角色小节与正文；自动修复写入失败的文件不再计入「已修复」；资源音乐来源链接只接受保守 HTTPS 形式（IP、国际化域名、需改写的路径被拒绝）。

### 引擎包

```bash
pnpm -C apps/studio-ios build:engine
pnpm -C apps/studio-ios test:engine
pnpm -C apps/studio-ios golden
```

| 项目      | 结果                                                                                                                                                                                                                       |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 产物      | `engine.js` 686,669 字节（670.6 KiB，压缩），预算 720 KiB；zod 319.7 KiB、`@advjs/core` 79.2 KiB、js-yaml 52.3 KiB                                                                                                         |
| 闭包检查  | 无 Node、Vue、Pixi 等模块；未压缩产物经 ESLint `no-undef` 检查，除登记的不可达引用外无 `URL`、`fetch`、定时器、DOM 引用。首轮检查发现资源目录音乐链接校验的 `new URL()` 在 JavaScriptCore 中可达，已改为纯 JavaScript 实现 |
| 接口      | v1，15 个操作，6 个稳定错误码；`engine.info` 握手                                                                                                                                                                          |
| Node 测试 | `test:engine` 14 项通过：闭包、体积、沙箱一致性、契约、错误码、往返保留、索引、校验与修复、草稿诊断定位、链接规范化、旧布局映射                                                                                            |

Golden 用例 335 个（`cases.json` SHA-256 `b19235ae…b3fe1ffff`，`expected.json` SHA-256 `68382d75…b75df8`，`engine.js` SHA-256 `af0c9626…31143e32`）：

| 组别                             | 用例 | 内容                                                                                                |
| -------------------------------- | ---- | --------------------------------------------------------------------------------------------------- |
| 项目编译                         | 8    | golden-project、diagnostics valid／broken、Flow demo、仓鼠模块配置、仓鼠与 starter 旧布局、往返样例 |
| 索引、校验、创作编译             | 7    | golden-project 与往返样例；含未保存草稿的诊断定位                                                   |
| 修复、补丁、播放器配置、资源目录 | 7    | 往返样例与仓鼠                                                                                      |
| 旧布局映射、章节 AST             | 21   | 仓鼠与 starter 全部 `public/md/chapters/**`                                                         |
| 内容解析与序列化                 | 274  | 70 个文件：解析、无源序列化、带源未修改（须逐字节等于原文）、带源修改后（须保留全部原有键与正文）   |
| 宿主 API                         | 6    | UTF-8、SHA-256、`structuredClone`：空串、ASCII、CJK、emoji、孤立代理项、7 万字                      |
| 错误                             | 12   | 未知操作、原型链操作名、非法 JSON、非对象、缺字段、类型错误、内容与 YAML 错误、项目格式与设置错误   |

往返样例 `apps/studio-ios/engine/fixtures/round-trip` 覆盖未知 frontmatter 字段、未知角色小节与标题前说明、正文中的描述、ID、两种立绘、关系（含失效目标）、资源 `includes` 分片和带外部链接的音乐元数据。

一致性结果：

| 比较                                                                   | 结果                                        |
| ---------------------------------------------------------------------- | ------------------------------------------- |
| Node（TypeScript 源码）vs Node 沙箱（压缩产物，仅 ECMAScript 与 Intl） | 335／335 逐字节一致                         |
| Node vs macOS JavaScriptCore（`swift test`）                           | 335／335 逐字节一致，StudioKit 8 项测试通过 |
| Node vs iOS 27 模拟器 JavaScriptCore，iPhone 18 Pro                    | 335／335 逐字节一致，8 项通过               |
| Node vs iOS 27 模拟器 JavaScriptCore，iPad Pro 11（M5）                | 335／335 逐字节一致，8 项通过               |

内存（`EngineMemoryTests` 单独运行，每轮新建 `EngineBridge` → 运行全部 golden 用例 → 关闭，单位 MB，进程 `phys_footprint`）：

| 设备              | 基线 | 第 1 轮 加载／运行／关闭 | 第 2 轮 关闭 | 第 3 轮 关闭 | 第 4 轮 关闭 | 第 5 轮 关闭 |
| ----------------- | ---- | ------------------------ | ------------ | ------------ | ------------ | ------------ |
| iPhone 18 Pro     | 27.7 | 47.3／117.2／113.4       | 99.2         | 96.3         | 99.6         | 61.7         |
| iPad Pro 11（M5） | 27.5 | 47.5／102.1／100.0       | 92.3         | 106.3        | 81.9         | 78.3         |

按项目独立虚拟机后不再逐轮累积（P0 为单个上下文中持续上涨且不回落）；关闭后不立即回到基线，由 JavaScriptCore 自行归还。复测加 `malloc_zone_pressure_relief` 无可测改善（第 5 轮关闭 99.3／94.0 MB），未采用。golden 负载远重于单个项目的日常操作，P7 以 Instruments 复测。

### CI

`.github/workflows/ci.yml` 新增并纳入 `launch-required`：

- `studio-unit`（Ubuntu）：`pnpm prepare:workspace studio-ios` → Studio 单测 → 构建引擎 → `test:engine`。
- `studio-ios-engine`（`xcode-27` runner）：构建引擎与 golden → `swift test`（macOS JavaScriptCore）→ `xcodebuild test`（脚本选出的 iPhone 与 iPad 模拟器），上传引擎报告、golden 摘要与 `.xcresult`。

CI 结果见 P1 合并 PR。

## P2：原生骨架、设计规范与项目管理

分支 `feat/studio-ios-p2`，基于 P1 合并后的 `origin/dev`（`d55f2969`）。模拟器与 P1 相同（`ADV Studio iPhone 18 Pro`、`ADV Studio iPad Pro 11 M5`，iOS 27.0），Xcode 27，Debug 构建。截图是 UI 测试附件（`XCTAttachment`，始终保留），不提交到仓库：本机在 `.xcresult` 中，CI 的 `studio-ios` artifact 上传 `UITests-iPhone.xcresult` 与 `UITests-iPad.xcresult`（保留 30 天），用 `xcrun xcresulttool export attachments --path <xcresult> --output-path <目录>` 导出。下表「附件」列为附件名。

### 共享层与引擎

项目模板、slug 规则与 `.advpkg.zip` 打包规则从 `apps/studio` 下沉到 `@advjs/core/project`（`templates.ts`、`slug.ts`、`package.ts`）；Web Studio 的 `utils/projectTemplate.ts`、`utils/slug.ts` 改为转出共享实现，`useProjectExport` 改用共享清单与路径规则，并拒绝不安全路径。

| 项目      | 结果                                                                                                                                                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 接口      | v1 新增 5 个操作：`project.templates`、`project.fromTemplate`、`project.slug`、`package.plan`、`package.inspect`，共 20 个；只增不改，版本号不变                                                                               |
| 产物      | `engine.js` 728,196 字节（711.1 KiB），预算由 720 KiB 调整为 768 KiB；增长主要来自模板正文（`@advjs/core` 79.2 → 114.5 KiB）                                                                                                   |
| Node 测试 | `test:engine` 17 项通过                                                                                                                                                                                                        |
| Golden    | 354 例，Node 源码与沙箱逐字节一致（`cases.json` `5dc56895…`、`expected.json` `d7baeee2…`、`engine.js` `151bd9e8…`）；变基到最新 `origin/dev` 后重建，三个摘要不变                                                              |
| StudioKit | `swift test`（macOS JavaScriptCore）23 项通过：golden 一致性、引擎桥、内存，以及项目存储与会话（新建、重新发现、改名含仅大小写、最近删除、导出导入往返、Web 包导入、原地打开、外部修改与冲突、项目已不存在、文件名忽略大小写） |
| Web 回归  | `pnpm -C apps/studio exec vitest run` 69 个文件、472 项通过                                                                                                                                                                    |

### App 工程

- `apps/studio-ios/StudioApp.xcodeproj`：Xcode 文件夹同步，本地包 `StudioKit`（领域与存储，依赖 ZIPFoundation 0.9.20，锁定版本）与 `StudioUI`（品牌色与组件）；目标 `StudioApp`、`StudioAppTests`、`StudioAppUITests`；Swift 6、完整并发检查、App 目标默认主 actor 隔离，Swift 编译零警告。
- 资源：App 图标沿用 Capacitor 版 1024 px 图标，强调色为品牌紫；比赛示例由 `pnpm -C apps/studio-ios build:samples` 经共享打包规则生成 `.advpkg.zip`，随 App 分发，安装走与导入相同的路径。
- String Catalog：159 个键，简体中文全部翻译，术语对照 `apps/studio/src/i18n/locales`（如「工作区」「我的」「项目健康」「最近删除」）。
- 设计规范：新增 [原生 Studio 设计规范](../about/design/studio-native.md)，根目录与 `apps/studio-ios` 的 AGENTS 增加指向它的规则。

### UI 测试

```bash
pnpm -C apps/studio-ios build:engine
pnpm -C apps/studio-ios build:samples
xcodebuild build-for-testing -project apps/studio-ios/StudioApp.xcodeproj -scheme StudioApp -destination id=<simulator>
xcodebuild test-without-building -project apps/studio-ios/StudioApp.xcodeproj -scheme StudioApp -destination id=<simulator> -only-testing:StudioAppUITests
```

单测与 UI 测试分两次 `test-without-building` 运行：同一次运行中 Xcode 27 在单测结束后偶发挂起（本机与 CI 一致处理）。

| 测试                                                                                                      | 设备                    | 结果     | 附件                                                                                                 |
| --------------------------------------------------------------------------------------------------------- | ----------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| `StudioAppTests`：文件夹列表、模板目录、文件类型                                                          | iPhone 18 Pro           | 3 项通过 | —                                                                                                    |
| `testCreateOpenRenameDeleteAndUndo`：空状态 → 模板新建并打开 → 改名 → 删除后撤销 → 再删除进入「最近删除」 | iPhone 18 Pro           | 通过     | `empty-library`、`project-overview`、`library-with-project`、`deleted-with-undo`、`recently-deleted` |
| `testEditAndSaveAFile`：逐级浏览文件夹，编辑后保存，草稿标记消失                                          | iPhone 18 Pro           | 通过     | `files-adv-folder`、`editing-with-draft`                                                             |
| `testFileChangedElsewhereWhileEditingKeepsBothVersions`：见下节                                           | iPhone 18 Pro           | 通过     | `conflict-banner`、`both-versions-kept`                                                              |
| `testChineseInterfaceAndRegionalFormats`：简体中文界面与相对日期                                          | iPhone 18 Pro           | 通过     | `zh-overview`、`zh-library`、`zh-settings`                                                           |
| `testLanguageEntryOpensSystemSettings`：「我的 → 语言」打开系统设置中本 App 的页面                        | iPhone 18 Pro           | 通过     | `settings`、`system-settings-for-app`                                                                |
| `testSwitchingLanguageInSystemSettings`：见「语言切换」                                                   | iPhone 18 Pro           | 通过     | `system-language-*`、`app-after-system-language-*`                                                   |
| `testFileSizeAndDateFollowTheLocale`：见「语言切换」                                                      | iPhone 18 Pro           | 通过     | `file-info-*`                                                                                        |
| `testThreeColumnsAndProjectWindows`：⌘N 新建、三栏、上下文菜单「在新窗口中打开」、项目窗口                | iPad Pro 11（M5），横屏 | 通过     | `ipad-three-columns`、`ipad-context-menu`、`ipad-project-window`                                     |

### 语言切换（S04）

- 「我的 → 语言」显示当前语言，点击后经 `UIApplication.openSettingsURLString` 打开系统设置中本 App 的页面；部分模拟器构建停在设置首页，测试此时经「App → ADV.JS Studio」进入。
- `testSwitchingLanguageInSystemSettings` 不带语言启动参数，按作者的实际操作在系统设置里把本 App 的语言依次切到 English 和简体中文；系统重启 App 后，Tab 名称（Workspace／Me → 工作区／我的）与项目行的相对日期（「Edited …」→「编辑于…」）随之改变。
- 数字格式：英文与简体中文的小数点、千分位符号相同（CLDR），二者之间看不出差别，因此 `testFileSizeAndDateFollowTheLocale` 另用德国地区格式验证数字跟随区域：同一 1.5 MB 文件在 en_US、zh_CN 显示「1.5 MB」，在 de_DE 显示「1,5 MB」；修改时间分别显示为 `10/22/2026, 12:00 AM`、`2026/10/22 0:00`、`22.10.2026, 0:00`（附件 `file-info-*`）。界面中的日期与数字都经 `FormatStyle` 按当前区域格式化，不拼接字符串。
- App 内即时切换语言未实现；如需要，先征得用户同意（见设计规格 S04）。

### 外部修改与冲突

- 项目会话以 `NSFilePresenter` 监听项目文件夹，外部修改经 400 ms 去抖后刷新；App 自己的写入经 `CoordinatedFiles` 并传入同一监听者，不被当作外部修改。
- StudioKit 测试覆盖：协调写入、未经协调的直接写入、App 自身写入不触发冲突、有未保存草稿时外部修改产生冲突，三种处理（保留我的、使用对方的、两者都保留）。
- UI 测试 `testFileChangedElsewhereWhileEditingKeepsBothVersions`：在 App 中编辑 `adv/world.md` 不保存，测试进程以 `NSFileCoordinator` 原子替换同一文件（等同「文件」App 或 iCloud 的写入）；App 显示冲突横幅，选择「两者都保留」后原文件为外部内容，草稿保存为 `world (mine).md`，文件列表中出现该文件。
- 「文件」App 中 iCloud Drive 项目的原地打开与安全作用域书签由 StudioKit `openInPlace` 测试覆盖（本机临时目录模拟）；跨设备修改与书签失效恢复列入 N7，在 P7 一并实测。

### iPad 与多窗口

- 三栏 `NavigationSplitView`：项目列表与「最近删除」、项目分区、内容；`Info.plist` 声明多场景，项目行上下文菜单与 ⌥⌘N 在新窗口中打开项目，每个窗口一个项目，窗口间会话互不影响（同一项目共用会话，最多保留 4 个）。
- 菜单命令：新建项目 ⌘N、在新窗口中打开 ⌥⌘N、导入 ⇧⌘I、从「文件」打开 ⌘O、保存 ⌘S、查找项目 ⌘F，以及系统侧栏切换；UI 测试以硬件键盘 ⌘N 新建项目。试玩 ⌘R 随 P4 播放器加入。
- 场景状态恢复：`SceneStorage` 保存 iPhone 的所选 Tab 与打开的项目、iPad 的侧栏选择与项目分区，以及项目窗口的分区；UI 测试中上一次运行留下的 Tab 会被恢复（测试因此在启动后先选 Tab）。
- 恢复时发现的问题与修复：上次留下的项目窗口在项目已删除后被系统恢复，显示「无法打开项目」和无效的「重试」（UI 测试清空数据后复现）。现在项目不存在时会话进入「已不存在」状态，项目窗口自动关闭；若此时没有显示项目列表的窗口，先打开一个。在其他窗口删除或移走项目时同样适用。StudioKit 新增对应测试。

### CI

P2 的首轮 CI（[YunYouJun/advjs#82](https://github.com/YunYouJun/advjs/pull/82)）发现三处问题，均已修复：

- **项目重名判断依赖卷是否区分大小写。** iOS 模拟器上 `ProjectStoreTests/rename()` 失败：改名为只差大小写的已有名称时，`fileExists` 没有拦住，移动时才报 Cocoa 516。iOS 真机卷区分大小写，项目又会在「文件」、iCloud 与其他电脑之间流转，因此改为列出目录后忽略大小写比较（`ProjectFolderName.isTaken`），项目改名、新建文件、文件改名统一使用；只改大小写的改名经中间名完成。新增测试，并在本机区分大小写的 APFS 磁盘映像上运行项目与会话测试（16 项通过）。
- **lint 检查了 Xcode 生成的资源目录 JSON。** `*.xcassets` 由 Xcode 按自身格式写入，加入 ESLint 忽略。
- **Web Studio `audioWorkspaceLifecycle` 的竞态测试按固定次数等待微任务**，在繁忙的 runner 上偶发失败，改为等待最终状态，再确认旧读取不会覆盖。

同时减少 CI 用量：

- 新增 `studio-changes` 作业（`scripts/ci/studio-changes.mjs`）：只有引擎打包的工作区源码、golden 用到的 fixture、`apps/studio-ios` 或共享构建配置变化时才运行 `studio-ios`；`studio-unit` 另覆盖 `apps/studio` 与全部工作区包。`launch-required` 改用 `scripts/ci/launch-required.mjs`，仅在 `studio-changes` 成功且报告无需运行时接受跳过；引擎测试校验打包进 `engine.js` 的每个源码文件都在过滤范围内，防止依赖新增后漏跑。
- `studio-ios` 作业：StudioKit（含 iOS JavaScriptCore golden 一致性）与 App 单测只在 iPhone 上跑一次；iPad 只跑自己的 UI 测试；去掉与 iOS 重复的 macOS `swift test`；依赖安装期间预先启动模拟器，减少「test runner timed out while preparing」这类等待（`dev` 上 P1 合并后的失败即为此）。

2026-10-28 继续核对 PR #82 的 [CI 失败运行](https://github.com/YunYouJun/advjs/actions/runs/39662323643)：构建和 App 单测成功，`testSwitchingLanguageInSystemSettings` 在系统设置中找不到语言入口。`UITests-iPhone.xcresult` 的失败附件 `App UI hierarchy for com.apple.Preferences` 确认已进入本 App 设置页，但页面只有 Siri、Search 和蜂窝数据，没有语言选项。单语言设备默认隐藏这个入口，不能仅增加等待时间修复。

在 Debug 和 Release 共用的 `Config/StudioApp-Info.plist` 中启用布尔值 `UIPrefersShowingLanguageSettings`，本地 `build-for-testing` 已核对最终 App 产物中的配置，按照 [Apple 的多语言应用说明](https://developer.apple.com/videos/play/wwdc2024/10185/)让系统始终显示 App 语言设置。App 单测校验生成的 Info.plist 配置和本地化资源，UI 测试仍真实切换 English／简体中文并验证界面及相对日期，仅在点击前增加有明确失败信息的存在性等待。修复以最新 PR head 的完整 CI 结果验收，不跳过语言测试或放宽 `launch-required`。

### 与清单的差异

- W06 独立部署包依赖 P4 的播放器打包，移到 P4；`.advpkg.zip` 导出已完成（分享面板与 `fileMover`）。
- W07 封面经相册选择器写入项目，随 P3 图片导入实现；「复制 ID」对应云端项目 ID，随 P5 云端能力实现。改名、描述、移除已完成。
- W08 概览目前显示章节、角色、场景、地点、音频、文件 6 项计数；Web 版 12 张内容卡片对应的列表与编辑入口随 P3 内容创作补齐。W09 的问题可跳转到文件，定位到行列随 P3 章节编辑器实现。
- 快速开始与 3 个比赛示例并入新建项目页（W03），模板「校园恋爱」打开后项目健康显示 4 个错误：模板引用了未附带的角色文件，Web Studio 同样如此，P3 修正模板。

## N1–N16 状态

| 编号 | 状态   | 备注                                                                                                                                                                                                                                      |
| ---- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1   | 未开始 | —                                                                                                                                                                                                                                         |
| N2   | 部分   | 对照清单已于 2026-10-21 经用户确认锁定。P2：W01–W05、W10、W11、S03、S04、S06、S07、S09–S11 可用；W08 计数、W09 校验与修复及跳转到文件可用，内容卡片入口与行列定位随 P3 编辑器补齐；W06 独立部署包移到 P4，W07 封面与复制 ID 移到 P3、P5。 |
| N3   | 部分   | P1：内容往返保留规则在 Web Studio 与引擎共用；golden 335 例双端一致。待 P3 跨端实操。                                                                                                                                                     |
| N4   | 未开始 | —                                                                                                                                                                                                                                         |
| N5   | 未开始 | —                                                                                                                                                                                                                                         |
| N6   | 未开始 | 播放器探针在模拟器通过，未断网、非实机。                                                                                                                                                                                                  |
| N7   | 部分   | P2：文件协调、外部修改刷新与草稿冲突（三种选择）有 StudioKit 测试与模拟器 UI 测试；iCloud Drive 跨设备修改与书签失效恢复待实测。                                                                                                          |
| N8   | 未开始 | 受登录依赖阻塞。                                                                                                                                                                                                                          |
| N9   | 未开始 | 受 AASA 依赖阻塞。                                                                                                                                                                                                                        |
| N10  | 部分   | P2：iPad 三栏、上下文菜单在新窗口打开项目、硬件键盘 ⌘N 有 UI 测试；分屏、台前调度与跨 App 拖放待 P7。                                                                                                                                     |
| N11  | 未开始 | —                                                                                                                                                                                                                                         |
| N12  | 不适用 | 用户确认 Capacitor 壳从未上传 App Store Connect，无数据需要迁移。                                                                                                                                                                         |
| N13  | 未开始 | 探针已覆盖路径越界、外部请求、导航限制；正式验收在 P4、P8。                                                                                                                                                                               |
| N14  | 部分   | P1：Studio 单测 472 项、类型检查、共享包与 CLI 单测通过；E2E 与桌面 Editor 回归待 P8 汇总。                                                                                                                                               |
| N15  | 部分   | P1：Studio 单测与 Node、JavaScriptCore 一致性测试进入 CI。P2：CI 增加 App 构建、App 单测与 iPhone、iPad XCUITest；性能回归随 P7 加入。                                                                                                    |
| N16  | 未开始 | —                                                                                                                                                                                                                                         |

## 已知问题与待办

- 安装 iOS 26 模拟器运行时，在最低版本上运行同一探针。
- 登录配置已上线：Studio 托管文件（[YunYouJun/advjs#77](https://github.com/YunYouJun/advjs/pull/77)、[YunYouJun/advjs#78](https://github.com/YunYouJun/advjs/pull/78)），Provider 修复与 Registry 发布（[YunLeFun/www.yunle.fun#134](https://github.com/YunLeFun/www.yunle.fun/pull/134) 至 [#136](https://github.com/YunLeFun/www.yunle.fun/pull/136)）。
- 登录端到端：由用户本人在 `ADVSpike iPhone 18 Pro` 模拟器的系统登录页中登录云乐坊，记录兑换、`signin/custom`、`user/me` 与退出结果（探针只记录状态码与字段是否存在）；P1 起按主计划并行推进。
- Web Studio 编辑已有正文的章节时不写入表单中的标题与梗概（既有行为），原生端已用 `updateChapterMd`；P3 统一章节表单。
- 引擎关闭后内存不立即回到基线（见 P1 内存表），P7 以 Instruments 复测。
- 「校园恋爱」模板引用了未附带的角色文件，新建后项目健康显示 4 个错误（Web Studio 相同），P3 修正模板。
- UI 测试在 iPad 横屏下用 `XCUIApplication.screenshot()` 得到旋转且被裁切的图像，改用整屏截图。
