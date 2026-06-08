# Capacitor 原生构建指南

ADV.JS Studio 使用 [Capacitor](https://capacitorjs.com/) 将 Web 应用打包为 iOS/Android 原生应用。

> 想了解从零到 TestFlight 内部测试的完整路径,请阅读同目录下的 [`RELEASE.md`](./RELEASE.md)。

## 前置要求

- **iOS**: macOS + Xcode 15+ + CocoaPods (`sudo gem install cocoapods`)
- **Android**: JDK 17+ + Android Studio + Android SDK (API 33+)
- **资源生成**: `@capacitor/assets`(已加入 devDependencies)

## 快速开始

```bash
# 1. 构建 Web 产物
pnpm build

# 2. 初始化原生工程(首次)
pnpm cap:init:ios      # 创建 ios/ 目录
pnpm cap:init:android  # 创建 android/ 目录

# 3. 生成图标和启动页(首次或更换素材后)
pnpm cap:assets        # 调用 @capacitor/assets 同时生成 iOS/Android 全套尺寸

# 4. 同步 Web 产物到原生工程
pnpm cap:sync

# 5. 打开原生 IDE
pnpm cap:open:ios      # 打开 Xcode
pnpm cap:open:android  # 打开 Android Studio

# 或一键运行到模拟器 / 真机
pnpm cap:run:ios
pnpm cap:run:android
```

## 配置

应用配置在 [`capacitor.config.ts`](./capacitor.config.ts):

```ts
{
  appId: 'org.advjs.studio',
  appName: 'ADV.JS',
  webDir: 'dist',
}
```

## 已集成插件

| 插件 | 用途 | 封装位置 |
| ---- | ---- | -------- |
| `@capacitor/status-bar` | 状态栏样式(自适应暗色模式) | `src/utils/capacitor.ts` → `initStatusBar()` |
| `@capacitor/keyboard` | 键盘行为(Ionic 模式 resize) | `src/utils/capacitor.ts` → `initKeyboard()` |
| `@capacitor/haptics` | 触觉反馈(light/medium/heavy + notification) | `src/utils/capacitor.ts` → `hapticFeedback()` / `hapticNotification()` |
| `@capacitor/filesystem` | 原生文件系统 | `src/utils/fs/CapacitorFsAdapter.ts` |
| `@capacitor/app` | 应用生命周期 | 预留 |

## 资源生成 (`@capacitor/assets`)

替代过时的 `capacitor-resources`,统一使用 [`@capacitor/assets`](https://github.com/ionic-team/capacitor-assets):

```bash
pnpm cap:assets
# ↑ 等价于:
#   npx @capacitor/assets generate --iconBackgroundColor '#8b5cf6' \
#                                  --splashBackgroundColor '#ffffff' \
#                                  --ios --android
```

源素材:

- `resources/icon.png` — 1024×1024 PNG(已就位)
- `resources/splash.png` — 2732×2732 PNG(已就位)
- *可选* `resources/icon-foreground.png` 和 `resources/icon-background.png` — 用于 Android 自适应图标

## 开发流程

1. **修改代码**:像平常一样开发 `src/`
2. **调试**:
   - 在浏览器开发:`pnpm dev`(最快迭代)
   - 在模拟器调试:改代码后 `pnpm build && pnpm cap:sync`,再在 Xcode/Android Studio 里 Run
3. **热重载**(推荐):参考 [Capacitor Live Reload](https://capacitorjs.com/docs/guides/live-reload),在 `capacitor.config.ts` 中加入 `server.url` 指向本机 IP

## 平台特定验证清单

在真机/模拟器验证以下功能:

### iOS

- [ ] Safe Area 正确(状态栏 + Home Indicator 不遮挡)
- [ ] 暗色模式自动切换
- [ ] 键盘弹起时输入框可见(不被遮挡)
- [ ] `CapacitorFsAdapter` 可以读写 `Documents/` 目录
- [ ] 从相册选择封面图(File System Access 在 iOS 走 Capacitor Filesystem 分支)
- [ ] 触觉反馈在编辑器操作时触发
- [ ] **Service Worker 在 Capacitor 原生壳已被禁用**(由 `main.ts` 检测 `Capacitor.isNativePlatform()` 跳过 `useRegisterSW`,避免 WKWebView 缓存异常)

### Android

- [ ] 透明状态栏 overlay 模式工作正常
- [ ] 返回键行为正确(导航栈 pop)
- [ ] Safe Area 适配刘海屏/挖孔屏
- [ ] 文件选择器可用
- [ ] 键盘不覆盖输入框

## 常见问题

**Q: Xcode 报 `Pod install failed`**
A: 进入 `ios/App/` 执行 `pod install --repo-update`

**Q: Android Gradle 同步失败**
A: 确保 JDK 17+(`JAVA_HOME` 指向正确版本),首次同步需要网络下载依赖

**Q: 修改 Web 代码后原生应用没更新**
A: 必须重新 `pnpm build && pnpm cap:sync`,然后在 IDE 里 Run(或重启 app)

**Q: 旧文档中提到 `npx capacitor-resources`?**
A: 该工具已废弃。统一使用 `pnpm cap:assets`(底层即 `@capacitor/assets`)。

## 发布

完整 TestFlight 内部测试路径请看 [`RELEASE.md`](./RELEASE.md)。简要要点:

- 首次发版前替换 `resources/icon.png` 和 `resources/splash.png` 为最终视觉
- 在 Xcode 中设置开发者账号、Team、Bundle Identifier (`org.advjs.studio`)
- 配置 `Info.plist` 的 Usage Descriptions、`PrivacyInfo.xcprivacy`、`ITSAppUsesNonExemptEncryption=false`
- Archive → Upload to App Store Connect → 加入 TestFlight 内部测试组(最多 100 人)
- Android 发布参考 [Capacitor 官方指南](https://capacitorjs.com/docs/android/deploying-to-google-play)
