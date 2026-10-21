# Studio iPhone／iPad 原生 App 验收报告

- 日期：2026-10-21 创建，随各阶段更新。
- 状态：P0 进行中。三项可行性已在模拟器完成；功能清单已确认并锁定；登录配置已准备、待部署与审批。用户决定以 iOS 模拟器验收，不要求实机。N1–N16 均未开始，N12 不适用。
- 范围：[实施计划](../plans/2026-10-21-studio-native-ios)的验收证据；设计与决策见[设计规格](../specs/2026-10-21-studio-native-ios-design)。
- 边界：本报告只记录实际运行结果。模拟器数据只用于可行性与趋势，不能替代实机验收。

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

截图：[iPhone 首个场景](../../apps/studio-ios/spike/evidence/iphone-player-first-scene.jpg)、[星图活动](../../apps/studio-ios/spike/evidence/iphone-player-star-map.jpg)、[读档后的选择支](../../apps/studio-ios/spike/evidence/iphone-player-restored-choice.jpg)、[iPad 首个场景](../../apps/studio-ios/spike/evidence/ipad-player-first-scene.jpg)。探针把播放器放在竖屏 16:9 小窗内，游戏内工具栏与活动面板重叠属于预期；全屏横屏呈现在 P4 实现。

发现：游戏内设置写入 `localStorage`（7 个键），非持久数据存储下关闭即丢失；iPad 上 WebView 的 UA 为 Macintosh。均已写入设计规格。

**真机待验**：断网（飞行模式）运行、首帧时间、WebContent 进程内存与关闭后回落、切后台媒体暂停、横屏全屏。

## 原生登录可行性

| 步骤                                                      | 结果                                                                                                                                                                                                                                   |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 协议核对（`@yunlefun/sso` 0.6.2）                         | 顶层授权 + PKCE S256 + nonce；回跳片段 `#ylf_sso=` 只含一次性授权码；回调地址必须为 HTTPS；兑换接口 `https://api.yunle.fun/sso-ticket` 返回 CloudBase custom ticket。                                                                  |
| HTTPS 回调（`advjs-studio-web`，`studio.advjs.org/`）     | 失败，系统错误原文：Application with identifier org.advjs.studio.spike is not associated with domain studio.advjs.org. Using HTTPS callbacks requires Associated Domains using the `webcredentials` service type for studio.advjs.org. |
| 自定义 scheme 回调（对照）                                | 会话正常弹出系统确认框「想要使用 www.yunle.fun 登录」（[截图](../../apps/studio-ios/spike/evidence/iphone-signin-consent.jpg)）。未点击继续：后续需要用户本人账号，且回跳仍是 HTTPS，无法完成。                                        |
| 过早启动会话                                              | 窗口尚未成为 key 时启动返回 `WebAuthenticationSession` 错误 3（presentation context invalid）；P5 只在用户点击后启动。                                                                                                                 |
| `studio.advjs.org/.well-known/apple-app-site-association` | HTTP 200，`text/html`（SPA 回落页），不是 AASA。`advjs.yunle.fun` 同样。                                                                                                                                                               |
| `www.yunle.fun/.well-known/apple-app-site-association`    | 有效 JSON，`applinks` 与 `webcredentials` 只列出 `QT792GAY4C.fun.yunle.apps` 与 `.native-dev`。                                                                                                                                        |
| 授权码兑换、CloudBase 会话                                | 未执行，依赖上一步回调。                                                                                                                                                                                                               |

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

