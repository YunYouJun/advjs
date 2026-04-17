# Capacitor 原生构建指南

ADV.JS Studio 使用 [Capacitor](https://capacitorjs.com/) 将 Web 应用打包为 iOS/Android 原生应用。

## 前置要求

- **iOS**: macOS + Xcode 15+ + CocoaPods (`sudo gem install cocoapods`)
- **Android**: JDK 17+ + Android Studio + Android SDK (API 33+)

## 快速开始

```bash
# 1. 构建 Web 产物
pnpm build

# 2. 初始化原生工程（首次）
pnpm cap:init:ios      # 创建 ios/ 目录
pnpm cap:init:android  # 创建 android/ 目录

# 3. 同步 Web 产物到原生工程
pnpm cap:sync

# 4. 打开原生 IDE
pnpm cap:open:ios      # 打开 Xcode
pnpm cap:open:android  # 打开 Android Studio

# 或一键运行到模拟器 / 真机
pnpm cap:run:ios
pnpm cap:run:android
```

## 配置

应用配置在 [`capacitor.config.ts`](./capacitor.config.ts)：

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
| `@capacitor/status-bar` | 状态栏样式（自适应暗色模式） | `src/utils/capacitor.ts` → `initStatusBar()` |
| `@capacitor/keyboard` | 键盘行为（Ionic 模式 resize） | `src/utils/capacitor.ts` → `initKeyboard()` |
| `@capacitor/haptics` | 触觉反馈（light/medium/heavy + notification） | `src/utils/capacitor.ts` → `hapticFeedback()` / `hapticNotification()` |
| `@capacitor/filesystem` | 原生文件系统 | `src/utils/fs/CapacitorFsAdapter.ts` |
| `@capacitor/app` | 应用生命周期 | 预留 |

## 开发流程

1. **修改代码**：像平常一样开发 `src/`
2. **调试**：
   - 在浏览器开发：`pnpm dev`（最快迭代）
   - 在模拟器调试：改代码后 `pnpm build && pnpm cap:sync`，再在 Xcode/Android Studio 里 Run
3. **热重载**（推荐）：参考 [Capacitor Live Reload](https://capacitorjs.com/docs/guides/live-reload)，在 `capacitor.config.ts` 中加入 `server.url` 指向本机 IP

## 平台特定验证清单

在真机/模拟器验证以下功能：

### iOS
- [ ] Safe Area 正确（状态栏 + Home Indicator 不遮挡）
- [ ] 暗色模式自动切换
- [ ] 键盘弹起时输入框可见（不被遮挡）
- [ ] `CapacitorFsAdapter` 可以读写 `Documents/` 目录
- [ ] 从相册选择封面图（File System Access 在 iOS 走 Capacitor Filesystem 分支）
- [ ] 触觉反馈在编辑器操作时触发

### Android
- [ ] 透明状态栏 overlay 模式工作正常
- [ ] 返回键行为正确（导航栈 pop）
- [ ] Safe Area 适配刘海屏/挖孔屏
- [ ] 文件选择器可用
- [ ] 键盘不覆盖输入框

## 常见问题

**Q: Xcode 报 `Pod install failed`**
A: 进入 `ios/App/` 执行 `pod install --repo-update`

**Q: Android Gradle 同步失败**
A: 确保 JDK 17+（`JAVA_HOME` 指向正确版本），首次同步需要网络下载依赖

**Q: 修改 Web 代码后原生应用没更新**
A: 必须重新 `pnpm build && pnpm cap:sync`，然后在 IDE 里 Run（或重启 app）

## 发布

参考 [Capacitor iOS 发布指南](https://capacitorjs.com/docs/ios/deploying-to-app-store) 和 [Android 发布指南](https://capacitorjs.com/docs/android/deploying-to-google-play)。

发布前务必：
- 替换图标：`resources/icon.png` → 执行 `npx capacitor-resources` 生成各尺寸
- 配置启动页：`resources/splash.png`
- 在 Xcode 中设置开发者账号和 Bundle Identifier
- 在 Android Studio 中配置签名密钥
