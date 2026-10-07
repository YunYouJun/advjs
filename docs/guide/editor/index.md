# Editor

`@advjs/editor` 是针对 PC 创作优化的 ADV.JS 编辑器。它既可以作为 [editor.advjs.org](https://editor.advjs.org) 在线使用，也可以由 CLI 在本地打开 Agent 正在修改的项目。

## 本地工作区

左侧「项目」浏览文件目录，单击文件后在中间「文件」标签预览或编辑。Markdown 可切换源码与阅读视图；人物文件同时打开右侧人物属性。底部「素材」支持图片、音频、视频与模型的筛选、搜索和缩略图／列表浏览，双击或 Enter 打开图片或音视频的主区域预览。模型暂只展示文件信息。

素材面板内的目录侧栏可折叠、拖动调宽，也可聚焦分隔条后用左右方向键调宽。工具栏保持一行，进入子目录后显示面包屑；搜索框旁的「浏览范围」菜单选择当前目录及子目录或全部素材。窄面板通过目录菜单返回上级，视图切换和定位操作收进操作菜单；高度较小时缩略图自动变紧凑。单击素材只选中并显示属性，可保持当前剧本与未保存内容；「在项目中定位」和「在素材中显示」用于双向定位。目录、侧栏宽度与开关、视图模式及浏览范围会保留到下次打开，窄面板默认收起侧栏。

文件修改后点击「保存」写回项目；打开另一个文件前需保存或点击「放弃修改」。切换游戏、流程图等视图会保留当前编辑内容。

```bash
adv editor /path/to/game
```

本地模式通过仅监听 `127.0.0.1` 的受限 bridge 读写项目目录：

- 打开章节、角色与场景 Markdown；
- 用结构化 patch 无损保存已知字段；
- 直接从源码编译并试玩，不要求先 build；
- 观察 Agent 的外部写入并实时刷新；
- 未保存内容与外部变更冲突时要求人工选择。

bridge 拒绝路径穿越、越界 symlink、非本机 Origin 和不受支持的方法。停止 CLI 后端口立即释放。

## 刷新与项目恢复

在线 Web Editor 通过 File System Access API 打开本地项目。当前项目引用和最近十个项目的目录句柄保存到 IndexedDB；刷新后从原目录重新读取并编译源码。面板布局继续使用现有的浏览器持久化状态。

- 目录的读写权限仍有效时自动恢复；
- 权限需要重新确认时显示“重新授权”，点击后继续打开原目录，无需重新选择；
- 目录被删除、移动或无法读取时显示恢复失败，可重试或重新选择文件夹；
- 老版本的最近项目记录只包含名称，首次重新打开仍需选择文件夹；
- 最近项目按目录身份区分，同名文件夹不会互相覆盖。移除记录同时移除该目录的恢复引用。

目录句柄可以通过 IndexedDB 的结构化克隆保存，不能通过 JSON/localStorage 保存。重新授权必须由用户点击触发，启动恢复只查询权限。详见 [File System Access 文档](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access#storing_file_handles_or_directory_handles_in_indexeddb)。清理站点数据会清除恢复记录；浏览器存储不可用时仍可打开和编辑项目，但无法保证下次恢复。

Local Bridge 模式仍由 `adv editor` 启动。首次连接将凭证从地址栏移除，并保存在当前标签页的 history entry 中，刷新和编辑器内路由切换后可以重新连接，不写入 localStorage/sessionStorage。CLI 必须保持运行；重启后使用新的启动链接。连接失败时显示重试入口，不自动切换到其他浏览器项目。

当前恢复范围是项目与已有的面板布局。尚未保存到源文件的编辑内容、当前打开文件和光标位置不在本次恢复范围内，刷新前仍需保存修改。

## Electron 桌面客户端

[桌面客户端](./desktop)托管同一 Vue Editor 与 `ProjectWorkspace`，提供原生打开／最近项目、角色／立绘／项目音频编辑、真实保存、外部刷新、独立游戏预览与 Web 目录／ZIP 导出。游戏预览没有桌面权限；打包后的应用自带运行时，不需要系统 Node.js、pnpm、本仓库或开发服务器。

桌面模式每次启动生成新凭据，由有限 preload API 注入当前会话，不通过地址栏或 Web Storage 传递。首版验收平台为 macOS arm64，签名、公证与自动更新不包含在本次交付。运行、打包、支持边界与证据见[使用文档](./desktop)及[验收报告](../../reports/electron-desktop-acceptance)。

## Agent 工作流

先使用 `adv agent install` 把 Skills 与 MCP 配置到 Codex、Claude Code 或 Cursor。Agent 负责批量生成、校验和审查，Editor 负责可视化精修、冲突处理和试玩；两者操作同一批 Markdown 文件。

## 支持范围

首发浏览器为 Chromium Stable。Ubuntu 覆盖完整 journey，macOS/Windows 覆盖 Editor 生命周期 smoke。Firefox、Safari、多人云协作和 Studio 的账号积分流程不在本地 Editor 首发范围内。
