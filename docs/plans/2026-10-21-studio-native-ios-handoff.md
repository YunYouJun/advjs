# Studio 原生 App 执行交接

目标、任务和完成标准以[主计划](./2026-10-21-studio-native-ios)为准；本页只提供可复制的启动提示词，不维护第二份验收清单。

```text
在 /Users/yunyou/repos/github.com/YunYouJun/advjs 实施 iPhone／iPad SwiftUI 原生 ADV.JS Studio。

先阅读根目录及 apps/studio 的 AGENTS.md、docs/plans/2026-10-21-studio-native-ios.md、Studio 设计规范，以及已有的 docs/specs/2026-10-21-studio-native-ios-design.md 和 docs/reports/studio-native-ios-acceptance.md（如存在），并核对当前代码与 Git 状态。

沿用现有同目标 Goal；尚无实施 Goal 时，按主计划的“完成目标”创建。从 P0 开始：先完成功能盘点和 JavaScriptCore 引擎、WKWebView 播放器、原生登录三项可行性验证，把功能清单交给用户确认后再进入 P1。之后按 P1–P8 推进，持续更新主计划、设计规格与验收报告。

主计划中的范围、架构决策、体验预算和 N1–N16 是唯一验收标准。保留所有既有修改与其他会话的进展，不重做已验证工作，不覆盖或提交无关改动。常规选择自主推进；可行性不成立、需要服务端变更、签名或 App Store Connect 权限缺失等真实阻塞，记录证据、原因与下一步后询问用户。必需项全部通过后才能标记 Goal complete。

完成后按主计划提交并推送本任务变更，报告运行命令、产物、实机与模拟器验收结果、平台限制和提交 SHA。不得 force push，不得自动提交 App Review 或发布到 App Store。
```
