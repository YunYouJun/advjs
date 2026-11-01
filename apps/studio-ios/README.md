# ADV.JS Studio for iPhone and iPad

SwiftUI 原生 Studio 的工作目录。目标、范围与验收见[实施计划](../../docs/plans/2026-10-21-studio-native-ios.md)，设计决策与功能清单见[设计规格](../../docs/specs/2026-10-21-studio-native-ios-design.md)，实测数据见[验收报告](../../docs/reports/studio-native-ios-acceptance.md)。

## 目录

| 目录                 | 用途                                                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine/`            | JavaScriptCore 引擎：版本化 JSON 接口（`src/`）、打包与闭包检查（`build.ts`）、golden 用例（`golden/`、`fixtures/`）与 Node 测试（`test/`）。 |
| `Packages/StudioKit` | 无界面 Swift 包：`EngineBridge`（每个项目独立的 `JSVirtualMachine`）、诊断工具；Swift Testing 在 macOS 与 iOS 模拟器上跑 golden 一致性。      |
| `scripts/`           | CI 与本机辅助脚本，例如为 `xcodebuild` 选出一台 iPhone 与一台 iPad 模拟器。                                                                   |
| `sso/`               | 云乐坊 SSO 原生客户端 `advjs-studio-ios` 的声明与生产 Registry 候选快照（经 `www.yunle.fun` 审批流程发布）。                                  |
| `spike/`             | P0 可行性探针，不是产品代码，不随产品工程演化。                                                                                               |

引擎只调用共享包中的实现（`@advjs/parser` 内容文档、`@advjs/core/project`、`@advjs/assets`），不维护第二份格式逻辑。共享层清单见设计规格「架构决策 7」。

## 模拟器入口

日常探针和完整原生 Studio 测试都使用 `scripts/simulator-session.mjs`，不按任务重复新建设备。本工作区包含 P0 探针和 P1 共享引擎；测试正式 App 时通过 `git worktree list` 找到包含 `StudioApp.xcodeproj` 的完整工作区，在其 `apps/studio-ios` 中使用同名入口。

`scripts/simulator-profile.json` 固定 iOS27 上已有的 `ADV Studio iPhone 18 Pro` 和 `ADV Studio iPad Pro 11 M5`，同时匹配 runtime、device type 和名称；缺失或重名就停止，不回退到 Cook、任意设备或重建 ADVSpike。要更换设备时先核对现有环境，再显式更新配置。

入口默认串行 iPhone/iPad；`--only iphone` 或 `--only ipad` 可仅跑一台。各工作区共用 `/tmp/advjs-studio-simulators-<uid>/<UDID>.lock`，禁用模拟器并行 worker；已有锁时停止，不自动抢占或回收旧锁。所有测试任务需使用入口，锁不能阻止外部直接使用 Xcode/simctl。

只在本次初始为 Shutdown 且 boot 确定成功时才负责关闭；原先已启动的设备保留。失败、SIGINT/SIGTERM 会等待本次子进程退出后尝试收尾；不确定状态、服务失联或无法捕获的 SIGKILL 需报告和人工核对，不强关、erase 或 delete。不自动删除模拟器及本地数据。

运行 P0 探针时同样使用入口：

```bash
node apps/studio-ios/scripts/simulator-session.mjs --only iphone -- test -project apps/studio-ios/spike/ios/StudioSpike.xcodeproj -scheme StudioSpike
```

无需启动真实模拟器的验证：

```bash
node --test apps/studio-ios/scripts/simulator-session.test.mjs
```


## 运行

以下命令从仓库根目录执行。干净检出时先构建引擎 golden 用例依赖的包（演示项目的模块配置会导入已构建的 `advjs`）：

```bash
pnpm prepare:workspace studio-ios
```

构建引擎（压缩、闭包与全局检查、体积预算），并复制到 StudioKit 资源：

```bash
pnpm -C apps/studio-ios build:engine
```

Node 端测试：打包产物在只有 ECMAScript 与 Intl 的沙箱中运行全部 golden 用例，并与 TypeScript 源码逐字节比较：

```bash
pnpm -C apps/studio-ios test:engine
```

生成 JavaScriptCore 端测试用的 golden 文件（写入 `engine/dist/golden/` 与 StudioKit 测试资源）：

```bash
pnpm -C apps/studio-ios golden
```

macOS 上的 JavaScriptCore：

```bash
swift test --package-path apps/studio-ios/Packages/StudioKit
```

iOS 模拟器上的 JavaScriptCore（在 `apps/studio-ios/Packages/StudioKit` 中执行）：

```bash
node ../../scripts/simulator-session.mjs -- test -scheme StudioKit
```

## 约定

- 引擎接口版本 `ENGINE_API_VERSION` 与 `EngineBridge.supportedAPIVersion` 同步提升；任何操作的输入或结果出现不兼容变化都要提升。
- 修改共享层时同时运行 Web Studio 单测（`pnpm -C apps/studio exec vitest run`）与上面的引擎测试。
- 引擎产物与 golden 文件是构建输出，不提交。
