# iOS Native Templates

`pnpm cap:init:ios` 之后(也就是有了 `apps/studio/ios/App/App/` 目录),把本目录里的内容**手工合并**到原生工程对应文件中:

| 模板文件                | 落地位置                            | 说明                                       |
| ----------------------- | ----------------------------------- | ------------------------------------------ |
| `Info.plist.patch.xml`  | `ios/App/App/Info.plist`            | App 元信息 + Usage Descriptions + 出口加密 |
| `PrivacyInfo.xcprivacy` | `ios/App/App/PrivacyInfo.xcprivacy` | iOS 17+ 强制要求的隐私清单                 |

> 这些不能直接覆盖 Capacitor 生成的文件——`cap sync` 时可能再生 `Info.plist` 的 `CFBundleVersion` 之类字段。安全做法是把模板里的 key 合并进现有 `Info.plist`,然后在 Xcode 里把两个文件加进 App target 即可。

## 关键决策

- **`ITSAppUsesNonExemptEncryption = false`** — Studio 仅使用 HTTPS 调用第三方 AI API,不含自定义加密算法,免出口合规年度报告
- **`NSPhotoLibraryUsageDescription`** — Studio 支持从相册选择封面图(`useProjectImport` / 角色头像选择会走 Photos picker)
- **`NSCameraUsageDescription`** — 暂不需要(未实现拍照功能,如以后加可补)
- **`NSAppTransportSecurity`** — 不放宽 ATS,确保所有第三方 API 走 HTTPS
- **PrivacyInfo 中的 `NSPrivacyAccessedAPITypes`** — 声明使用 UserDefaults 与 FileTimestamp(Capacitor Filesystem 使用),`Reason: CA92.1` / `C617.1` / `0A2A.1` 都是 Apple 官方允许的"app 自身功能"原因码

更换素材后要重新跑 `pnpm cap:assets` 才会更新 AppIcon.appiconset。
