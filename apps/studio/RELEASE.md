# ADV.JS Studio — TestFlight 内部测试发布清单

> 仓库内事先准备好的所有合规件都已就位。这份清单是把它们组装到原生工程并上传 TestFlight 的执行步骤。
>
> 目标:**TestFlight 内部测试组(最多 100 人)**。内部测试**无需** Beta App Review,只要应用在 App Store Connect 通过基础校验即可分发。

---

## 0. 前置环境

- [ ] macOS + Xcode 15+(命令行工具已 `xcode-select --install`)
- [ ] CocoaPods (`sudo gem install cocoapods`)
- [ ] 已有 Apple Developer Program 账号 + 已加入 Team
- [ ] Bundle ID `org.advjs.studio` 已在 Apple Developer Portal 注册
- [ ] App Store Connect 已创建 App 记录(SKU、主语言、分类:娱乐 / 工具)

---

## 1. 安装依赖与原生工程

```bash
# 以下命令均从 ADV.JS 仓库根目录执行

# 1. 同步 catalog 中新增的 @capacitor/ios 与 @capacitor/assets
pnpm install

# 2. 构建 Web 产物
pnpm -C apps/studio build

# 3. 创建 ios/ 原生工程(首次)
pnpm -C apps/studio cap:init:ios

# 4. 生成图标 / 启动页全套尺寸
pnpm -C apps/studio cap:assets

# 5. 同步 Web 产物 + 插件配置进 ios/
pnpm -C apps/studio cap:sync ios
```

校验:`apps/studio/ios/App/App/Info.plist` 与 `apps/studio/ios/App/App/Assets.xcassets/AppIcon.appiconset/` 都已生成。

---

## 2. 合并 iOS 模板到原生工程

`apps/studio/ios-templates/` 下的两份模板需要合并进 Capacitor 生成的工程:

### 2.1 Info.plist

打开 `apps/studio/ios/App/App/Info.plist`,把 `ios-templates/Info.plist.patch.xml` 中的 key 全部并入:

- `CFBundleShortVersionString` = `0.1.0`(与 `package.json` 一致)
- `CFBundleVersion` = `1`(每次上传 TestFlight 都要 +1)
- `CFBundleDisplayName` = `ADV.JS`
- `ITSAppUsesNonExemptEncryption` = `false` ← **避免年度出口合规填表**
- `NSPhotoLibraryUsageDescription`(中英双语)
- `NSDocumentsFolderUsageDescription`
- `LSApplicationCategoryType` = `public.app-category.entertainment`

### 2.2 PrivacyInfo.xcprivacy

复制 `ios-templates/PrivacyInfo.xcprivacy` 到 `ios/App/App/PrivacyInfo.xcprivacy`,在 Xcode 里:

- 右键 `App` target → Add Files → 选择 `PrivacyInfo.xcprivacy` → 勾选 "Copy items if needed" 与 App target

> 注:本应用不收集任何个人数据(`NSPrivacyCollectedDataTypes` = 空数组),只声明使用了 4 类 Required-Reason API(UserDefaults / FileTimestamp / SystemBootTime / DiskSpace)。

### 2.3 Pod 安装

```bash
cd apps/studio/ios/App
pod install --repo-update
```

---

## 3. Xcode 项目设置

打开 `apps/studio/ios/App/App.xcworkspace`(必须是 `.xcworkspace`,不是 `.xcodeproj`):

- [ ] **Signing & Capabilities** → 勾选 "Automatically manage signing",选 Team
- [ ] **General → Identity** → Bundle Identifier 显示为 `org.advjs.studio`
- [ ] **General → Deployment Info** → iOS Deployment Target ≥ 14.0(Capacitor 8 默认)
- [ ] **General → Frameworks, Libraries, and Embedded Content** → 确认 `Capacitor.framework`、`Cordova.framework` 等存在
- [ ] **Build Settings → Excluded Architectures** → 模拟器构建时排除 `arm64` 已不需要(M1 后不再要)

---

## 4. 真机自测(走一遍 `CAPACITOR.md` 清单)

至少在 **一台 iPhone 真机** + **一台 iPad** 上跑通:

