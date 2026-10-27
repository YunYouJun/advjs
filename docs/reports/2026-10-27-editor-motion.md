# Editor 共享微动效验收

- 日期：2026-10-27。
- 状态：已完成；既有环境提示及验证边界见下文。
- 任务入口：[实施计划](/plans/2026-10-27-editor-motion)。长期规则：[AGUI 动画与焦点](/agui/design#动画与焦点)。
- 基线：`adefdfc0019010fc36882ef7a94664e123d5f509`；独立分支：`codex/editor-motion`，未改动原语音分支。

## 实现结果

共享 token 统一为控件反馈 120ms、浮层入场 150ms、Dialog 入场 180ms、退出 100ms。Popover、Select、DropdownMenu、Menubar 与子菜单共用淡入和最多 3px 位移；Dialog 保留居中 transform，以独立 scale 从 0.98 到 1 呈现，遮罩淡入。Portal 样式绑定真实 AGUI 类，未增加动效依赖或全局动画选择器。

Toast 立即更新 open，内容由 Reka Presence 卸载后释放记录，修复原先立即删列表项导致的退场缺失；滑动改用实际 `--reka-toast-swipe-*` 变量。超过三条即时回收最旧项，队列清空时卸载 Provider，避免最后一条滑动关闭后遗留暂停计时状态。

实际 Editor 原先以父级 `v-if` 直接卸载全局 Dialog，CSS 无法完成退出。新增 `AELazyDialog`，仅延续呈现层实例至内容卸载，保留异步加载与每次关闭后的实例回收；业务状态不等待动效。懒加载前捕获焦点来源，菜单触发的 Dialog 返回存活触发器，语言切换重建菜单项后返回同一位置。项目草稿撤销与整个宿主卸载仍优先即时关闭。

减少动态效果时显式禁用动画／过渡。浏览器可能在退出动画首帧前取消时不发送动画事件，因此运行中切换偏好会重建已关闭的 Presence 边界。打开的控件保持原实例和状态；没有业务计时器、第二份 open 或拖动插值。

## 浏览器验证

流程为：生产构建的真实 Editor → 临时离线项目的对白试听 → 音量浮层、素材菜单、偏好设置与通知 → 正常／减少动态效果下的操作、退场和卸载。

Browser 插件未提供，采用仓库已有 Playwright 1.64.0 与已安装 Chromium、WebKit。桌面视口为 1440×900；音频内容约束到 320px，另检查 200% 缩放、中英文和深浅主题。未将独立组件演示页作为 Editor 验收替代品。

| 检查                       | 实际结果                                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 页面身份、内容与错误覆盖层 | 标题为 ADV.JS Editor，真实项目、音频与工作区正常；无框架错误覆盖层                                          |
| 动效发生                   | 两浏览器记录入场、35ms 中间采样和结束事件；中间透明度介于 0 与 1，Dialog 中间 scale 介于 0.98 与 1          |
| 浮层与定位                 | 音量、Select、素材 DropdownMenu、根菜单及子菜单实际开合；视口顶部音量触发器使 Popover 翻转到 bottom，无溢出 |
| Dialog                     | 中心为视口中心，Tab 保留在对话框；退场内容和遮罩真实保留后移除，异步打开、快速重开与语言切换后焦点返回通过  |
| Toast                      | 手动、滑动、自动超时与三条上限替换通过；连续滑动后下一条仍会自动关闭                                        |
| 减少动态效果               | 显式 animation:none；退出期间切换偏好立即清理，打开的 Select 保持 DOM，恢复正常偏好后仍能操作               |
| 直接操作                   | 音量 Home／End 立即更新真实 audio.volume；进度键盘步进直接更新 currentTime；分栏拖动时 transition 为 0s     |
| 播放与文字                 | 使用实际媒体时钟播放／暂停与跳转；人工测试时间戳的活跃字随 currentTime 更新，没有每字动画                   |
| 布局与外观                 | 深浅主题、320px、中文／英文、200% 缩放截图保留；Portal 的系统字体、背景、圆角和阴影正确                     |

主要流程在 Chromium、WebKit 各通过 26 项检查，另覆盖退出首帧前切换偏好、打开状态保持、子菜单退出、根菜单切换、Dialog 快速重开和即时分栏拖动。正常模式保留真实动效采样；终态截图未以禁用动画的方式代替中间帧证据。

## 自动检查与构建

| 命令／入口                                                                                                                         | 结果                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 受影响文件 ESLint、git diff --check                                                                                                | 通过                                                                                |
| Vitest：agui-popover、agui-controls、agui-toast、agui-navigation、editor-lazy-dialog、audio-volume、audio-player、voice-transcript | 8 文件、33 项通过                                                                   |
| packages/gui typecheck；Editor Core typecheck                                                                                      | 通过                                                                                |
| GUI Vite 库构建、icons 生成、node unbuild                                                                                          | 通过                                                                                |
| Editor Core Nuxt production build                                                                                                  | 通过；通过 Nuxt build API 把 buildDir 与 Nitro 输出定向到任务临时目录，未制作分发包 |
| VRM Vite production build 与启动                                                                                                   | 构建通过，页面标题和画布启动；模型请求按任务约束拦截，未下载模型                    |
| docs:check；docs:build                                                                                                             | 通过                                                                                |

重建工作树依赖后，先按既定顺序构建运行依赖与插件，再执行 Nuxt 准备／类型检查。最初因缺少生成文件或包 dist 的检查失败，经准备后已重新通过，未修改依赖、锁文件或配置绕过检查。

## 证据与限制

本地证据保存在仓库外的任务可视化目录，包含 `motion-results.json`、`extra-results.json`、截图、基线对照、关键日志与复现脚本。它们只在本机可用，不随文档站部署：

- [主要浏览器记录](file:///Users/yunyou/.codex/visualizations/2026/10/27/01a17dc5-a903-7430-a816-a883a2cafd8e/editor-motion/motion-results.json)。
- [补充交互记录](file:///Users/yunyou/.codex/visualizations/2026/10/27/01a17dc5-a903-7430-a816-a883a2cafd8e/editor-motion/extra-results.json)。
- [320px 暗色音量浮层](file:///Users/yunyou/.codex/visualizations/2026/10/27/01a17dc5-a903-7430-a816-a883a2cafd8e/editor-motion/volume-320-dark-chromium.png)、[亮色减少动态效果](file:///Users/yunyou/.codex/visualizations/2026/10/27/01a17dc5-a903-7430-a816-a883a2cafd8e/editor-motion/volume-320-light-reduced-webkit.png)。
- [WebKit 基线同流程对照](file:///Users/yunyou/.codex/visualizations/2026/10/27/01a17dc5-a903-7430-a816-a883a2cafd8e/editor-motion/control-baseline-results.json)。

WebKit 在同一音频布局流程中出现 `ResizeObserver loop completed with undelivered notifications.`。对基线源码进行相同生产构建并执行相同流程，也复现该提示；减少动态效果的对照仍会出现。未将它视为本轮新增异常，也未在产品代码中过滤该事件。Chromium 主流程无页面异常；两浏览器均无新的功能错误。

离线项目只包含测试音调和人工时间戳，用于验证界面与真实媒体时钟的同步，不作为声学对齐准确性证据。未生成语音、调用对齐模型、下载模型、写入真实项目或清理用户素材。VRM 的完整模型加载与三维交互未验收；其唯一资源加载失败来自被主动拦截的示例 VRM 请求。GitHub／在线服务对话框未连接真实账号执行。

## 截图取景追加复核

用户指出音频面板看起来被截断。原先的 320px 图片通过局部样式收窄 `.ae-audio-workspace`，外层停靠区域仍约 841px，同时保留了滚到试听区的滚动位置；这些图片只能作为局部动效压力测试，不能当作完整音频面板或真实 320px 停靠布局的证据。原报告对取景的说明不充分，在此纠正。

追加复核未修改产品代码，也未向页面注入宽度样式。使用真实 Splitpanes 拖动，在 Chromium、WebKit 分别验证：

| 场景              | 实测与结果                                                                     |
| ----------------- | ------------------------------------------------------------------------------ |
| 1440×900 正常布局 | 音频内容与停靠容器均为约 841.08px，填满可用区域                                |
| 1168×900 窄窗口   | 实际拖动分栏至约 321.36px，内容和停靠容器宽度一致                              |
| 正文滚动          | 只有一个纵向主滚动区，顶部字段与底部操作均可访问；截图分别记录面板顶部和试听区 |
| 窄栏导航          | 标签栏支持横向滚动，最后的「供应商与清理」可完整显示；页面自身没有横向溢出     |
| 页面与业务状态    | 两浏览器均无页面异常，未发起生成／对齐／模型设置请求                           |

长表单超出面板高度时需要内部纵向滚动；窄栏的八个标签需要横向滚动。这两种滚动并不代表内容丢失。新的正常宽度截图不再留下「宽停靠区里只有一条窄内容」的误导性空白。

补充证据保存在仓库外的 `audio-panel-review/`，原动效证据仍按其历史取景保留：

- [正常布局 · 面板顶部](file:///Users/yunyou/.codex/visualizations/2026/10/27/01a17dc5-a903-7430-a816-a883a2cafd8e/audio-panel-review/normal-panel-top-dark-chromium.png)、[正常布局 · 试听区](file:///Users/yunyou/.codex/visualizations/2026/10/27/01a17dc5-a903-7430-a816-a883a2cafd8e/audio-panel-review/normal-player-dark-chromium.png)。
- [真实窄分栏 · 面板顶部](file:///Users/yunyou/.codex/visualizations/2026/10/27/01a17dc5-a903-7430-a816-a883a2cafd8e/audio-panel-review/actual-narrow-panel-top-dark-webkit.png)、[真实窄分栏 · 试听区](file:///Users/yunyou/.codex/visualizations/2026/10/27/01a17dc5-a903-7430-a816-a883a2cafd8e/audio-panel-review/actual-narrow-player-dark-webkit.png)。
- [Chromium 几何与可达性记录](file:///Users/yunyou/.codex/visualizations/2026/10/27/01a17dc5-a903-7430-a816-a883a2cafd8e/audio-panel-review/geometry-chromium.json)、[WebKit 记录](file:///Users/yunyou/.codex/visualizations/2026/10/27/01a17dc5-a903-7430-a816-a883a2cafd8e/audio-panel-review/geometry-webkit.json)。

## 产物回收

任务构建、离线项目、基线复现和中间文件均位于独占临时目录。验收完成后停止本轮服务器，回收可重建输出、基线副本与测试项目，仅保留小型证据；依赖和仍可复用的增量缓存继续保留。按 `du -sk` 计，本轮临时目录 532,992 KiB 与生成 API 文档 3,916 KiB 均降至 0，共回收 524.32 MiB；保留约 1.77 MiB 的截图、日志与复现证据。测量记录位于本地证据的 `cleanup.json`。

本次截图追加复核另回收 432.30 MiB 的临时生产构建、生成文档与离线项目；保留约 1.09 MiB 的新截图和几何记录。
