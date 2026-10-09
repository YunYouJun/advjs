# 基础操作

> <https://editor.advjs.org>

## 切换语言 {#switch-language}

ADV.JS 编辑器支持多语言界面（目前支持 English 和 中文简体）。

### 首次使用

首次打开编辑器时，启动动画完成后会自动弹出语言选择引导界面，选择你偏好的语言即可。

### 通过 Preferences 切换

如果你需要在使用过程中切换语言，可以通过以下方式：

1. 点击菜单栏 `Edit > Preferences...`，或使用快捷键：
   - macOS: `⌘ ,`
   - Windows / Linux: `Ctrl + ,`
2. 在 Preferences 对话框左侧选择 **Interface**
3. 在右侧 **Language** 下拉框中选择目标语言

语言偏好会自动保存到浏览器本地存储中，下次打开编辑器时将自动恢复。

<!-- 截图占位：Preferences 对话框语言切换界面 -->

## 模型预览

独立模型预览页支持 glTF（`.gltf`）和二进制 GLB（`.glb`）。在 Editor 地址后使用 `/preview`，通过 `fileUrl` 查询参数传入可访问的模型地址；`type` 可选，省略时按文件扩展名识别。

例如在浏览器控制台构造当前 Editor 的预览地址：

```js
const preview = new URL('/preview', location.origin)
preview.searchParams.set('fileUrl', 'https://example.com/models/character.glb')
location.href = preview.href
```

将示例地址换成实际模型地址。远程服务须允许 Editor 来源访问模型及其关联纹理／缓冲区。查询参数由路由解码一次，使用 `URLSearchParams` 可以保留模型地址内的签名参数和编码字符。

加载时显示状态提示，完成后可拖动模型或缩放。glTF 同时显示只读 JSON 源码，窄窗口上下排列；GLB 只显示模型，不会把二进制文件作为 JSON 读取。加载失败后显示「重试」，未指定文件或格式不支持时显示对应提示。

此入口是独立预览页。项目文件树中的模型文件仍沿用当前格式支持范围。

## 验证模型加载

打开预览地址后确认模型出现，加载提示消失；glTF 的源码面板应显示 JSON。若加载失败，检查模型和外部资源地址、服务响应以及跨域设置，再点击「重试」。切换模型地址或离开页面后，旧源码请求会取消，不会覆盖新预览。
