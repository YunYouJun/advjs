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
xcodebuild test -scheme StudioKit $(node ../../scripts/simulator-destinations.mjs)
```

## 约定

- 引擎接口版本 `ENGINE_API_VERSION` 与 `EngineBridge.supportedAPIVersion` 同步提升；任何操作的输入或结果出现不兼容变化都要提升。
- 修改共享层时同时运行 Web Studio 单测（`pnpm -C apps/studio exec vitest run`）与上面的引擎测试。
- 引擎产物与 golden 文件是构建输出，不提交。