- [ ] 启动后无白屏、无崩溃
- [ ] Safe Area 适配(刘海 / Home Indicator 不遮挡)
- [ ] 暗色模式自动切换正常
- [ ] 创建项目 → 写一章 → 退出再进入项目仍在(Capacitor Filesystem 写入 `Documents/advjs/<projectId>/`)
- [ ] 选择封面图(从相册)→ 系统弹权限 → 选图后正确显示
- [ ] AI 设置页填入 DeepSeek 测试 Key → 测试连接成功
- [ ] **首次启动不再弹 telemetry 弹窗**(已默认 deny)
- [ ] **「我的 → 设置 → 隐私」入口存在**,内部 toggle 可切换
- [ ] 触觉反馈在编辑器交互时触发
- [ ] 旋转屏幕不导致布局错乱(iPad)

---

## 5. Archive 与上传

```bash
# 在 Xcode 中:
# Product → Destination → Any iOS Device (arm64)
# Product → Archive
# Window → Organizer → 选刚生成的 Archive → Distribute App
#   → App Store Connect → Upload → 选签名 Profile → Upload
```

上传后等 5–15 分钟 App Store Connect 处理完成 → 进入 TestFlight 标签页:

- [ ] 上传的版本(`0.1.0 (1)`)出现在 Builds 列表
- [ ] 状态从 "Processing" → "Ready to Submit"
- [ ] 填入 What to Test(中英文)、测试人邮箱
- [ ] 创建 Internal Testing 测试组,加自己 + 团队成员

---

## 6. 内部测试分发

- [ ] App Store Connect → TestFlight → Internal Group → Add Testers(邮箱必须是 App Store Connect 用户角色)
- [ ] 测试员邮箱收到 TestFlight 邀请邮件 / 推送
- [ ] 在测试机上装 [TestFlight](https://apps.apple.com/app/testflight/id899247664),用同一 Apple ID 接受邀请并安装 ADV.JS

> 内部测试**不需要** Beta App Review。只要构建被 App Store Connect 接受、在测试组里发布,测试员立刻可以装。

---

## 7. 已知未做(发布后 follow-up)

| 项                                       | 影响范围                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| Android 原生工程                         | 一并上 Google Play Internal Testing 时再做 `pnpm cap:init:android`        |
| 隐私政策上线后端                         | `https://advjs.org/privacy` 要部署 docs 站点更新后才生效;App 内已埋好链接 |
| 服务条款 (ToS)                           | 内部测试不强制,但开外部测试 / App Store 上架前要写                        |
| App Store 截图(6.7" iPhone + 12.9" iPad) | 上架时必须;TestFlight 内测可不传                                          |
| `release:ios` 自动化(fastlane/match)     | 后续每次发版可省手工 archive                                              |
| 崩溃 / 体验埋点(Sentry / TelemetryDeck)  | 当前依赖自家 telemetry,可补云端聚合                                       |
| 已登录账户购买 credit 的代理后端         | AI Key 自填的下一步,等用户量起来再做                                      |
| TestFlight 外部测试(最多 10000 人)       | 需 Beta App Review,发布前补隐私政策 + 完整 ToS                            |
| Android Play Privacy Declarations        | Android 上架时另填一份 Data Safety 表单                                   |

---

## 8. 每次 TestFlight 发新版的最短动作

```bash
# 改 Info.plist 中的 CFBundleVersion(自增 1)
# 改 package.json 与 SettingsAboutPage.vue 的版本号(若是 marketing 版本变化)

pnpm -C apps/studio build
pnpm -C apps/studio cap:sync ios

# 然后 Xcode → Product → Archive → Distribute App → Upload
```

---

## 9. 应急:被审核打回(外部测试 / 上架时)

最常见原因与对策:

- **缺隐私 / 缺 Usage Description** → 比对 `ios-templates/Info.plist.patch.xml`,补缺失的 `NS*UsageDescription`
- **PrivacyInfo 与 App Privacy 问卷不一致** → App Store Connect → App Privacy 把数据收集都选"Data Not Collected"
- **App Tracking Transparency** → Studio 不做跨 app 追踪,无需 ATT
- **第三方 AI Key 被认为是引导外部交易** → 在 AI 设置页加文案:"You bring your own key for direct API access. ADV.JS Studio does not process payment for third-party AI providers." 已在 `useAiSettingsStore` 注释里说明,UI 文案保持中性

---

更新这份清单的频率:**每次发版前 review 一遍**。
