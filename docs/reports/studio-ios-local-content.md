# 原生 Studio 本地内容切片验收

日期为 2026-11-18。实现在独占工作树 `advjs-studio-ios-content`，以 GitHub `dev` 的 `c35c5045ac74f030dcdb1e291478c002edc92b36` 为基线。范围来自 [#92](https://github.com/YunYouJun/advjs/issues/92) 的本地内容路径。本记录涵盖本地实现和回归，P3 的整体验收沿用 [原生 Studio 实施计划](../plans/2026-10-21-studio-native-ios.md)。

## #95 原生内容管理

从项目分区「故事内容」进入角色、场景、地点和知识库。四类条目使用同一项目会话、文件协调、草稿和冲突恢复。编辑名称保留稳定 ID 和原文件路径，已有脚本引用可继续解析。知识库复用 Web Studio 的标题、领域和章节提取逻辑。校园恋爱模板补齐章节里四位说话角色的可索引文件。

- StudioKit 在临时真实项目中逐类创建、改名、保存、关闭重开及删除。角色和地点的未知 YAML 字段与原正文保留。外部写入发生于保存前时，提交被拒绝，元数据和本机草稿都能在重开时恢复。
- 引擎测试将原生写入内容交给 Web Studio 与 Editor 使用的共享解析器，校验名称、稳定 ID、未知扩展、地点的关联字段和场景提示词。文件复核覆盖中文、emoji 和 Markdown 正文。共享解析器验证使用同一入口，实际 Web 和桌面界面走查留待集成验收。
- CSV／JSON 含合法、冲突、非法行，验证跳过、重命名和覆盖都按输入顺序报告。角色与关系 CSV 的实际字符串用 Swift 测试核对，角色卡片用原生 ImageRenderer 生成，Markdown 分享使用已保存源码。

## #96 本地图片

接入相册、文件、拖放和支持相机的设备，目标是头像、具名立绘、场景背景和项目封面。转换后用内容哈希生成项目相对路径。RGBA 转换保留透明通道，普通 HEIC 以 JPEG 保存。最长边上限为 4096 像素，文件接收上限为 32 MiB。移除按钮清除引用，共用的图片文件仍可由其他条目使用。封面引用写入 `adv/settings/game.json`，Web Studio 项目设置复用同一读写规则。

StudioKit 验证格式识别与缩放、原字节保留、同名去重与替换、拒绝缺失资源，以及导出后重新导入仍能读取封面、立绘、背景及其字节。实体设备的相机、系统相册、iPad 跨应用拖放、Web Studio 与 Editor 的图片显示仍待跨端验收。

## #102 项目世界与关系图

项目内「世界」展示本地时钟、视角、玩家角色和两张关系图。图支持缩放、平移及点入对应内容表单，文字列表提供独立导航入口。地点按共有角色连线，角色关系按稳定 ID 定位到项目文件。时钟、视角和玩家角色偏好以项目 UUID 分域保存。

StudioKit 覆盖源文件名与显示名不同、重命名后的连线、共享角色及失效引用。本次切片的后续范围是自定义玩家角色、事件时间线及 CSV、日记、情感记录、项目切换和辅助功能设备验收。世界图可在本地创作项目读取已保存资料，不依赖试玩宿主或云端数据。

## 验证记录

| 检查                                                                      | 结果                                                                   |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `pnpm -C apps/studio-ios build:engine`                                    | 约 727 KiB，低于 768 KiB 预算                                          |
| `pnpm -C apps/studio-ios test:engine --hookTimeout 120000 --maxWorkers 2` | 25 项通过                                                              |
| `pnpm -C apps/studio-ios golden` 与 StudioKit                             | 386 个用例的 Node／JavaScriptCore 字节对比通过，StudioKit 共 36 项通过 |
| Web Studio 回归与类型检查                                                 | 107 个文件，897 项通过，`vue-tsc --noEmit` 通过                        |
| 共享模拟器锁脚本                                                          | 26 项通过                                                              |
| `xcodebuild build-for-testing`                                            | StudioApp 与测试目标编译通过                                           |

模拟器复用 iOS 27.0（24A434）的 iPhone 18 Pro 与 iPad Pro 11-inch（M5），通过 `apps/studio-ios/scripts/simulator-session.mjs` 串行测试。两台设备均通过 `testRenameCharacterKeepsFileAndOpensAfterRelaunch`。测试在项目里加入额外 YAML 和 Markdown，改名后检查实际文件，再退出 App 并重开列表。首轮 iPad 恢复到竖屏时，脚本找不到新建项目按钮。改用项目已有的横屏测试设置后通过。

- iPhone 首轮通过结果 `content-iphone.xcresult`，附件为 `native-content-character-renamed`。
- iPad 最终通过结果 `content-final-ipad.xcresult`，附件为英文浅色 `native-content-character-renamed` 和中文深色 `native-content-character-reopened-zh-dark`。抓屏画幅和横屏窗口不匹配，右侧裁切。窄窗和完整横屏的视觉检查待补。
- 测试结果、日志和按 #95 → #96 → #102 顺序校验的补丁均在工作树的 `evidence/content-authoring/`。

## 整合顺序

1. 在章节／试玩工作树已定稿的项目会话上整合 #95。保留章节的 project 路由及草稿／源码位置接口，同时保留内容的 `ContentRoute`。合并 `ProjectSection` 及其标题、图标和 iPad 选择；沿用同一套 source compare-and-write 与项目 watcher，避免两个草稿实现分别落盘。
2. 加入 #96 图片与封面，再加入 #102 的世界入口和现有详情路由。两者共享 #95 的文件及会话接口。世界图只依赖内容数据，可随 #96 独立集成。
3. 在 #106 同一测试版本复测导航与跨端使用。章节／试玩既有验收和 #97、#100、#101 继续沿用各自工单。
