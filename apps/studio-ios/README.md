# ADV.JS Studio for iPhone and iPad

SwiftUI 原生 Studio 的工作目录。目标、范围与验收见[实施计划](../../docs/plans/2026-10-21-studio-native-ios.md)，设计决策与功能清单见[设计规格](../../docs/specs/2026-10-21-studio-native-ios-design.md)，实测数据见[验收报告](../../docs/reports/studio-native-ios-acceptance.md)。

当前只有 P0 可行性探针（`spike/`）。探针代码不是产品代码：P1 起的引擎包、播放器与 App 工程按计划中的目录结构新建，不从 `spike/` 演化。

## 探针

| 目录              | 用途                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------- |
| `spike/engine/`   | 把 parser、core compiler、内容序列化与资源目录打成 JavaScriptCore 单文件；生成 golden 用例。 |
| `spike/player/`   | 独立播放器页面（Vue + `@advjs/client`），由 `WKURLSchemeHandler` 离线加载。                  |
| `spike/collab/`   | Yjs 在 JavaScriptCore 与 Node 之间的更新互通。                                               |
| `spike/fixtures/` | 播放器离线场景用的项目：立绘、背景、BGM、选择支、`star-map` 插件。                           |
| `spike/ios/`      | SwiftUI 探针 App：引擎一致性、播放器场景、登录会话。                                         |
| `spike/evidence/` | 验收报告引用的模拟器截图。                                                                   |

## 运行

以下命令从仓库根目录执行。先生成引擎与播放器产物（写入已忽略的 `spike/out/`）：

```bash
pnpm exec tsx apps/studio-ios/spike/engine/build.ts
pnpm exec tsx apps/studio-ios/spike/engine/build.ts --minify
pnpm exec tsx apps/studio-ios/spike/engine/golden.ts
pnpm -C packages/unocss build
```

```bash
cd apps/studio-ios/spike/player && ../../../../node_modules/.bin/vite build
```

再生成 Xcode 工程并运行一致性测试（探针用 XcodeGen；正式工程不使用）：

```bash
cd apps/studio-ios/spike/ios && xcodegen generate
```

```bash
xcodebuild test -project apps/studio-ios/spike/ios/StudioSpike.xcodeproj -scheme StudioSpike -destination 'platform=iOS Simulator,name=iPhone 18 Pro'
```

App 启动参数：`-autorunEngine` 运行 golden 用例并写入 `Documents/engine-spike-engine.min.js.json`；`-autorunPlayer` 运行离线试玩场景并写入 `Documents/player-spike-report.json`；`-autorunSignIn`、`-autorunSignInNative`、`-autorunSignInScheme` 启动三种登录会话。

## 验证

- 一致性测试通过，即 160 个用例在 JavaScriptCore 与 Node 中逐字节一致。
- 播放器报告中 `status` 为 `passed`，`restoreMatchesSave` 为 `true`，`refusedRequests` 含越界路径。
- 登录会话在未配置 Associated Domains 时，按预期报告 App 未与 `studio.advjs.org` 关联。