| 步骤            | 状态                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Studio 托管文件 | `dev` 有仓库规则禁止直推，经 [YunYouJun/advjs#77](https://github.com/YunYouJun/advjs/pull/77)（只含托管提交）合入 `dev`：`ef8a1500`，2026-10-21 17:03。                                                                                                                                                                                                                                                                                                                   |
| Provider 修复   | [YunLeFun/www.yunle.fun#134](https://github.com/YunLeFun/www.yunle.fun/pull/134) CI 通过后合入 `main`：`d7ab1f13`。                                                                                                                                                                                                                                                                                                                                                       |
| Registry 草稿   | `draft:nBvX9KppJE5ggLAz`，基线 `production:15:0878fb78ac3d5ac3924f`；远端 diff 只新增 `advjs-studio-ios`，content hash 与 security hash 和本地校验一致。                                                                                                                                                                                                                                                                                                                  |
| 生产审批        | `approval:KaDDYBhEWAi-KJ8g`，绑定 `main` `d7ab1f13`，飞书通道，用户已批准；[Registry Release](https://github.com/YunLeFun/www.yunle.fun/actions/runs/39573813844) 于 17:02 启动。                                                                                                                                                                                                                                                                                         |
| 回调地址修复    | 线上 `/auth/callback` 被 Cloudflare Pages 以 308 重定向到 `/auth/callback/`（目录索引）。改为发布 `auth/callback.html`，本地 `wrangler pages dev` 核对 200 与全部响应头；随 [YunYouJun/advjs#78](https://github.com/YunYouJun/advjs/pull/78) 合入 `dev`：`18d03656`。                                                                                                                                                                                                     |
| Registry 发布   | 发布 PR [YunLeFun/www.yunle.fun#135](https://github.com/YunLeFun/www.yunle.fun/pull/135) 自动合入 `main`：`823803f`。[Registry Deploy](https://github.com/YunLeFun/www.yunle.fun/actions/runs/39575086812) 中 `desktop-auth`、`sso-registry-admin` 已更新，`sso-ticket` 的 COS 代码上传 60 秒超时，intent 记为 `deployment_failed`；`sso-ticket` 仍运行 generation 15，新客户端返回 `403 client_unknown`（fail-closed）。                                                 |
| 部署重试        | 重跑失败运行在第一步「记录 merged」处被管理面拒绝（`release_status_conflict`），手工记录需要 CI 专用令牌。经用户同意修复流水线：[YunLeFun/www.yunle.fun#136](https://github.com/YunLeFun/www.yunle.fun/pull/136) 增加按 merge commit 重试的手动入口（只允许 `main` 上最新的发布，管理面仍只接受 `deployment_failed → deploying`），合入 `1928c7c`。以 `823803fc` [重试](https://github.com/YunLeFun/www.yunle.fun/actions/runs/39586705230)成功，三个生产消费者全部部署。 |
| 线上校验        | 18:48 `verify-registry.mjs`：`advjs-studio-ios` 的注册回调返回 200（显式授权）；Web 根地址作回调 403 `return_url_not_allowed`、未注册来源 403、越权 scope 400、缺少 PKCE 400。不登录、不签发授权码。                                                                                                                                                                                                                                                                      |
| Apple 关联      | AASA 17:07 上线，Apple CDN 18:38 起返回正确 JSON，`verify-deployment.mjs --apple-cdn` 六项全部通过。模拟器仍报告 App 未与 `studio.advjs.org` 关联：开发者模式直连源站与 CDN 模式下，`swcd` 的下载都未完成（站点批准状态停在 `unspecified`），抹掉模拟器重装后 19:01、19:03 两次仍失败。当时本机 load average 约 480，多个会话的模拟器同时运行，`simctl` 与 `log show` 频繁超时。服务端与托管文件已就绪，剩余阻塞在本机模拟器环境。                                        |

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

## N1–N16 状态

| 编号 | 状态   | 备注                                                              |
| ---- | ------ | ----------------------------------------------------------------- |
| N1   | 未开始 | —                                                                 |
| N2   | 未开始 | 对照清单已于 2026-10-21 经用户确认锁定。                          |
| N3   | 未开始 | 引擎一致性基础已在模拟器验证。                                    |
| N4   | 未开始 | —                                                                 |
| N5   | 未开始 | —                                                                 |
| N6   | 未开始 | 播放器探针在模拟器通过，未断网、非实机。                          |
| N7   | 未开始 | —                                                                 |
| N8   | 未开始 | 受登录依赖阻塞。                                                  |
| N9   | 未开始 | 受 AASA 依赖阻塞。                                                |
| N10  | 未开始 | —                                                                 |
| N11  | 未开始 | —                                                                 |
| N12  | 不适用 | 用户确认 Capacitor 壳从未上传 App Store Connect，无数据需要迁移。 |
| N13  | 未开始 | 探针已覆盖路径越界、外部请求、导航限制；正式验收在 P4、P8。       |
| N14  | 未开始 | —                                                                 |
| N15  | 未开始 | —                                                                 |
| N16  | 未开始 | —                                                                 |

## 已知问题与待办

- 安装 iOS 26 模拟器运行时，在最低版本上运行同一探针。
- 在负载正常时重试模拟器关联（抹掉 `ADVSpike iPhone 18 Pro` 后安装探针，等待 `swcd` 完成 CDN 下载），会话弹出后由用户本人在系统浏览器中登录，记录兑换、`signin/custom`、`user/me` 与退出结果。
- 登录在模拟器走通后结束 P0，进入 P1。
