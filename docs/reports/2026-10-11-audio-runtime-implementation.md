# 音频管理与统一协议验收

日期：2026-10-11；真实 COS、本地配对、Qwen 参数、音质与设备分层验证更新：2026-10-12

状态：真实本地 Qwen 两端作者执行／导出播放、真实 FFmpeg、限定 STS 的 COS 发布已通过；本轮客观音质／独立 ASR 与十四项浏览器播放矩阵通过，匿名试听评分包已准备。真人听审、第二台实际设备和原生 iOS 手势播放仍待验。作者选择先使用本地 TTS，云端 TTS 与持久云部署暂缓；完整范围与质量限制见下方记录

适用范围：AudioEngine、多轨混音、对白绑定、Qwen／OpenAI 复用、版本化音色设计、Editor／Studio 共享协议、认证服务端执行、持久任务、媒体处理、COS 发布、JSON Flow 编辑／构建与旧脚本迁移。

权威验收范围见[音频实施计划](/plans/2026-08-12-audio-system-implementation)，当前可执行流程见[音频指南](/guide/audio)。此前的[作者模块审核](/reports/2026-10-11-audio-authoring-audit)保留迁移前状态，本报告补充本轮结果。

## 已实现范围

- `packages/audio/`：平台中立 Engine、Mixer、Fake Backend、严格 JSON schema、UUIDv7、locale、朗读文本、输入指纹、Voice Ledger、共享作者服务和文件事务协议。
- `packages/client/audio/` 与 `useAdvAudio()`：MediaElement 长音频、AudioBuffer 短音频、有界解码缓存、用户手势解锁与统一游戏／预览宿主。
- 六条总线，BGM 交叉淡化、四个 Ambience 槽位、前景 Voice、SFX 优先级与分组限流、语义 UI cue，Voice 只 duck music／ambience。
- Runtime Program／Snapshot v2 使用 `stage.audio`。Markdown／Flow 使用相同音频操作与稳定对白 ID；历史操作只同步持久目标，取消 Voice／SFX。
- Auto 同时等待文字与语音，Skip 取消语音；设备音量不写入 Snapshot。
- 玩家六总线音量与静音独立持久化，恢复默认值回到项目 Mixer；解锁后预取当前及确定路径上的后两句，分支、历史与语言变化取消旧请求。
- `lineId + locale + selectedTake` 支持多语言独立 take、显式替换、immutable provenance、stale 警告、资源和哈希校验。
- `adv voice takes / generate / bind` 复用现有供应商注册表及 Qwen／OpenAI 插件。生成仅登记未选 take，选择必须携带最新 revision。
- Editor 通过有限 ProjectWorkspace API，Studio 通过 IFileSystem，均复用 `createProjectAudioService()`。注册与选用时重读实际媒体并校验字节／SHA-256；事务失败回滚元数据与本次导入。
- 同一服务提供六类资源导入、登记、资料编辑、引用预检删除和 Mixer revision/CAS。母版路径／哈希／字节不可被资料编辑覆盖；目录删除保留母版，仍被历史 take、参考、Mixer 或剧情引用时阻止删除。
- Editor 音频面板与 Studio 音频页接入原生资源库、多语言 take 审核／替换／清除、显式试听与项目混音配置。Editor 使用有限 loopback bridge，Studio 使用已认证的托管 HTTP 服务；候选登记为未选 take，采用仍须显式确认。未配置服务或未登录时禁用生成；对白审核试听已登记 take，音色设计另提供经过媒体校验的未登记候选直接试听。
- Editor Markdown 流程图节点与源码光标可编辑相同的音乐、环境音槽位与音效操作；严格使用原生资源用途和源文件 CAS，保留正文、对白 ID 与混合块的其他演出操作。源码应用进入 Monaco 撤销栈，正常保存；编辑的围栏规范化为 JSON `advnode`，内部 YAML 注释不保留。
- 两端角色表单编辑原生 `voiceProfile`；旁白使用独立项目 Profile，无需伪角色卡。项目发音词典提供全局与精确语言的最长字面匹配，显式朗读文本优先；词典／Profile 变化标记旧 take stale，保留历史和已选项。项目检查验证两个独立 JSON 文档；玩家角色投影移除作者音色意图、供应商绑定与授权路径。
- Editor `readDocuments()` 读取账本不会替换／撤销当前预览 URL；作者写入通过项目 Store 激活新的预览。
- 播放配置投影只保留各语言已选 take，不包含未采用历史或参考媒体。静态构建校验本地音频字节与目录哈希。
- `adv migrate-audio` 提供显式映射 dry-run、hash 重新校验、项目写锁、journal、原子替换与保护性恢复。迁移不支持旧存档。
- Hamster 章节、Pominis 导入与主题已改用统一协议，旧 BGM／Howler 编排已移除。素材与源文件哈希证据见[迁移记录](/reports/2026-10-11-audio-migration)。
- `jobs/` 实现计划、预算、状态机、Runner 与幂等恢复；Node Store 使用项目外 OS 应用数据、0600 权限、协作锁、fsync 与原子替换。Provider 并发跨同一 Runner 的不同 job 生效；采用已有 fingerprint 前验证实际媒体，缺能力或损坏时阻止提交和收费。
- 不确定请求先查询，无法查询时保持阻塞；已生成但登记失败的媒体不再次合成。至少 30 天幂等保留，未确定结果不因到期而丢弃；任务状态不存对白正文、私密提示词或供应商日志。
- 本地 Editor 提供整章／缺失／过期计划、预算审核、持久入队与显式运行，通过已认证的有限 loopback 项目 bridge 复用现有 Provider 注册表；单次最多 200 句。Studio 托管端使用相同 Planner／Runner、现有 Qwen／OpenAI 注册表及可信只读预设检查；服务端持久保存任务及幂等占用，浏览器私有 IndexedDB 保存离线队列。重连只恢复状态，必须重新同步、审核并显式运行才会生成，实际参数与单句 CLI 固化为同一指纹。
- `adv-audio-server <trusted-config.mjs>` 提供独立可启动 Node 服务。每个请求验证 Bearer 会话与真实账号，项目注册表和动态授权隔离账号／项目；限定原生 JSON 文档及媒体同步，不执行上传的配置或脚本。实际合成前再次核验权限、源文件、预设与授权；当前源语言对白使用当前节点文本，旧语言账本不会掩盖已修改的对白。
- Studio 根据 `VITE_ADVJS_VOICE_SERVICE_URL` 和现有登录会话接通服务。生成收据通过同一作者服务导入，保留原 asset／take ID、完整生成指纹与实际媒体哈希；未选候选不会自动播放或公开。切换账号／项目、刷新 token 和取消均检查当前会话；无法查询的未知请求保持阻塞，不重复收费。
- Studio 媒体在私有 IndexedDB 使用二进制及单事务持久化，兼容旧 Blob 记录。实际 WebKit 验收修复了 Blob 快照持久化卡住与分事务清空窗口，刷新后重读媒体仍可验证原字节。
- 合成前重读实际预设、角色／旁白 Profile、词典、授权与参考媒体；合成后保留可恢复收据，再重读当前输入和媒体登记条件。输入变化阻止登记，恢复已审查输入后复用收据。Node 角色源与预设检查在项目写锁内再执行，防止并发写入绕过复核。持久 Store 拒绝数组集合、错误摘要与未知费用字段。
- Node `processProjectAudio()` 使用共享固定参数生成真实 Opus／WebM 与 AAC／M4A 变体，记录 codec、时长、48 kHz、声道、LUFS、真峰值、哈希与字节。Voice 裁两端静音，保留内部停顿；极短 cue 峰值限制并允许综合响度不可测。母版保持原样，拒绝输出 symlink；取消只清理临时目录，保留可被并发任务复用的已验证 hash 文件。
- 工具链锁匹配可信 allowlist 的完整 FFmpeg 构建指纹与 Worker image digest；预览输出不可进入正式发布。`adv doctor` 检查编解码／滤镜能力。Node 发布宿主复用现有 `plugin-cos` SDK，保存项目外可信处理收据、审核计划和发布指针。后台转码任务可查询及重启恢复；单个服务进程最多同时处理两项，不启动新的 TTS 请求。
- COS 适配器使用禁止覆盖写入、实际 HEAD 元数据和 ETag 固定 GET 字节校验；不依赖 COS PUT 提供数据库 CAS。只允许从未开启版本控制的桶，最终上传内容哈希命名的公开音频 manifest，随后原子更新私有发布指针。公开目录只含当前采用的配音及音乐／环境音／音效／UI 变体，不含参考、未选历史、母版、授权或供应商信息。
- 显式发布前和幂等响应恢复均重读当前源、母版、变体与 voice 授权；manifest 写入后必须确认可读且字节一致才更新指针。授权变动、媒体篡改、对象冲突或 manifest 不可见时保留旧指针，不覆写已存在对象。
- `createLockedAudioContainerRunner()` 检查可信工具链及已安装镜像的实际 digest，通过只读项目、仅输出可写、禁网与资源限额运行有限 ffmpeg／ffprobe 命令。首阶段检查参数及拒绝路径；2026-10-12 续验已实际运行容器并发布真实 Qwen 配音，证据见下方。
- 发布执行重新生成规范对象键，核对可信宿主保存的处理收据与原生已选 take、完整工具链 allowlist 和全部 voice 授权；所有检查先于对象存储 I/O。拒绝一致伪造的客户端计划、source／kind 篡改、参考素材／未选 take／私有母版夹带；授权记录与公开 manifest 分离。
- 所有预览和正式游戏保留原生 Opus／AAC 变体；各本地变体分别验证自身字节与哈希，不能掩盖母版篡改。公开时长取可信处理收据中两种编码时长的最大值，验证作者目录错误时长不会进入发布。WebKit 长音频优先 AAC，只有实际媒体确认小于 20 秒的 Opus 可走解码回退；未知时长、长 Opus 无兼容变体时明确诊断，不让音量绕过混音图。
- 标准文件项目接入 `sourceFormat: flow` 与纯 JSON `.chapter.json`，使用同一 Flow Compiler／Runtime Program v2、稳定对白 ID、音频操作与配音账本。检查、场景／角色投影、媒体哈希校验与静态资源收集均走普通项目构建链；不会在浏览器加载作者 TS 模块。结构化音频修改使用原生源文件 CAS，两端完整 JSON Flow 可视化编辑使用同一纯命令、历史与原生 CAS 协议，见下方续建验收。
- 真实生产启动修复了客户端合并配置时拼接已验证章节／角色／场景数组的问题，避免重复章节阻止启动。`demo/flow` 保留原章节、分支和角色；缺失旧演示素材使用显式 SVG 占位及测试音频，并保留旧地址元数据，验收不代表最终美术或配乐质量。
- `adv build --audio-manifest <file-or-url> --audio-manifest-sha256 <revision>` 显式使用已发布清单。构建限制清单大小并校验内容哈希、公开 profile、完整变体集合、原生母版身份及当前 voice 对象键；母版实际字节仍校验，不打包。原生编译、对白 ID、选用 take、图像与角色资源保留同一协议，不改作者文件，缺少或不匹配的发布音频阻止构建。
- 标准原生项目的普通和发布构建均禁用整个 `public/` 目录的自动复制，按显式引用收集资源；普通构建收集运行时采用的本地音频，发布构建仅引用校验后的公开变体，避免夹带未选历史和参考媒体。Node 最终玩家序列化剥离所选 take 的授权记录与供应商参数，保留可播放身份与文本；完整作者账本仍用于上游严格校验。

## 前一阶段验证范围

作者最初明确选择先完成本地完整端到端验收。该阶段使用 Fake TTS、离线 WAV、实际 Node HTTP 服务、实际 FFmpeg，以及现有 COS SDK 连接本地 HTTP 对象存储测试端，没有调用付费接口、下载模型或访问真实 COS 桶。后续真实 Qwen 模型验收单独记录在下方；本地 SDK 验证不代表生产云端验收。

| 验证                                                 | 结果                                                                                                                                                                   |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 主仓库 `pnpm vitest run --exclude 'tests/launch/**'` | 221 文件／1348 项通过，包含最终服务、发布构建、玩家投影与客户端回归                                                                                                    |
| Studio 单测、类型与正式构建                          | 61 文件／457 项、类型检查和现代生产构建通过                                                                                                                            |
| Editor 组件／ProjectWorkspace 集成                   | 资源／账本 10 项、任务／bridge 17 项、真实音色／词典 AGUI 6 项；类型与正式构建通过                                                                                     |
| 持久任务专项                                         | 17 项通过，包括跨 job 并发、媒体篡改、输入变动、取消恢复、未知结果、重复提交与持久 Store                                                                               |
| 实际 FFmpeg 处理                                     | 3 项通过，包括两种真实变体、响度／峰值、短 cue、确定性复用、symlink 与交错取消                                                                                         |
| Node 发布、容器参数与 COS SDK HTTP 传输              | 7 项真实 FFmpeg 发布、2 项容器有限命令、3 项真实 SDK 传输通过；含五类公开音频变体、断点恢复、授权及母版变动、对象冲突和 manifest 不可见                                |
| 发布清单到标准构建                                   | 19 项通过：2 项真实 FFmpeg／COS SDK HTTP／普通 Flow 构建、15 项严格清单与 CLI、2 项克隆音色玩家投影；含实际母版篡改、缺失变体与私有资料排除                            |
| Studio 服务端与共享宿主协议                          | 16 项通过，覆盖 Bearer／项目隔离、有限原生同步、双供应商预设、唯一执行占用与有限发布路由；独立 Node 守护进程启动／认证／关闭冒烟通过                                   |
| Studio 服务端完整浏览器旅程                          | Chromium／WebKit 共 4 项通过，原 ID 配音导入／采用／同步／媒体重载、真实 Opus／AAC 处理与 COS SDK HTTP 发布；未知请求取消恢复不二次合成                                |
| Chromium／WebKit 音频专项                            | 4 项通过，含两种实际编码和混音路径／兼容回退                                                                                                                           |
| Editor 场景音频编辑                                  | 7 项通过，含编译后操作顺序、稳定对白 ID、用途约束、草稿冲突与源码应用                                                                                                  |
| 角色 TS 虚拟模块隔离                                 | 4 项通过，含真实 Flow 示例角色加载；Node 投影保留外观与重载，浏览器不导入作者源模块                                                                                    |
| Qwen Python 契约                                     | 16 项通过                                                                                                                                                              |
| Desktop 自身 Node 测试                               | 16 项通过                                                                                                                                                              |
| 原生 Flow 与客户端集合回归                           | 24 项原生 Flow、2 项客户端数组回归通过，含稳定 ID、结构化编辑、私有投影和源语言对白变更                                                                                |
| `demo/flow` 标准项目检查与构建                       | `adv check --json` 返回 `ok: true`、无诊断；标准生产构建通过                                                                                                           |
| Flow 生产玩家浏览器旅程                              | Chromium／WebKit 共 4 项通过，含两个分支、对白／旁白、稳定行 ID、真实音轨和音效、结束清理及 320px 原生选项点击                                                         |
| 已发布 Flow 生产玩家浏览器旅程                       | Chromium／WebKit 共 2 项通过，含真实 FFmpeg／COS SDK HTTP／固定清单标准构建、已选配音独立 RMS、多轨输出、编码选择、推进停止、8 个变体的 SHA／MIME／CORS 与私有资料排除 |
| 根类型、变更规范与文档检查                           | 类型检查、401 个变更源码／文档的 ESLint、`git diff --check`、46 个文档示例与 VitePress 构建通过                                                                        |

有序核心构建、最终 Audio／Core／Node 构建、根类型检查、Qwen／OpenAI／COS 插件构建及 Editor／Studio 正式构建均已通过。新增服务部署和 Flow 项目指南分别说明配置、协议边界及验收限制，见 [Studio 配音服务](/guide/studio/audio-service)与[序列化 Flow 项目](/guide/flow-projects)。

真实运行时专项覆盖 AudioContext／MediaElement／AudioBuffer，通过分析器 RMS 验证声音输出、音乐加四层环境音、Voice ducking、自然结束、历史取消瞬态、503 失败处理和销毁。1280×900 与 360×900 无横向溢出或未处理异常。

Editor 的四项 Chromium 旅程使用真实本地 bridge：历史 take 必须显式替换确认，Ledger 实际写回并重读媒体哈希；六总线 Mixer 保存；Flow 节点与 Monaco 源码音频属性修改、正常保存并保留对白 ID；角色 Profile、旁白与发音词典写回；预算审核、入队不调用供应商、显式执行两句并登记为未选 take。检查常规与 320px 面板截图，源码编辑按钮在 Monaco 加载完成后才启用。

此前 Studio 正式页面的两项 Chromium 旅程覆盖原生目录初始化、PCM WAV 导入、Mixer 保存、多语言选择／替换、试听、Ionic 离开清理、角色／旁白／词典、私有队列、离线恢复和账号隔离。本轮追加 Chromium／WebKit 各两项真实服务旅程：修改源对白后同步，服务端只调用一次测试供应商，媒体保留同一 ID 导入为未选候选，显式采用后重新同步，真实转码并审核发布；刷新后重读原媒体、已发布指针与任务，不二次合成。服务端合成使用测试 Provider，不能替代真实模型或云端账户验证。常规和 390px 截图无横向溢出，已人工检查 Studio 组件规范。

已发布 Flow 玩家测试在临时副本登记并选用 21 秒原创测试音，随后实际处理四个母版、发布八个变体与清单，再调用普通 `advBuild()`。Chromium 的音乐／环境音／配音使用 Opus，WebKit 使用 AAC；短音效使用解码 Opus。关闭音乐和环境音后，配音独立 RMS 分别为 0.1780／0.1880；恢复多轨后 RMS 分别为 0.01214／0.01043。推进对白立即停止配音，结局清理全部轨道；原母版和作者源保持不变，产物无 WAV、参考、私有 Profile、授权或供应商参数。正常与 320px 截图均已检查。

可复现最后一段发布／构建／玩家验收：

```bash
pnpm build:advjs
pnpm exec playwright test --config tests/fixtures/audio/published-flow.playwright.config.ts
```

用例将证明数据与截图写入系统临时目录下的 `advjs-published-flow-production-artifacts/`，无需真实模型、云凭据或外部对象存储。

## 音色设计与 JSON Flow 续建验收

本阶段继续使用前述本地验收边界。两端共享 `VoiceDesignPort`、原生音色库和 Core Flow 编辑协议，UI 分别遵守 Editor AGUI 与 Studio 组件规范。

- 音色库保留六类供应商无关意图、精确语言实现和不可变版本。当前 Qwen 支持 VoiceDesign 描述条件／Base 授权参考，OpenAI 支持内置音色／指令；操作由实际可信模板与插件能力决定。新版本使用新的库 ID，保留旧版本、作者扩展字段和其他语言／供应商绑定。
- 候选流程分为版本保存、预算审核、执行、临时试听、登记、样本选用和显式角色／旁白应用。执行前后校验当前源、预设、授权、参考媒体及项目 revision；浏览器试听核对真实媒体字节／SHA-256，并在隐藏、切换或卸载时释放 URL。采用样本不自动采用对白 take。
- 设计派生预设固定可信模型、revision、权重与哈希。原生同步不能将任意作者文件当作宿主模板覆盖；模板升级后已批准历史预设继续按原字节同步，新版本使用当前模板。等待供应商并发许可后，在派发前再次核验源、预设、参考与授权；排队时发生修改或删除同意文件不会发出请求。明确在供应商调用前失败或取消的候选需重新审核才可再运行，同一审核保持幂等；已发出且无法确认的请求继续阻塞。
- JSON Flow 编辑覆盖 start、dialogues、narration、choices、background、tachie、audio、end。共享纯命令处理节点、对白、条件分支、跨章连接、显式断开、入口、数组顺序和布局，历史支持撤销／重做。已存在节点／对白身份与未知作者字段保留，新增身份由 UUIDv7 生成。
- 原生保存按原文件 SHA／CAS 与完整项目编译验证；新章节和显式 `game.chapters` 在同一事务写入，保留旧入口。冲突保留可编辑草稿，失活只取消待处理请求；项目、账号或文件系统切换清理旧范围状态。合法压缩 JSON 不被误判为修改，省略类型的默认对白与旧 speaker 字段继续可编辑。
- Studio 原生章节发现、预览和 ZIP 导出读取同一 JSON Flow。导出携带作者库、设计预设、已登记媒体和所需同意文件；普通播放器构建仅收集明确的运行资源。未选音色样本、参考与作者私有参数不会被整目录复制到产物。
- 标准 Node 构建器每次解析当前项目根，不缓存首个项目的目录。追加同进程两个原生项目的隔离回归；真实 Chromium／WebKit ZIP 交接分别验证当前项目的构建根、输出目录与所选 take／asset 身份。
- 任务查询扫描原生项目时排除带 UUID 的内部事务暂存文件，避免目录读取与原子移动交错产生偶发 ENOENT；真正作者文件消失仍报错。窄屏对白与旁白复用客户端字号及玩家四档设置，默认实际至少 18px；未缩放画布与设置示例保留原字号。旁白复用控制栏高度测量避让多行正文，测量通过共同舞台传递，不另建 Observer。

| 本阶段验证                          | 结果                                                                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 主仓库普通单测                      | 231 文件／1403 项通过，包含排队复核、跨项目构建及暂存文件竞态回归                                                           |
| 设计域、插件、Node 和真实 HTTP 宿主 | 89 项定向用例及新增暂存文件竞态 4 项通过，覆盖多语言、可信模板、预算、实际字节、恢复和隔离                                  |
| Editor 音色组件与原 Profile         | 8 项新设计用例与 6 项既有 Profile 用例通过                                                                                  |
| 共享 Flow／Editor／原生编译         | 39 项通过，包含字符串退场的编译到运行时回归                                                                                 |
| Studio Flow 草稿与字段              | 3 文件／9 项通过，覆盖标签失活、冲突、晚到保存、压缩 JSON、默认对白和规范字段                                               |
| Studio 全量、类型与生产构建         | 65 文件／473 项、类型检查、现代生产构建通过；包含最后的字段、导出和试听标题修正                                             |
| 普通构建资源隔离                    | 真实生产构建与相关回归 5 项通过，显式资源保留，未采用媒体与无关 public 文件排除                                             |
| Editor 音色浏览器流程               | Chromium 2 项通过，实际 HTTP 候选 SHA／解码／RMS > 0.1、登记／选择／应用、精确语言与参考来源                                |
| Editor JSON Flow 浏览器流程         | Chromium／WebKit 2 项通过，编辑真实 demo → 重载 → 原子建章 → 标准构建 → 条件跨章结局；音乐／环境音均 playing，错误为空      |
| Editor 原有音频浏览器回归           | Chromium 4 项通过，资源／Mixer、场景与源码操作、人物 Profile／旁白／词典、整章任务                                          |
| Studio 设计／Flow 导出到播放器      | Chromium／WebKit 4 项通过，真实 HTTP 设计／配音 → 原生 ZIP → Node check／build → 当前已选声音与条件分支；未知取消不重复请求 |
| 两端类型与生产构建                  | Node、Editor、Studio 类型与生产构建通过；Studio 使用现代生产构建                                                            |

Editor 常规及 320px、Studio 常规及 390px 作者界面截图已检查。追加真实固定画布阅读回归 Chromium／WebKit 2 项及相关客户端 18 项通过；390px 默认对白／旁白实际 18px、姓名约 16.36px，多行旁白与控制栏保留约 13.57px 间隙，未缩放画布和设置示例四档保持 20／22／30／36px。播放器 proof 保存实际声音 RMS、当前 line／take／asset／SHA、独立构建根与字号，不以截图代替声音验证。静态测试服务器支持真实媒体 MIME、HEAD 和 Range，WebKit 验收不会依赖错误的整文件音频响应。

可复现本阶段实际 UI 与标准播放器流程：

```bash
pnpm build:advjs
pnpm editor:build
VITE_LEGACY_BUILD=false pnpm studio:build
pnpm exec playwright test --config tests/fixtures/audio/editor-voice-design.playwright.config.ts
pnpm exec playwright test --config tests/fixtures/audio/editor-native-flow.playwright.config.ts
pnpm exec playwright test --config tests/fixtures/audio/editor.playwright.config.ts
pnpm exec playwright test --config apps/studio/tests/e2e/design-flow.playwright.config.ts
ADV_TEST_GAME_URL=http://127.0.0.1:3362 pnpm exec playwright test --config tests/fixtures/reading.playwright.config.ts
```

该阶段的独立 design-flow browser fixtures 使用实际 workspace UI、Node HTTP 服务和普通项目编译／构建入口。测试供应商生成原创可听 WAV，没有调用真实 Qwen 模型或付费 TTS；原生导出项目与阅读 proof 保存在系统临时目录，Studio 玩家 proof／截图写入 `test-results/studio-design-flow/`，测试不修改仓库 demo。下方真实 Qwen fixtures 使用独立的显式入口与证据目录。

## Qwen 本地行为

当前 MLX 后端仅支持 Apple Silicon Mac。`adv voice setup` 显式创建 Python 3.12 环境并安装固定依赖，不下载模型。首次在线 preview／generate 下载作者预设指定的固定 revision 模型，并校验权重 SHA-256；`--offline` 缓存不足时失败，不联网。不会自动选择模型或补写配置。

BF16 1.7B 模型与 tokenizer 约 4.5 GB，建议预留至少 16 GB 统一内存。此前 Fake 供应商阶段仅验证 Python 模块和合成服务契约，没有实际下载模型、装新环境或生成真实 Qwen 音频；以下续验单独记录实际模型结果。

### 真实环境与固定模型

作者随后明确要求自动配置环境、下载模型并完成真实本地验收。2026-10-11 在 Apple M1 Pro、32 GiB 统一内存、macOS 26 上完成插件原有 CLI setup／doctor；隔离环境为 Python 3.12.13、MLX Audio 0.5.8、MLX／MLX Metal 0.32.3、Transformers 5.19.0、NumPy 2.5.3。Node 为 24.18.0，pnpm 为 11.20.0，uv 为 0.12.3。

独立项目保存在本机 `~/Library/Caches/ADV.JS/real-qwen-20261011/`。环境、模型、CLI 回执和真实 WAV 位于其中的 `.advjs/voice/`，未进入仓库或播放器。模型缓存实际占用约 7.8 GiB，共享 tokenizer 按内容去重。首次下载 VoiceDesign／Base 分别约 88.06／72.70 秒；这是本机此次下载记录，不是通用性能承诺。

| 模型                                                                                          | 固定 revision                              | 主权重 SHA-256                                                     |
| --------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| [VoiceDesign BF16](https://huggingface.co/mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-bf16) | `7d3824abff87e49756bb0f83fb5411de75d160c4` | `96ae28bec2205ec0b5e0c750bea2b8a5deac4f14d33a8a25a5f753299486b70e` |
| [Base BF16](https://huggingface.co/mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16)               | `a6eb4f68e4b056f1215157bb696209bc82a6db48` | `81fb76175ff74e69be25fef2cc3e54f016df3034f1514c8e1c89da06a3510cff` |

两个 `speech_tokenizer/model.safetensors` 均实际核验为 `836b7b357f5ea43e889936a3709af68dfe3751881acefe4ecf0dbd30ba571258`。MLX Metal 的首次 uv 下载中断后，下载同版本官方 PyPI wheel、核验发布 SHA-256，再继续原 CLI setup；没有放宽依赖锁、伪造环境 stamp 或采用其他模型。

### 真实 CLI 冒烟

实际 `createQwenTtsProvider()` 首先生成原创虚构人物的 VoiceDesign 样本，再用同一字节／转录作为 Base ICL 参考生成新对白。参考记录明确包含 `humanVoice: false` 与 `humanConsentClaimed: false`，没有使用真人录音或将合成来源冒充真人授权。

| 调用        | 实际时长 | WAV 字节 | PCM RMS  | generationSeconds | MLX peakMemoryBytes |
| ----------- | -------- | -------- | -------- | ----------------- | ------------------- |
| VoiceDesign | 7.20 秒  | 345644   | 0.122366 | 7.227             | 7876687195          |
| Base ICL    | 4.08 秒  | 195884   | 0.100418 | 6.927             | 9062603433          |

两份输出均为真实 24 kHz、单声道、16-bit PCM WAV；SHA-256 分别为 `047473d603b995b8ceabee5598a61feb78dd36408066340aa9d75b1bd539c54b` 和 `0ac06cb0a183205914a56046987124d4b54ffa0a61b25259f2b2fc417946a4e8`。`generationSeconds` 是插件记录的生成时间，未包含环境安装、下载、模型载入与权重核验；MLX 峰值不代表整个系统的内存占用。

准备流程保存 `real-qwen-ready.json` 与两个真实 manifest，完整保留模型／revision／运行库／输入／媒体 provenance。两端后续执行强制 `offline: true`；缓存或可信预设变化即失败，不回退到测试波形或在线下载。

### Editor 真实完整旅程

默认 `pnpm e2e:qwen:editor` 完整旅程通过，正式运行 `run-1791729624879` 共四次真实合成，未使用恢复分支：VoiceDesign 试听、设计对白、Base ICL 试听、Base 新对白。所有调用均经现有 Qwen 工厂并强制离线，试听界面实际校验／解码原 WAV。音色样本登记、样本选择、人物应用与对白 take 选择分别通过真实 AGUI 控件执行；Base 参考由本轮原创 VoiceDesign WAV 经资源导入界面登记，参考哈希与原样本相同。

JSON Flow 旅程修改对白及布局，验证撤销／重做、保存／重载、稳定 `lineId` 与原作者字段，创建显式新章节，设置条件与跨章目标并保留 `next: null`。设计对白通过普通 `advBuild()`；Base 新对白生成后旧 take 仍选用，明确替换确认后才切换。最终 Base 玩家在 Chromium／WebKit 实际通过同一 AudioEngine 播放，分析器 RMS 分别为 0.00913069／0.00252217，实际媒体 SHA-256 为 `0fca2d77ceef051a09d0175a90c321534247013fc8c75ea83a7906389a71fd0c`。运行时只有 Voice 总线播放，采用的 line／take／asset 身份一致，条件跨章与停止配音通过，没有页面异常或编译诊断。

两种玩家产物各只含一份实际采用的 WAV；设计版哈希为 `e334d0ad77a23fdad01777c64f513b2c0d42d27c58a55c9b9aab1560c92181b5`。原生项目目录／ZIP、设计版与 Base 版播放器、正式 proof 和实际 14 张界面截图独立归档，模型／环境未进入原生 ZIP，未采用样本／历史、参考、授权文档与供应商参数未进入播放器。正常／320px 作者面板与正常／390px 两浏览器玩家截图已检查；结局补屏等候旁白全文显示，不新增合成。

实际修复了两个跨宿主契约缺口：原生导入的参考资源没有 `characterId` 时允许按审核定义使用，明确不同角色仍拒绝；Node 项目读取器按账本及角色／旁白 Profile 的原生引用加载 `.json`／`.md`／`.txt` 授权文档，每份最多 64 KiB，检查真实项目根和 symlink，不扫描整个 `authoring/`。此前未读取这些文档导致 Editor 拒绝选用 Base 配音及普通构建诊断；新增有限 bridge／loader／玩家私密投影回归后，真实选择及普通构建均通过。

Editor 调试总计实际九次合成：首次测试等待逻辑错误前一次，第二次发现授权文档读取缺口前四次，最终默认完整复验四次。第二次的真实产物在修复后零新增合成完成恢复验收；没有将失败尝试隐藏成四次调用。`editor-real-qwen-call-audit.json` 与原始 manifest 保存完整记录，正式 proof 标识 `resumedAfterSelectionFailure: false`。

共享 Start 解锁修复后，另从正式原生 ZIP 在独立目录普通构建，以原 Base 母带做零模型双浏览器补验。正常点击 Start 即为 running，无额外解锁手势，首句保持；最终 Chromium／WebKit RMS 为 0.00043633／0.00205544，唯一 WAV 仍为 `0fca2d77ceef051a09d0175a90c321534247013fc8c75ea83a7906389a71fd0c`，111404 字节。对白、正常／390px 正文 18px 与姓名约 16.36px、条件结局和声音停止均通过。`start-recheck-proof.json` 及另外八张完整对白／结局截图保存补验；未改正式 proof、未运行作者宿主或修改共享项目，全部临时服务及浏览器已关闭。

### Studio 真实作者执行与导出

正式运行 `mv3yh2ah` 经真实 Studio 控件与认证 Node HTTP 服务完成四次离线合成：设计试听／对白，再导入本轮原创样本、创建 Base ICL 定义并生成试听／新对白。审核新不可变版本、登记和选择样本、替换 Profile、审核 stale 计划、执行与显式替换 take 均保留独立操作；旧设计对白在新声音生成后仍被选用，直到作者明确替换。参考资源没有预先分配 `characterId`，实际哈希与设计试听一致；来源记录明确为合成声音，不声称真人授权。

| 调用             | 实际时长   | WAV 字节 | PCM RMS  | SHA-256                                                            |
| ---------------- | ---------- | -------- | -------- | ------------------------------------------------------------------ |
| VoiceDesign 试听 | 8.56 秒    | 410924   | 0.085902 | `59c5399386edfce26317cc54bac3a1ecb4dac96cd12b7c4e4a4a2e962aa8f8c6` |
| VoiceDesign 对白 | 1.84 秒    | 88364    | 0.087064 | `108eaffbac260228580cfaacc4353973424e68d7f5022c049dfa0c08d85b83d6` |
| Base ICL 试听    | 8.63929 秒 | 414730   | 0.081187 | `678cb9f89ebc249be7f1f19e01d78629d01c0ca3296525c4abf051baf3e36101` |
| Base ICL 对白    | 2.44408 秒 | 117360   | 0.064142 | `9b0552bf3496034a09ebcac1f9caba9292f73c2203bac79bbc1451d11c753432` |

JSON Flow 修改对白、布局、条件和跨章目标，通过撤销／重做、保存／重载保持稳定身份及原作者字段。两次实际原生 ZIP 经过独立解压、普通 `adv check`／`advBuild()`，完整保留作者音色与 take 历史。导出检查发现孤儿行的历史选中媒体仍被打包；共享 Runtime 投影已改为依据已编译 Program 的对白／旁白 `lineId` 集合过滤，再保留当前行每种语言的已选 take。Markdown／Flow 使用同一规则，没有有效 Program 时不发布历史配音；作者原账本不变。

另修复了共享“开始游戏”动作的首次音频解锁：在原 Start 点击中立即调用既有 `$audio.unlock()`，随后导航，不等待解锁 Promise。此前捕获手势的 `AdvGame` 尚未挂载，首句需要另一次点击，而短对白可能被该点击直接推进。解锁延迟、拒绝或宿主异常均不阻断导航；新增真实 Vue／Pinia／memory-router／DOM 点击回归验证调用时机和目标章节。

两份原生导出按最新共享代码重新普通构建，以相同真实音频完成零模型补验：Chromium／WebKit 各验证设计与 Base 两种声音，正常点击 Start 后音频上下文为 running，首句保持，不使用额外解锁手势。分析器测得如下实际 Voice 总线输出；条件跨章结局、准确 line／take／asset 身份、完整文字与正常／390px 默认 18px 阅读字号均通过，播放器错误及编译诊断为空。

| 声音             | Chromium RMS | WebKit RMS |
| ---------------- | ------------ | ---------- |
| VoiceDesign 对白 | 0.146855     | 0.191711   |
| Base ICL 对白    | 0.033217     | 0.004355   |

独立检查实际构建目录：每份仅一份当前采用的 WAV，字节／SHA 与相应 take 和资源一致；运行配置只有本轮当前行和已选资源，孤儿历史、未选 take、音色样本、参考、授权与供应商参数未进入玩家包。原生作者 check 保留既有孤儿行警告供审核，错误为空；完整历史留在作者项目。

Studio 共九次真实合成：四次作者执行尝试分别为 1／2／2／4 次；另一次在调用前发现测试控件不匹配，零次合成。测试修复覆盖门户下拉、封装输入、等待逻辑和新音色版本显式选择。正式作者执行四次全部成功；默认测试在设计版错误要求后续 Base 授权文件的测试断言处退出，四份真实产物和两个原生导出均保留。修正测试与两个生产缺口后，正常 Start 的补验两项通过，覆盖四次实际播放器旅程，不新增合成；此前使用阅读区解锁的补屏证据仅作为历史保留。

### 音频与缓存独立核验

逐份读取全部真实 manifest 与原 WAV，共 20 份：CLI 2、Editor 9、Studio 9，其中 VoiceDesign 13、Base ICL 7。所有媒体哈希／字节、固定模型 revision、MLX 引擎 provenance、24 kHz 单声道 16-bit PCM 与声明时长一致；实际时长 1.84–8.63929 秒，PCM RMS 0.064142–0.122366，峰值 0.425934–0.679474，无削波样本。插件记录的生成时间为 1.555–10.137 秒，未包含环境准备、下载和模型载入；MLX 峰值内存为 6091435017–9653837661 字节，不代表整个系统的内存占用，也不是跨设备性能承诺。

关闭模型与作者服务后，只运行一次强制离线 warm prepare，`reused: true`、`doctorReady: true`，新增合成零次。50 个原生作者文件共 6794695 字节的路径／字节／SHA 与目录清单前后完全一致；20 份预览 manifest 的路径与哈希、环境 requirements stamp、原 READY 回执也完全不变。环境匹配时 setup 直接复用，doctor 仅读取运行库元数据。

持久证据保存在独立项目的 `.advjs/voice/`：`real-qwen-ready.json`、`real-qwen-audio-audit.json`、`real-qwen-cache-reuse.json`、`studio-player-independent-audit.json` 与 `acceptance/editor/`、`acceptance/studio/`。Editor 的正式 22 个归档文件逐字节及 SHA-256 核验，包括正式 proof、调用审计、原生 ZIP、14 张实际截图和两份正式试听 WAV；增加正常 Start 补验后总计 31 文件／22 张截图，原正式 proof 哈希不变。Studio 索引 45 个文件，包含真实调用、作者证明、四份播放器 proof、18 张实际截图及四份 WAV，全部逐字节及 SHA 核验；本轮两个 ZIP 归档按实际原导出的完整条目字节重装，另存每项 SHA，不声称与未保存的原压缩 ZIP 字节相同。后续 fixture 直接保存接收到的原 ZIP。模型、环境和验收记录不进入仓库或玩家包。

### 真实续验回归与复现

环境准备后，两端完整入口按顺序运行，普通 CI 不启用真实模型：

```bash
pnpm e2e:qwen:prepare
pnpm e2e:qwen:editor
pnpm e2e:qwen:studio
```

这些命令复用现有 Qwen 插件；前置包／两端界面构建、独立目录和来源记录见[作者语音指南](/guide/authoring-voice#仓库真实-qwen-验收)。本次 Studio 后段补验命令为 `ADVJS_REAL_QWEN=1 ADVJS_REAL_QWEN_STUDIO_REPLAY=<本轮产物目录> pnpm exec playwright test --config apps/studio/tests/e2e/real-qwen-recovery.playwright.config.ts`，仅对已导出的项目 check／build／播放，不启动 Provider 或修改共享作者文件。

Core 孤儿过滤与授权读取修复后的全套单测 235 文件／1426 项通过；随后新增 Start 动作 6 项与既有 Client 音频 8 项共 14 项通过。根严格类型检查、两包正式构建、两端真实 fixture 类型及定向 ESLint 均通过。Python 参考契约 18 项和准备／预览相关 TS 25 项通过。文档检查 46 文件、VitePress 正式构建及 `git diff --check` 通过；独立重读两端归档的全部文件并逐 SHA 核验通过，临时服务、浏览器及模型进程均已关闭。

## 2026-10-12 本地 TTS 与真实 COS 续验

作者此前请求自动配置真实 COS 与 Studio 云端验收，本轮完成云资源只读核查、独立部署接线与实际 COS 发布。作者随后明确先使用本地 TTS，执行范围调整为既有 Qwen 本机生成、Editor／Studio 共用协议，以及真实 COS 派生音频发布／普通 JSON Flow 构建／双浏览器播放；不继续开通 CFS、配置 OpenAI 云凭据或部署云端 TTS。

### 实际存储目标与权限

原候选私有桶 `yunlefun-advjs-prod-1325586649` 在限定授权后实际查询为版本控制 Enabled。COS 的禁止覆盖保护不适用于已开启版本控制的桶，因此拒绝在该桶发布，没有更改其版本或私有原件策略。经作者确认创建并绑定的 `advjs-audio-acceptance-20261012` 策略在核查后已解除账号绑定，策略本身保留供审计；没有遗留这次新增的用户授权。

实际发布选择既有上海桶 `yunlefun-assets-prod-1325586649` 的独立前缀 `games/advjs-audio-acceptance-20261012/v1/`。通过 STS `GetCallerIdentity` 确认签发源为现有受限 CAM 子账号，并使用 30 分钟会话；工作权限只含桶版本状态读取及该前缀 GET／HEAD／PUT，真实列目录请求返回 403。桶版本状态实际为从未开启。没有把长期密钥、临时凭据或签名 URL 写入项目、日志和验收证据。

实际合并一条限定此前缀的匿名 GET／HEAD 桶策略，桶 ACL 仍为 private，原有策略保留。既有 CORS 的通配 Origin 和 GET／HEAD 方法保持原样，仅补充 `Cache-Control`、`Content-Length`、`Content-Type`、`ETag` 与 `x-cos-meta-sha256` 暴露头。两次配置写入后按键排序核对完整语义，既有规则及本次新增项均一致；首次对象键书写顺序不同导致的比较失败已纠正，最终复读通过。配置前后证据保存在私有验收目录。

### 实际锁定容器与发布身份

使用已有 Colima daemon 的明确 `colima` context，没有切换用户的全局 context 或重建 VM。官方 Debian Linux/arm64 基础 manifest 为 `sha256:a1b86db52ce3daef089e45aabe36dfec4091f82464c25c1fdcf03de197cbe82a`，实际安装的 FFmpeg 包为 `7:5.1.9-0+deb12u1`。核验后批准的本地 worker image ID 为 `sha256:4bc45f1a1edf091c51f6d86c306e215c6542e0dcb79e6d15309c78587fe97d32`，完整 FFmpeg 指纹为 `ce33e58763d35ba3bfb21e384018bda0a7ed76e39912d8b1ee27ea6e20a67283`。这是实测本地 Linux/arm64 image ID，未推送 registry，也不代表其他架构批准。

共享 `createLockedAudioContainerRunner()` 实际核验安装镜像，采用禁网、只读根和项目挂载、独立可写输出、资源限额及无新增权限运行 FFmpeg／ffprobe。Opus、AAC、loudnorm、trim 能力全部通过；实际向只读项目写入被拒绝，母版字节不变。独立短音频冒烟与本次真实对白转码均使用同一 Runner，不以命令参数测试代替容器实测。

实际发布源为前一阶段已验收的 Studio VoiceDesign 原生 JSON Flow 导出副本，没有新增模型调用，也没有重写原导出目录：

| 身份                    | 值                                                                           |
| ----------------------- | ---------------------------------------------------------------------------- |
| 当前对白                | `line_01a12b7f-e3d9-7000-801e-0b7100946087`，`zh-CN`，你好，我们一起出发吧。 |
| 当前 take               | `take_01a12b80-ba52-7001-b625-173012492be5`                                  |
| 逻辑 asset              | `audio_01a12b80-ba52-7000-a7b1-6e030ab0a09a`                                 |
| 母版 SHA-256            | `108eaffbac260228580cfaacc4353973424e68d7f5022c049dfa0c08d85b83d6`           |
| Provider／模型 revision | 现有 `qwen-tts`／`7d3824abff87e49756bb0f83fb5411de75d160c4`                  |

处理与发布复用现有 Node publication host、共享计划／可信收据和 `plugin-cos`。默认准备只选当前编译剧情中的采用音频，真实审核结果为 1 个 asset、2 个变体、56484 字节。实际成功上传 3 个对象：两份变体及最后上传的内容哈希 manifest；上传后以 HEAD 的强 ETag 固定 GET 核对实际字节，再更新项目外持久指针。

| 公开产物                 |  字节 | SHA-256                                                            |
| ------------------------ | ----: | ------------------------------------------------------------------ |
| Opus／WebM，`audio/webm` | 24510 | `c3d799fe8b0da0bd574316d8b824c36b4250e56e598277bc7e9e3317cb91a59d` |
| AAC／M4A，`audio/mp4`    | 31974 | `a2d7b6a0b39c997379124b314f57de1f14335e1845587cd02f8419ec210e4d09` |
| 公开 manifest            |  1270 | `4c63640f60d360c804172ebfe51b68c6413e79d2111303282aac9e0d428c5cd2` |

公开 [manifest](https://yunlefun-assets-prod-1325586649.cos.ap-shanghai.myqcloud.com/games/advjs-audio-acceptance-20261012/v1/manifests/assets.4c63640f60d360c804172ebfe51b68c6413e79d2111303282aac9e0d428c5cd2.json) 匿名返回 200，完整下载 SHA 相符。随后用相同禁止覆盖 PUT 进行受限负向验收，实际返回 `409 FileAlreadyExists`；ETag、最后修改时间与完整字节仍相同，没有成功覆盖。重启 publication host 后重复原审核请求，返回同一发布指针，新增 PUT 为 0。

### 实际公开 HTTP 与双浏览器播放

新增只读 `audio:audit:cloud` 对真实 HTTPS 执行 10 GET、6 HEAD、12 OPTIONS，源站与公开地址的 manifest／两个完整变体 SHA、字节、MIME、checksum 元数据、一年 immutable 缓存、只读 CORS 和 Range 206 字节全部通过。本次两种 base 都是该桶默认 COS HTTPS 地址，只证明 COS 直读链路，没有宣称独立 CDN 或 `cos.advjs.yunle.fun` 验收。

`e2e:audio:cos` 读取发布回执后，为每个浏览器复制有限原生作者文件到独立目录，调用实际已构建 Node 包的普通 check／build，并使用原始 manifest SHA 固定公开音频。静态玩家宿主在本机运行，音频直接请求真实 COS，不使用代理、路由替换或测试波形。Chromium／WebKit 共 2 项通过，均从正常 Start 用户手势启动，无额外解锁点击；仅 Voice 发声，当前 line／take／asset 与原生母版一致，左侧条件分支、18px 正文及正常／390px 截图通过。RMS 分别为 0.20964845／0.00058452，属于本次瞬时输出证明，不是声音质量或响度承诺。

两个编码均通过匿名 HEAD 200 与页面 Origin 下的 CORS Range 206。两个浏览器本次实际播放短 Opus；WebKit 的短音频解码路径符合现有协议，两者可读 AAC 也已独立验证。构建包没有本地音频、参考、样本、未选历史或授权文档，运行时只有一条当前对白和一个采用 asset；selected take 保留运行时 stale 判断所需字段，供应商参数和授权数据已剥离。

测试接线的中间失败涉及 Playwright 路径别名把 Node 导入重定向至 TS 源、对白／旁白同时存在时的通用 locator，以及过度排除运行时 stale 字段的测试断言。最终用实际 dist 模块、独立 `paths: {}` Node 配置与精确 surface 选择修复，未降低 SHA、身份、RMS、字号或隐私门槛。重放重试均为只读，没有新 TTS 或成功对象写入。

### 协议加固、验证与记录

本轮补齐当前编译程序摘要复查，拒绝未进入当前剧情的孤儿配音发布和无法核验程序的旧审核记录；章节／Flow 变化即使不改变音频 revision，也不能复用旧发布审核。发布传输要求强引用 ETag，PUT 前再次核验变体，manifest 可读后再次核验原生源、母版与授权，再提交指针。这些检查仍由共用宿主完成，两端不产生第二套发布协议。

| 验证                             | 结果                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| 主仓库单测（排除 packed launch） | 240 文件／1543 项通过                                                                      |
| 根严格类型检查                   | 通过                                                                                       |
| 实际 `advjs` 构建与 COS 插件构建 | 通过；新增 trusted Docker context 后再次完成 Node 构建                                     |
| 部署入口及真实本地 CLI           | 15 项边界测试通过；prepare → ready → 401 → 第二实例拒绝 → SIGTERM 释放锁通过，零供应商请求 |
| CloudBase 身份边界               | 49 项通过；源码证实 Studio 使用同环境 SDK 会话，真实云作者会话未验收                       |
| 只读云审计                       | 26 项严格边界测试及本次真实 COS HTTPS 审计通过                                             |
| 两组可选云／COS fixture          | 22 项定向配置／原生 ZIP 单测、类型及 lint 通过；不配置时各 2 项明确跳过                    |
| 真实 COS 玩家                    | Chromium／WebKit 2／2，通过普通 JSON Flow 发布构建、Start 播放和实际云音频                 |

可复现命令见[音频服务指南](/guide/studio/audio-service#验证)与 [COS 指南](/guide/assets/cos#音频远端只读验收)。本机 pnpm 11 的运行前依赖检查曾阻止 Playwright 启动，实跑使用现有 `node_modules/.bin/playwright` 的同一配置。排查确认离线 `deploy --prod` 改写了根工作区校验缓存，实际依赖仍包含开发／生产／可选依赖。恢复开发安装模式后，pnpm 执行一次同步，锁文件已是最新、跳过解析，返回 Already up to date，没有清空依赖；校验缓存恢复正常，仓库 lockfile／workspace 文件的原时间保持不变。

随后 `pnpm --config.verify-deps-before-run=error exec playwright --version` 和同模式 COS 配置 `--list` 均通过，明确禁止自动安装的检查也不再报错，标准 `pnpm docs:check` 通过。恢复前后有限证据保存在 `pnpm-validation-state-repair.json`。可以使用指南中的普通 pnpm 入口，显式设置 `ADVJS_COS_REPLAY_PUBLICATION`；工作区依赖实际变化时仍按既有锁文件安装，不通过关闭校验掩盖缺失依赖。

机器证据在 `~/Library/Caches/ADV.JS/real-cloud-20261012/`：`publication.json`、`cos-public-audit.json`、`cos-immutability.json` 和 `replay/archive-index.json`；重放归档 9 项，含 2 份 proof、6 张真实截图与日志，逐字节／SHA-256 核验。worker 的批准 profile、实际命令、FFmpeg 包清单和镜像 tar 位于 `~/Library/Caches/ADV.JS/audio-worker-20261012/`。此前真实 Qwen 缓存与原生作者目录保持原样，所有临时服务与测试容器已关闭，既有 Colima VM 保留。

可选 CloudBase 部署入口与只读验收门禁已准备，但未部署服务、未创建云资源或填写虚构账号／项目。核查时 CFS 控制台尚未开通，现有 AI 服务无持久卷；已有 Studio 网站返回旧音频界面，未发布本轮前端。暂停前仅在本机构建了 Node／FFmpeg 基础镜像，离线服务 bundle 的 Linux native binding／patch 配置检查未通过，完整服务镜像未构建；该尝试保留记录，不能标为可部署镜像验收。作者最新选择本地 TTS 后已停止这些准备，不把未完成的云端旅程当作本阶段阻塞或成功结果。

## 2026-10-12 本地配对与 Qwen 参数续验

作者明确暂不使用 CFS。本轮继续现有 Qwen／OpenAI 插件与共享协议，补齐 Studio 的实际本地连接入口，再重新执行真实音色设计、对白选用、原生 JSON Flow 导出和 COS 发布。生成在本机完成，既有 COS 仅保存审核后的播放产物。

### 本地连接与参数修复

此前 Studio 真实 fixture 注入测试 CloudBase 会话，证明了共享服务的生成能力，但不能证明作者无需云登录即可连接。现在音频页提供显式本地配对，使用同一个 `ManagedVoiceClient`、Node 服务及 `/v1/audio/projects/:projectId` 路由，没有增加另一套任务、音色或发布协议。

可信 `createLocalVoiceServiceOptions()` 固定监听 `127.0.0.1`，限制精确 loopback Origin、登记项目及稳定 `local-device` 身份。32 字节随机凭据最多有效 24 小时，HTTP 请求和排队任务执行前均复查期限。Studio 验证返回的账号／项目后才激活连接；断开、刷新、账号／项目变化与 401 均撤销配对，旧请求不能提交迟到结果或复用旧审核。连接成功后清空凭据输入，浏览器会话仅留在内存。本轮临时凭据通过项目外 0600 文件一次性交接，测试读取后即删除，浏览器 trace 关闭，不归档凭据。

实际入口测试还发现文件系统 readiness 竞态：项目 watcher 尚未运行时，`whenReady()` 可能先等完旧 Promise 并返回空 FS。修复为先等待 Vue watcher 队列，再等待当前项目加载；延迟 FS 的回归先失败、修复后通过，音频、Flow 和导出共用这一处修复。

Qwen 新设计预设按当前 locale 派生语言，覆盖[官方十种语言](https://github.com/QwenLM/Qwen3-TTS#released-models-description-and-download)；无效或不支持的 locale 明确报 `VOICE_DESIGN_LOCALE_UNSUPPORTED`。保留原始描述，并以固定顺序附加年龄印象、性别表达、气质、说话风格、音高和语速意图。VoiceDesign 使用自然语言指令；Base 继续真实参考音频与文本条件化，不声称支持同样的描述控制。旧不可变版本只接受当前可信磁盘基线的相同预设字节／哈希，新版本仍按已登记模板派生，不能通过兼容路径更换模型、revision 或权重。

`setup` 现在核验运行库的实际固定版本，缺包或错版可显式修复，核验成功后才写 ready 标记；匹配环境不重新安装，`doctor` 仍只读。此次实际 doctor 为 ready，八次模型调用均强制离线复用此前已核验缓存，没有安装新运行库或下载新模型。语言映射和意图字段通过单测；真实生成仍只验收 `zh-CN`，未宣称十种语言全部经过听审。

### 两端新的真实模型旅程

Editor 正式命令完整通过，运行 `run-1791738958050`、1／1、约 1.9 分钟，未使用 resume。Studio 本地配对正式运行 `mv43c6hg`、2／2、约 2.5 分钟：Chromium 执行四次真实模型调用及 COS 发布，WebKit 只重放同一原生导出。Studio 没有注入 SDK、恢复测试云会话或要求登录；通过实际配对表单连接本机服务。首次 Studio fixture 在工作区初始化前退出，另一次首屏诊断也未执行供应商，均为零模型、零 COS 写入；正式复验新增四次，没有隐藏合成重试。

两端各执行 VoiceDesign 试听／对白、以本轮原创试听作为 Base ICL 参考的试听／新对白，共八次真实生成。新 take 保持未选用，审核替换后才切换；Flow 修改文案、布局、条件与跨章目标，保存／重载、稳定 line ID、撤销／重做及 `next: null` 均通过。两种声音各导出原生项目，由普通 check／build 生成播放器；未选样本、历史 take、参考、授权和供应商参数不进入玩家资源。

| 新调用           | Editor 时长／PCM RMS  | Studio 时长／PCM RMS  |
| ---------------- | --------------------- | --------------------- |
| VoiceDesign 试听 | 8.08 秒／0.053840     | 8.16 秒／0.125412     |
| VoiceDesign 对白 | 1.52 秒／0.063823     | 1.60 秒／0.117713     |
| Base ICL 试听    | 7.681625 秒／0.053182 | 7.761625 秒／0.119588 |
| Base ICL 对白    | 2.381708 秒／0.055726 | 2.284583 秒／0.102478 |

Editor Base 玩家 Chromium／WebKit 实际总线 RMS 为 0.000290／0.000719。Studio 的设计对白分别为 0.190300／0.229072，Base 对白分别为 0.000244／0.035699；普通 Start 手势即解锁，首句、条件分支、准确 line／take／asset 与停止配音均通过，页面错误为空。RMS 是此次采样证据，不用于比较声音质量或跨设备性能。

### Studio 面板实际发布新对白

从当前选用的 Studio Base take，经实际「审核音频发布」和「发布已审核音频」控件完成转码／发布。复用既有上海桶、限定前缀、受限子账号 STS、批准的 Colima FFmpeg image 和现有 COS 插件，不创建云资源、改变桶策略或增加授权。审核结果为 1 项音频、2 个播放文件。

| 身份             | 值                                                                             |
| ---------------- | ------------------------------------------------------------------------------ |
| 当前 line        | `line_01a12bfc-8fe5-7000-b42f-e87c5496c7ee`                                    |
| 当前 take        | `take_01a12bfe-4f1a-7001-8b94-e72c051d20b5`                                    |
| 原始母版 SHA-256 | `b05abb362f08b8866ff57820e9d72225ff4c8092d73846964e6f0c23cff184a3`             |
| Opus／WebM       | 28439 字节；`4611e81889e34d6f32abc2b688b5b50df5fa4a73cc2a75d5caed9bf62efebf37` |
| AAC／M4A         | 38512 字节；`eef325d45611ad23c8b54b7a2220a952d627004d32e0b260346e97c5a514b30b` |
| 公开 manifest    | 1308 字节；`c713b9855238e7ab5b6f64425aa9340adb1799bd0e7a606e37fe0bf1e980ae99`  |

成功 PUT 共 3 次，依次为两份变体和最后的 manifest；签发 1 次最长 30 分钟 STS，SDK PUT 未自动重发。工作请求计数为版本状态读取 7、GET 5、HEAD 8、PUT 3，不包含后续匿名浏览器重放。长期与临时 COS 凭据均仅在可信进程内存中，回执只保存对象键、字节、哈希和计数。公开 [本轮 manifest](https://yunlefun-assets-prod-1325586649.cos.ap-shanghai.myqcloud.com/games/advjs-audio-acceptance-20261012/v1/manifests/assets.c713b9855238e7ab5b6f64425aa9340adb1799bd0e7a606e37fe0bf1e980ae99.json) 由普通原生 JSON Flow 构建固定 revision 后播放。

以本轮独立 `published-native` 副本和真实回执再次普通构建，COS 重放 Chromium／WebKit 2／2 通过，新增模型和云写入均为零。两个完整变体 SHA／字节相符，HEAD 为 200、Range 为 206，实际媒体直接来自 COS HTTPS。普通 Start 后上下文 running，无额外解锁手势；RMS 分别为 0.000832／0.073622，采用身份与母版 SHA 相同，运行配置只有当前 1 行／1 项音频，私密资料和历史媒体未进入玩家资源。

### 回归门禁与持久证据

| 验证                             | 本轮结果                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 主仓库单测（排除 packed launch） | 244 文件／1579 项通过                                                                                  |
| Studio 全部单测                  | 68 文件／491 项通过                                                                                    |
| 正式 Studio App／Router 本地配对 | Chromium／WebKit 2／2；真实 quickstart、项目音频入口、错误凭据、能力读取、断开和刷新后重配对通过       |
| 实际 Qwen authoring              | Editor 1／1、Studio 2／2；新调用各 4 次，后续播放／审计零新增模型                                      |
| 本轮真实 COS JSON Flow 播放      | Chromium／WebKit 2／2；3 次成功对象 PUT、随后只读重放                                                  |
| 构建与类型                       | 完整 `build:advjs` 链、Qwen 插件、Studio 正式构建，根严格类型与真实 fixture 类型均通过                 |
| 参数、兼容与运行库修复           | Qwen／Node 7 文件／82 项专项通过；旧基线不可变、新版本可信派生、错误 locale 拒绝及运行库修复边界均覆盖 |

正式 App 配对测试复用既有测试供应商的能力检查，不调用它的模型，也不注入云 SDK／作者身份；与上面的八次真实 Qwen 旅程分别计数。浏览器实际扫描 localStorage、sessionStorage 和 IndexedDB，配对凭据不存在。正常与 390px 截图、路由证明和结果仅保存 scope／布尔字段。

最终定向源码／文档 ESLint、根严格类型、文档检查 46 文件、VitePress 正式构建与 `git diff --check` 均通过。文档 lint 首次仅报告表格对齐格式，按仓库 formatter 修正后通过，未改变历史验收内容。

机器证据统一位于 `~/Library/Caches/ADV.JS/local-qwen-cos-20261012/`。`evidence/eight-new-calls-proof.json` 独立读取八份原 manifest 和 WAV，核验固定两模型／revision、MLX Audio provenance、原字节 SHA、24 kHz 单声道 16-bit PCM 与实际时长；每端两次 Base 参考 SHA 均等于本轮 VoiceDesign 试听。Editor 的 `evidence/editor/archive-index.json` 和 Studio 的 `evidence/studio/archive-index.json` 保存原 proof、WAV／manifest、原生项目／ZIP、普通播放器和界面截图，逐文件核对 SHA；两个 Studio ZIP 保存原接收字节。`evidence/cos/` 保存本轮公开重放 proof 与截图。

最终 `evidence/all-evidence-index.json` 和 `evidence/completion/final-independent-proof.json` 合并全部有限证据，逐文件 SHA／字节复核通过。共归档 45 张实际截图：Editor 14、Studio 21、COS 6、正式产品配对 4；正常／窄屏截图已查看。COS 重放前后 66 份作者文件、两端新调用记录与八份原 WAV 不变，私有指针、公开回执和实际 manifest revision 相同。正式产品配对的零模型／测试发布端口证据单独归档，没有混入真实生成或真实 COS 计数。

发布 counters 的 `session.closedAt` 未写入，因为 Vite 的 HTTP close 回调没有等待异步 fixture 清理；不把这一字段当成优雅关闭证明，也没有补写旧记录。独立检查已确认本轮 3396／3397 端口关闭、无运行测试容器；临时配对文件已删除，COS 凭据仅在结束的进程内存中，云端 STS 按原 30 分钟期限过期。实际生产 Node CLI 仍使用其既有信号关闭流程。此前模型／环境和原作者历史保留，未部署云端 TTS 或开通 CFS。

## 2026-10-12 音质、听审包与设备分层续验

作者确认目前仅有这台 Mac，愿意接收匿名试听与评分包。本轮复用上节八份真实 Qwen 原始 WAV，以及已发布的两份真实 COS 变体；新增 TTS 调用和 COS 写入均为零。原始母版、参考样本、line／take／asset 身份和已发布 revision 保持不变，没有为评测覆盖旧合成或自动修剪母版。

### 原始音频与公开变体客观测量

有限本地脚本 `scripts/audit-audio-quality.mjs` 核验输入字节／SHA，使用此前批准的 Colima FFmpeg image 与固定 build fingerprint 分析。源文件仍为 24 kHz 单声道 16-bit PCM；48 kHz 解码副本仅用于测量，16 kHz 副本仅用于独立 ASR。测量不生成听感分数，也不把两端不同音色设计输入的响度差当成协议不一致。

| 样本                    | 综合响度 LUFS | 真峰值 dBTP | 起始静音秒 | 结尾静音秒 | 削波样本 |
| ----------------------- | ------------- | ----------- | ---------- | ---------- | -------- |
| Editor VoiceDesign 试听 | -24.40        | -3.92       | 0.03       | 0.12       | 0        |
| Editor VoiceDesign 对白 | -24.48        | -5.45       | 0.03       | 0.01       | 0        |
| Editor Base 试听        | -24.66        | -4.51       | 0.82       | 0          | 0        |
| Editor Base 对白        | -24.19        | -5.58       | 0.87       | 0          | 0        |
| Studio VoiceDesign 试听 | -18.06        | -4.82       | 0.03       | 0.08       | 0        |
| Studio VoiceDesign 对白 | -19.38        | -5.43       | 0.03       | 0          | 0        |
| Studio Base 试听        | -18.45        | -6.47       | 0.29       | 0          | 0        |
| Studio Base 对白        | -18.76        | -6.18       | 0          | 0          | 0        |
| COS Opus／WebM          | -16.02        | -3.44       | 0          | 0          | 0        |
| COS AAC／M4A            | -15.99        | -3.43       | 0          | 0.014      | 0        |

八份原始音频直流偏移绝对值均不超过 `4.1e-5`。Editor Base 的约 0.8 秒起始等待和较低原始响度需要真人听审重点判断，当前保留原始音频，未将其描述为已达到主观质量要求。

静音按 `-50 dBFS`、10 ms RMS 窗口测量，表中精度受窗口分辨率限制；微弱呼吸音不等同于数学上的零信号。

两份 COS 变体与使用同一审核处理步骤得到的无损参考对齐后，未发现参考能量丢失；不是直接拿处理前母版评判有意的裁切／响度处理。Opus 相关系数 `0.99912`、补偿增益后信噪比 `27.53 dB`；AAC 为 `0.99979`／`33.74 dB`。AAC 解码多出约 `19.42 ms` 编码填充，没有把此填充报告为尾句截断。两份真实公开对象的完整 SHA／字节仍与上节发布回执相符。

### 无提示本地 ASR

使用本机 `whisper.cpp 1.9.2` 和真实 Whisper small multilingual GGML 模型，固定维护者仓库 `ggerganov/whisper.cpp` revision `5359861c739e955e79d9a303bcbc70fb988958b1`；文件 `487601967` 字节、SHA-256 `1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b`。模型在项目外缓存下载并独立核验，没有使用已安装的 tiny 测试占位权重，没有修改 Qwen 环境。

十份真实音频以中文、零温度、无回退、无期望文本提示执行独立转录。比较只移除空白／标点并进行 Unicode NFKC，没有折叠繁简字以隐藏差异：四份长试听严格 CER 为 `0`；六份短对白为 `2/9 = 22.22%`，差异仅为 `们／們`、`发／發`。整体严格 CER 为 `6.06%`，插入／删除均为零；未观察到漏词、内容重复或尾句截断。原始转录、比较操作、命令与耗时逐文件归档。ASR 只能支持文本观察，不能证明自然度、情绪、音色身份或真人 MOS。

### 两端共享复审与匿名听审包

Editor 和 Studio 的 take 列表现在共用 `@advjs/audio` 的只读复审函数：从当前编译对白、精确 locale、角色／旁白 Profile 与发音词典重新派生朗读输入和指纹。对白删改、角色变化、词典或 Profile 变化均产生相同 stale 判断；资源缺失、SHA 不符和拒绝状态仍不可采用。复审保留历史与已选 take，不自动替换。显式朗读文本仍按现有优先级独立于词典。

Editor 补齐已登记音色设计样本的本地试听，显示原文和 SHA；读取经过字节校验的现有样本，不重新调用 TTS。两端作者界面的正常／窄面板截图和真实生产 UI 回归证明这一行为，原始八次模型生成记录另行保留。

`scripts/audio-listening-review.mjs` 将八份原始 WAV 按随机匿名 ID `S01–S08` 打包，字节／SHA 与原始证据一致。四组 A/B 均在同宿主、同角色、同文本内比较 VoiceDesign 与其真实 Base 参考条件化结果，不将两端不同设计意图混成同一音色目标。私有来源映射不进入便携 ZIP 或试听 HTTP 服务。

便携包 `listening-review/portable-listening.zip` 解压后直接打开 `index.html`，也可通过有限 loopback 服务试听。评分记录设备、输出方式、固定系统音量、语言、实际播放覆盖以及自然度、清晰度、文本准确性、风格符合度、首尾完整性、参考一致性六项。跳过片段不计入听完；导入评分草稿需重新播放与真人确认。导出 JSON 经 schema／语义校验，部分评分保持 pending，自动化证据与模拟数据排除真人结果。

当前包已准备并向作者展示；已收到并验核的真人听审记录为 `0` 份，初始 48 项评分均为 `null`，MOS 仍为 `null`。这不是已完成的主观验收，也不会将单次个人评分自动称为标准 MOS 研究。

### 执行前复核与预算边界

协议复核发现两个执行边界问题并补齐回归。Studio 入队回执先验证实际审核计划及哈希，再持久写入；错误哈希不能占用 plan ID，重复成功请求仍返回原 job。宿主等待全局供应商许可后，在真正调用前重新读取对白、Profile、词典、授权、参考媒体与当前访问资格，核验原审核指纹与取消信号，避免排队期间发生变化后仍调用模型。

只有可信宿主明确证明尚未调用供应商的失败，才原子释放字符／成本预算及 attempt；存储退款失败继续保持 `unknown` 与预算保留。供应商实际执行后的普通错误、同名字符串或伪装的内部错误实例均保持结果不确定，不能自动重试。真实调用开始后不会因退款标记穿透而重复执行。专项回归覆盖排队期间更换文本／词典／Profile、授权或参考变化、撤销访问及取消，均在供应商调用数为零时拒绝；另覆盖已执行供应商异常、退款原子存储失败及回执幂等。

### 设备分层与普通 JSON Flow 播放

本机桌面浏览器与触摸模拟共十四个用例，复用两端真实生成后导出的原生项目。每份项目复制到新的质量缓存目录，用当前源码执行普通构建；Studio 继续固定上节 COS manifest revision，Editor 使用原本地选用母版。原始 native／dist、八份模型输出与公开对象不改写，不注入替代播放协议。

| 环境                           | Editor                       | Studio                       | 证据分类                   |
| ------------------------------ | ---------------------------- | ---------------------------- | -------------------------- |
| Chromium 桌面                  | 通过                         | 通过                         | 本机真实浏览器             |
| Firefox 桌面                   | 通过                         | 通过                         | 本机真实浏览器             |
| WebKit 桌面                    | 通过                         | 通过                         | 本机真实浏览器引擎         |
| Chromium 手机                  | 通过                         | 通过                         | Pixel 7 视口／触摸模拟     |
| WebKit 手机                    | 通过                         | 通过                         | iPhone 13 视口／触摸模拟   |
| Chromium 平板                  | 通过                         | 通过                         | iPad Pro 11 视口／触摸模拟 |
| WebKit 平板                    | 通过                         | 通过                         | iPad Pro 11 视口／触摸模拟 |
| iPhone 16 Pro／iOS 18.6 Safari | 开始页布局通过；手势播放待验 | 开始页布局通过；手势播放待验 | 原生 OS 模拟器，非实机     |
| 手机／平板实机、第二台电脑     | 待验                         | 待验                         | 作者目前仅这台 Mac         |

最终浏览器矩阵 `14/14` 通过，约 1.8 分钟。Start 在首次点击前已完整位于可见视口，中心命中真实按钮，普通 click／tap 即解锁，未补发额外 unlock。实际上下文均为 48 kHz、总线 RMS 非零，line／take／asset／母版 SHA 与原导出一致，错误为空；验收门槛只要求设备实际采样率有限且大于零，不要求所有未来硬件固定 48 kHz。音量、静音、暂停／恢复、条件分支及结束释放均通过；三十四份布局观察的 `scrollWidth - clientWidth` 均为零，屏幕字号约 18 px。Studio 实际请求公开 COS 变体，作者参考／权利／预设与未选历史不进入玩家资源。

严格首屏检测发现固定比例标题页会裁切手机竖屏的 Start。现在标题页从项目配置复制独立 `viewportFit: responsive`，保留原项目配置及剧情舞台比例。移动 Chromium 另暴露主题全局滚动条规则影响宿主页宽度：根文档增加约 7 px。隔离验证后，将滚动条变量与三个伪元素规则全部限定到 `.adv-screen`；两端重新普通构建并在严格门槛下通过，没有放宽溢出断言。

原生 Safari 在 iOS 18.6 模拟器真实加载同一新构建，实际视口为 402 × 678。Editor／Studio Start 分别位于 y≈279.80／298.30，300 × 51 px，中心命中按钮且完整可见；修复前 Studio 按钮 y≈498.69，已越过 226.13 px 舞台的下缘，命中为舞台外 DIV。保留修复前后截图和只读几何数据；Editor 的旧数值采样尚在首屏初始化，因此只作为截图基线，不填补未记录的数值。

原生触摸镜像与原生窗口操作未观察到 Safari 页面／地址栏事件，音频上下文也未创建；没有用 `dispatchEvent` 或程序化 click 冒充原生手势，因此原生 iOS 首次解锁／对白播放仍待验。浏览器矩阵的页面可见性事件明确为合成测试；实际新标签切换时上下文仍 visible，不能证明真实 OS 后台暂停／来电恢复。Android OS、Capacitor 原生壳、蓝牙输出与实机性能均未在本轮验收。

### 本轮回归门禁

| 检查                           | 结果                                                          |
| ------------------------------ | ------------------------------------------------------------- |
| 根普通单测，排除 packed launch | 280 文件／1880 项通过；1 文件／2 项 Linux 专属测试按平台跳过  |
| Studio 全部单测                | 68 文件／491 项通过                                           |
| 执行边界专项                   | 4 文件／43 项通过，包含已执行 Provider 错误不能退款重试的回归 |
| 共享复审／听审包专项           | 6 文件／41 项通过                                             |
| 客观音质脚本专项               | 1 文件／5 项通过                                              |
| 最终作者生产 UI                | Editor 2 项、Studio 1 项通过；两端生产构建与十张新截图已归档  |
| 普通 JSON Flow 播放            | 14 项通过；三十四份布局观察无横向溢出                         |
| 听审页 UI                      | Chromium／WebKit 2 项通过；初始评分为空，不计真人听审         |

专项是完整单测中的子集，不与总数相加。根完整单测低并发通过，耗时 `295.39 s`；Studio 最终完整单测耗时 `54.79 s`。初次同时执行多项检查时发生的根测试超时和后续 Studio 失败日志保留，不将它们计为通过，也没有放宽超时门槛。

Studio 回归另补两个测试初始化问题：文件系统替身提供当前编译上下文需要的 `collectAllFiles` 与合法原生 Flow 文件；就绪测试把模块导入移出测试体，仍保留原 5 秒门槛、未完成文件系统与排队 watcher 的断言。实测冷导入约 `4536.24 ms`，真正就绪等待约 `2.34 ms`；两个修复均未改生产就绪逻辑。修改文件定向 lint、两端与根类型检查、有序核心／Audio／Node／COS 构建、文档链接门禁和文档生产构建均通过；最终结果与完整日志收入下述汇总索引。

### 本轮持久证据

本轮质量缓存为 `/Users/yunyou/Library/Caches/ADV.JS/audio-quality-devices-20261012`：`objective/objective-quality.json` 与 `asr/asr-baseline.json` 保存测量和转录；`listening-review/` 保存匿名网页、原字节样本、便携 ZIP、有限服务及两个浏览器的评分为空证明。原始八份 WAV、生成回执、66 份原生输入、既有发布变体和原始归档索引均单独复核 SHA，结果见 `completion/source-immutability.json`，没有覆盖源记录。

初次质量索引共 194 项，其中 36 项位于被严格复验重新生成的初次矩阵目录，因此不宣称该旧索引整体可复现；其余 158 项稳定证据全部匹配。最终矩阵使用独立时间戳目录 `browser-matrix-final-1791746141541`，十四份播放证明与三十四张 PNG 的 48 项新索引全部匹配；汇总见 `completion/browser-matrix-proof.json`。浏览器安装包版本元数据另存，没有将其当成未记录的逐次 `browser.version`。

最终作者生产复验保存于 `author-review-final-1791747010909/proof.json`，含两端构建／E2E 完整日志、十张正常／窄界面 PNG 和最终产物 SHA。`os-simulator/os-simulator-proof.json` 与原生截图仅证明实际记录的 iOS 开始页布局；保留没有收到原生手势事件的观察。汇总索引使用新的 `completion/all-evidence-index-*.json`，复核稳定音质证据、最终矩阵、听审包、作者复验、原生布局和最终回归日志，不覆盖旧索引。

## 2026-10-12 工作区日常试听与按需高级听审

本节记录后续集成验收，沿用原始八次 Qwen 生成记录与已发布 COS 对象。日常试听、A/B、显式采用和过期复审进入 Editor／Studio 音频工作区；匿名六维评分按需打开。两端不自动启动独立试听服务、TTS 生成或 COS 发布。

### 共享规则与私有恢复

`@advjs/audio` 统一同文比较资格、采用前复审门槛、匿名顺序、六维评分、环境、播放覆盖和私有 JSON。A/B 必须匹配稳定对白、locale、说话人与 take 的实际朗读文本；不可用资源始终拒绝。更换已选配音需要明确操作与原有 revision/CAS，过期 take 另需重新确认差异。明确保留过期绑定只验证原资源并记录本次界面确认，不改历史指纹，也不抹掉客观 stale 状态。

两端高级听审共用同一播放观察器：实际 DOM 媒体事件、原字节 SHA、实际 duration、正常速度连续区间和结束事件均受核验。切换候选、关闭／隐藏、项目或账号切换、媒体替换及延迟读取不会恢复旧音频。跳转不增加连续覆盖；合成事件或替身属于 simulation，不能提供真人完成证明。

工作区可选当前同文组或全项目的 2–32 份候选。匿名视图隐去 provider／take／asset／SHA 来源，按 G 编号区分同文组；没有可信匿名 conditioning 参考时，参考一致性填 NA，不把 A/B 另一份 take 当作生成参考。风格说明来自当前角色配置，历史目标不同的候选保留复审提示。

私有 JSON 绑定原生 `project.id` 与 line／take／asset／SHA／实际文本，因此同一项目可在两端恢复评分和备注。导入及当前词典／Profile 变化后清空旧播放覆盖与本人确认，当前 unavailable／stale 状态重新取值。自动保存属于各宿主的本机私有草稿，不写入语音账本或玩家产物；仍可显式导出 JSON。完整匿名研究、真人自然度判定和实机验证不由自动化代填，标准 MOS 保持 `null`。

### 界面组织与设计参考

参考 [ADV.JS 设计系统](../about/design/design-system) 与 [YunLeFun/design 的工作台原则](https://github.com/YunLeFun/design/blob/main/packages/guide/editor.md)，采用「当前台词／状态 → 同文 A/B → 单播放器 → 显式采用 → 折叠来源」的操作顺序。Editor 使用既有 AGUI 属性行、紧凑控件和中性 token；Studio 使用既有 S 组件与适合触摸的操作尺寸。完整评分模块首次打开才加载，不将日常审核变为长评分表。没有增加 YunLeFun UI 依赖，也没有改写参考仓库中的未提交工作。

### 本轮证据与门禁

本轮证据单独保存在 `/Users/yunyou/Library/Caches/ADV.JS/audio-listening-integration-20261012/run-1791790377585`，不覆盖前一节归档。八份真实 Qwen WAV 以原字节导入临时规范 JSON Flow 项目，四个实际 narration 节点在启动时通过编译核验稳定 lineId 与文本，再绑定八个测试 take。测试绑定明确标注 `archived-audio-import-fixture`，其 Profile／输入指纹只是测试身份，不冒充原始生成记录；真实模型、revision、generationMode、engine 与原 manifest SHA 单独保留在来源证明中。本轮没有重新调用 Qwen 或写入 COS。

Editor 的最终 Chromium／WebKit 旅程覆盖日常 A/B、明确替换、当前源码变化后的过期复审、只读保留、按需挂载、八份／四组匿名评分、真实短对白播放、私有导出和 Studio JSON 恢复。原 workspace／voice-design 三项生产 UI 回归也通过；其中合成调用使用明确的 fake provider，不计为真实 Qwen 调用。正常／320 面板、浅色／深色、键盘入口与环境／匿名／评分／导出多个滚动位置截图归档，使用实际工作区视窗，避免把高于滚动容器的长 section 拼为灰白区域。

完整回归首先得到根 `285` 文件／`1923` 项通过，另 `1` 文件／`2` 项 Linux 测试按平台跳过；Studio `69` 文件／`500` 项通过。随后中文导入边界与媒体首尾时序修复以相关五文件 `51` 项重新验证，Editor 宿主专项共 `20` 项、Studio 宿主专项 `17` 项通过。专项包含完整回归中的用例，不相加作为总数。最终有序 Audio／Node／两端生产构建、类型和定向 lint 通过，文档 `47` 文件链接检查与生产构建通过。

Studio 的 Chromium 桌面与 WebKit iPhone 13 触摸模拟完整旅程均通过：八份原 WAV 分别实际播放到结束，所有样本的共享覆盖为 `100%`，没有模拟播放声明。明确保留过期 take 重新验证原字节；只修改临时 QA 复制媒体的一个字节后，复审被拒绝，恢复原字节才继续。两端实际 UI 的私有 JSON 导入／重新导出保持全部身份、评分和备注，播放／结束计数／人工确认清零；Studio 当前临时原生账本在评分与导入前后均为 `8774` 字节，SHA 一致。Chromium 的纯触摸专用项按配置跳过，WebKit 的实际 tap、日常试听、高级按需挂载与隐藏停止均通过，不将这一跳过算作缺失的完整旅程。

WebKit 最初在 `4190` 无请求且导航超时，隔离到同一产物的 `4191` 后立即加载，仅测试改用该端口。临时 IndexedDB 种子也改为真实 MemoryFsAdapter 的 `binary: ArrayBuffer`／mimeType 持久协议；没有用 WebKit 不支持的测试直接 Blob 克隆改变生产存储。最初不规范的裸 Markdown 只产生 text 节点，因此改用上述真实 JSON Flow，并强制编译节点核验。初次超时、种子失败及中间覆盖不足日志保留，不计为最终通过。

独立截图复核还发现，390 视口的 A/B 长状态文字会画到相邻试听按钮上，即使外层 scrollWidth 未增加。仅在该比较行限定值区域收缩和省略，保留完整可访问文字及展开选项；没有改变全局 SSelect 或比较协议。最终绘制边界、弹出选项、试听和触摸操作用窄面板实测复核。

最终作者浏览器门禁为 Editor 集成 `2/2` 加既有工作区／音色设计 `3/3`，Studio 完整／触摸 `3` 项通过加一个配置预期跳过、最终绘制 `2/2`、既有管理 `1/1`。Editor 的 `editor/terminal-final-sCJsyd/editor-final-evidence-index.json` 收入 `34` 份最终截图、JSON、原生事件与日志，并关联前一轮三项回归；Studio 的 `studio/final-1791795711488/archive-index.json` 复核 `87` 份文件。Studio `59` 张 PNG 中，最后 `16` 张位于 `paint-visible-1791796703915`，用于最终长标签裁切与完整弹出选项，早期绘制交叠截图保留为修复前观察。根汇总 `completion/acceptance.json`、`completion/artifact-index.json` 记录最终门禁、来源、操作数、限定范围与持久文件 SHA；所有临时验收服务已经停止。

真实短对白复验发现 `playing` 回调延迟和终端 `timeupdate` 已显示 `paused=true` 会漏计首尾。现在仅在匹配的实际 `play → playing` 相位、正常速度、未 seek、相同已验 SHA 的媒体与墙时一致时记录起始连续片段；暂停／等待在记录最后连续片段后解除相位。原生最后 `timeupdate → pause → ended` 保留末段与唯一结束计数。两端使用同一观察器，未放松 `95%` 门槛，也没有把跳转或模拟事件当成真人播放。固定原始 `1.52 s` WAV 的最终 Editor 两浏览器覆盖均为 `100%`、结束计数为 `1`，实际原生事件遥测另存；早期 `94.76%` 以及首尾修复中间失败保持原值、原目录，不改写为通过。

两份真实生成后的原生项目重新复制到本轮目录，使用普通构建导出 JSON Flow 播放；Studio 继续核验相同公开 COS manifest revision。桌面 Chromium／Firefox／WebKit 与手机／平板触摸模拟共 `14/14` 通过，`34` 份布局观察均无横向溢出，实际总线 RMS 为正，选择身份、静音、暂停／恢复、分支与结束清理保持一致。没有把这些浏览器或视口模拟称为第二台电脑／手机实机验收。

`completion/source-immutability.json` 复核前阶段汇总索引 `326` 份文件全部匹配，以及八份原 WAV／八份原 provider manifest 的完整 SHA／字节。本次模型调用和 COS 写入均为 `0`。旧独立 `8769` 听审页在确认所有评分仍 pending 后停止本轮持有的进程，端口已关闭，`completion/standalone-service.json` 保存检查；原便携 ZIP 保留，工作区没有自动启动服务。已收到的真人听审仍为 `0`，所有自动化评分与声明明确排除真人结果，标准 MOS 为 `null`。

## 2026-10-12 Issue #18 角色对白流程收尾

本轮从已提交的 `9ebdef26` 开始核对 [Issue #18](https://github.com/YunYouJun/advjs/issues/18)与[已合并的 #51](https://github.com/YunYouJun/advjs/pull/51)。#51 提供人物短句审核基础，后续设计、原生 Profile、对白任务和播放器继续沿用既有 Qwen／OpenAI 插件与共享协议；本轮关注同一项目中的入口衔接和完整流程验证，不重新下载模型、调用真实 TTS 或写入 COS。

### 样本审核与实际应用

旧 `selectedSample` 仅表示人物短句已审核，不推断语言、模型和设计，也不自动应用到角色。新版审核样本、角色 `voiceProfile` 和对白 `selectedTake` 保持独立确认。历史样本与 take 保留，不修改指纹或静默替换选择。当前角色上下文应进入已有音色设计、指定台词生成和对白审核流程，跨项目／账号导航及未保存草稿继续受宿主约束。

### 两端入口与本地预览修复

Editor 人物页新增紧凑的「音色设计与应用」「生成角色对白」「试听与选用」入口，显示原生角色实际保存的音色版本。音频工作区消费一次导航请求并保留可清除的角色范围；设计、任务与审核仍使用原有服务。切换项目清理范围，角色切换不覆盖未保存设计。单句旁白生成也使用并冻结原生 Narrator Profile，拒绝生成期间变更后的迟到登记。同字节原生快照刷新不再因文件对象身份变化清除已审核计划；实际字节、草稿或角色范围变化仍使审核失效，执行时继续由宿主核对 CAS 与输入指纹。

Studio 的角色卡和保存角色后的设计入口携带角色上下文；应用音色后继续该角色的任务，完成后进入对应台词的试听审核，再进入现有游玩页。新增角色／单句筛选，混合角色章节不会把其他未配置音色的角色加入当前任务。未保存设计或执行中切换角色会保留原输入，保存成功或显式放弃后才继续。Local／Hosted 审核各有独立序号，改变角色、台词或范围后丢弃旧计划的迟到返回，不能将它重新显示或入队。

完整 Editor 页面旅程发现本地 bridge 预览只解析人物／场景，遗漏音频及变体。普通导出与浏览器目录预览已有正确投影，但本地 Editor 已选对白保留相对路径，播放器实际请求 Editor 页面路径，导致加载失败。现在本地适配器也复用共享 `resolveRuntimeAudioAsset` 和同一 Asset Catalog，通过有限认证资源接口取得当前运行时音频的 Blob URL；主音频与变体遵循既有 preview generation、撤销和迟到读取守卫，不另建播放器或暴露项目凭据。

### 单项目完整流程验证

共享 Node 设计宿主的既有旅程已扩展到普通游戏构建与实际 Runtime／Client 消费：保存设计、确认试听、登记样本、审核选用、显式应用角色，再用该预设生成对白。生成完成时 `selectedTake` 仍为 `null`，音色样本和未选对白均不进入播放器资源；显式绑定后，普通构建只包含所选对白资产与合成替身实际输出的 WAV 字节，line／take／asset／SHA 保持一致，作者 Profile 和样本选择不进入玩家。

运行时产生实际 `dialogue.voice` 效果，Client AudioEngine 在离线 Fake Backend 上播放准确的 voice 资产；推进到未配音旁白停止上一句，切换到没有 take 的精确语言保持静音。本项是本轮自动化连接验收，不是新 Qwen 生成或真人音质评分。该测试文件 `12/12` 通过。

Editor 最终 `6` 文件／`44` 项专项通过，Studio `5` 文件／`22` 项专项通过；包括旁白输入冻结、同字节快照保留审核、真实内容变化失效、草稿保护和 Local／Hosted 迟到计划拒绝。根与两端类型、定向 lint、两端最终生产构建通过。Editor／Studio 的同项目完整页面旅程分别在 Chromium／WebKit `2/2` 通过，Editor 既有音色设计两项 Chromium 回归也通过。

每条页面旅程通过实际服务登记两个合成替身输出，生成后的对白保持未选，只有明确采用后才进入玩家。Editor 最终游戏输出 RMS 为 `0.18677`／`0.20278`，Studio 为 `0.18537`／`0.20278`；当前 line／take／asset 与原生账本一致，voice 轨实际 playing、AudioContext running，音频错误为空。Editor 使用正常预览按钮手势解锁，不添加额外游戏点击来掩盖加载问题。Editor 审核页包括正常／320 面板，Studio 包括正常／390 视口；这些浏览器视口不算真实第二台设备。

初次临时 Flow 缺 title／entry 不一致、把兼容样本字段误当作必须为空，以及生产 DOM 调试指针和临时试听 context 干扰测量的试验均保留原目录。测试改为核验实际原生完成状态、正确的生产 app context 和各音频 context 的输出；没有移除编译校验、改写旧结果或放宽 SHA／实际播放门槛。真实本地预览漏音频和同字节刷新丢审核则分别以回归复现并修复源码，再验证新构建。

本轮证据目录为 `/Users/yunyou/Library/Caches/ADV.JS/voice-workflow-closeout-20261012/run-1791805202067`。本轮真实模型调用、COS 写入与收到的真人评分均为 `0`；前阶段的真实模型、发布和跨浏览器证据保持其原验收范围。背景音乐生成已拆为[独立待实施任务](../plans/2026-10-12-ai-background-music-generation)，不把已有 BGM 管理或播放当作生成完成，不关闭包含这项需求的完整系统验收。

## 2026-10-12 音乐创作与文件回流

本轮按作者要求推进[独立音乐计划](../plans/2026-10-12-ai-background-music-generation)：音乐由用户自创、委托创作或借助 AI 完成，ADV.JS 打通方案交接、导入、试听采用、章节／Flow 绑定和普通游戏播放。Suno 使用官方创作入口、共享方案文本／JSON 与官方渠道下载后的文件导入；本轮没有执行 Suno 音乐生成，也没有接入未经核验的第三方同名生成 API。主题曲、OP、ED 和插曲按作者用途保存，仍使用 `bgm`／music 总线，不新增 TTS、播放器、CFS 或常驻独立音乐服务。

### 共享资料、审核与导出边界

`AdvAssetEntry.music` 由 `@advjs/types` 定义，`@advjs/assets` 提供唯一有限解析器，`@advjs/audio` 提供文本交接、默认播放参数、审核资格和原生资源事务。音乐资料保存在唯一 Catalog，来源页面只供作者查阅，不是播放地址。新导入记录 pending；显式采用核验许可、当前母版 SHA、实际字节与 CAS，提交时宿主再次验证。标题、替代文本和标签保留采用；用途、方案、来源或许可变化要求复审。

编译和共享章节编辑同样检查新版音乐资格，手写 Markdown／Flow 不能绕过界面引用 pending、rejected 或 SHA 已变的音乐。原生资料仍可修改和重新采用，未引用候选不阻断有效剧情。普通构建及发布准备按当前 Program 的 canonical BGM 引用筛选新版音乐，玩家 transport 用显式白名单排除创作方案、来源、权益说明和审核资料；旧 BGM 库保持兼容。

验收修复了配置加载阶段提前读取全部音乐母版的问题：现在原生项目先取得共享玩家投影，再解析实际资源。未绑定音乐候选即使母版缺失，也不会阻断普通构建。采用音乐仍要求实际 SHA／字节相符，缺失或损坏不能绕过。

### 本地协议、构建与发布准备验证

- 共享音乐、资源生命周期与 Catalog 专项 `3` 文件／`34` 项通过，涵盖分片保存、许可一致、不能通过编辑伪造采用、实际字节变更与提交 CAS、来源页面隔离、legacy 兼容。
- 原生音乐与既有投影、普通构建隐私、工作区构建顺序回归 `5` 文件／`33` 项通过。五种音乐用途分别通过 Markdown／Flow 的 Runtime 与 Client AudioEngine 消费，核对准确资产、music 总线、循环参数、500ms 淡入、1000ms 清除淡出和暂停／恢复。另验证两种格式均拒绝 pending、rejected 与过期 SHA 的手写引用。
- 新 Node 发布回归 `2/2` 通过，使用真实 FFmpeg 与本地 COS SDK HTTP 测试端。默认只准备实际引用的新音乐并保留 legacy BGM；未引用 pending／approved 音乐故意缺母版仍成功，显式请求其发布会拒绝。公开 manifest 与固定 revision 的普通构建准备不含创作方案、来源、权益说明或私有路径；审核后删除剧情绑定，发布在 PUT 之前拒绝。
- 两端实际原生作者 adapter 的恢复回归 `2/2` 通过，分别修改已绑定音乐的用途、来源和许可。pending 阻断 playable Program，但素材库仍可读取并在实际 SHA／CAS 校验后重新采用；编译随之恢复，剧情和母版字节保持不变，没有放宽门禁或调用 Provider。
- 根最终类型检查、定向 lint、有序核心／Node 构建及文档检查／构建通过。页面验收结果在本节续记，不以这些协议回归代替两端实际操作或真人音乐听审。

### 两端生产界面与试听生命周期

Editor 使用 AGUI 的折叠音乐方案、素材属性、试听采用和已有 Flow 属性；方案 JSON／文本可交给用户选择的创作工具。导入捕获原项目与 Profile，在首次写入前检查作用域；同 asset ID 的项目副本不继承旧草稿，未导入方案复用项目私有草稿恢复。已有 SHA 核验的媒体按实际身份保留，同字节刷新或纯标题／标签编辑不会中断试听；母版、音乐资料、许可、项目和可见性变化仍清理 URL。现有 HTMLAudioElement 提供明确播放按钮，必须收到当前媒体可信 `playing` 才能确认采用。

Editor 最终 `4` 文件／`41` 项专项、类型、定向 lint 和生产构建通过，正式 Chromium／WebKit 完整旅程 `2/2` 通过。每条实际导入两份原创 WAV，只有显式批准并绑定的一份进入普通游戏构建；母版 SHA 为 `1f6dcbd1f87eaef87505487cfb002892a45b287f20b91e254ca07edefb193659`，大小 `48044` 字节。正常 Start 直接播放准确 music 资产，无额外解锁点击，RMS 为 `0.13594`／`0.12284`，音频错误和编译诊断为空。实际 JS／JSON 排除创作方案、来源页面、署名／许可记录和未绑定候选 ID；正常／320 面板、Flow 与玩家截图均已检查。最终索引验证 `39` 个文件，含 `8` 张截图；对应 `13` 份源码 SHA 已冻结，所有临时 bridge／player 服务已关闭。

Studio 使用既有 S 组件，保留按需方案、来源许可、原生文件导入和同一实际试听门槛。素材库只按账号／项目作用域重建，外部 revision 刷新保留未保存草稿；保存使用草稿打开时的 revision，成功回执才关闭表单。导入／更新在媒体探测、排队和提交边界检查账号、项目、文件系统与活动 epoch，离开后再返回也不会恢复旧写入。绑定先进入章节，再明确加入入口草稿并保存；Markdown 快捷操作复用共享 AST／补丁和原生 CAS。背景音乐默认循环，主题曲／OP／ED／插曲默认一次，导入和绑定均保留作者明确的 loop 选择。

Studio 最终 `4` 文件／`21` 项专项、应用类型、fixture 严格类型、定向 lint 和生产构建通过，正式 Chromium／WebKit 完整旅程 `2/2` 通过。WebKit 使用 iPhone 13 触摸模拟，以实际 tap 操作播放试听和正常 Start，不是手机实机。每条导入两份原创 PCM，经当前媒体可信 `playing` 后才允许勾选采用；原生 ZIP 实际导出后用已构建 CLI 普通 check／build，只产生已绑定的一份 `144044` 字节母版，SHA 为 `5027124ef10fa26f9490f154abb8c030a68b45b9f93d965d193b698ec312bf83`。准确 line／asset、loop、music 总线、AudioContext running 和作者资料／未绑定 ID 排除通过，RMS 为 `0.02620`／`0.14871`。最终索引验证 `31` 个文件，含 `16` 张正常／390 视口截图和两份原始 ZIP，`25` 份源码 SHA 与最终构建一致；`4196` 及全部临时播放器服务已关闭。

前期试验保留原目录，包括原生 controls 坐标定位、`play` 早于 `playing` 的确认竞态和 fixture 内联／分片路径断言。产品补上同一 HTMLAudioElement 的明确播放按钮，并在真实开始试听之前禁用确认；没有通过强制解锁、伪造 playing、去掉 SHA 或放宽采用门槛获得通过。既有角色音色 → 对白生成 → 采用 → 普通玩家的 Node 回归 `12/12` 再次通过，音乐流程没有改用 TTS 来生成歌曲。

最终证据分别位于 `editor/completion/`、`editor/ui-G5JJXA/` 与 `studio/approved-gate-final-1791816600/`；根 `completion/` 保存最终构建、文档、来源不变与归档复核。两端生产源码已冻结，合计 `4/4` 页面旅程与 `24` 张布局截图通过；触摸模拟、瞬时 RMS 和原创测试波形均不等于音乐质量或第二台实际设备。

本轮证据目录为 `/Users/yunyou/Library/Caches/ADV.JS/music-workflow-20261012/run-1791810782623`。原创本地波形仅作媒体和加载测试，不冒充 Suno 输出。实际音乐生成、真实 COS 写入与真人音乐评分均为 `0`；此前真实 Qwen、COS 和听审归档保持原验收范围，前一轮 `108` 份归档逐字节／SHA 复核仍相同。自动生成供应商适配器、音乐听感与真实第二台设备仍是独立的后续验收。

## 2026-10-12 Issue #18 提交前复核

关闭依据是作者确认的首期范围：角色音色 → 对白生成 → 试听采用 → 普通游戏播放，以及用户自创／借助外部 AI 创作的音乐方案 → 文件回流 → 采用 → 章节／Flow 绑定 → 导出播放。自动音乐生成单独跟进 [Issue #64](https://github.com/YunYouJun/advjs/issues/64)，Suno 当前只提供官方创作入口、方案交接和文件导入。此收尾不代表音频主计划十二项任务全部完成，也不宣称真人音质评分或第二台设备已验收。

同步到远端 `251c104e` 后，本轮两轴审查和整合回归纳入全部已有音频改动；五个上游 npm 提交保留。前轮音乐归档 `216` 份与对白归档 `108` 份均保持原 SHA，本轮新证据另存，不改写旧结果。

### Standards

审查发现一项低严重度 Studio 视觉契约偏差：音乐原生 textarea／checkbox 缺少组件规范要求的品牌焦点环。三个局部组件已补 `3px` 品牌色轮廓和 `2px` 外偏移，未改动脚本、模板或数据协议。生产 Chromium 用实际 Tab／Shift+Tab 验证五个控件，在正常与 390 视口保存十张焦点截图和十份 computed-style 观察；均为真实 focus-visible、品牌 token 和无横向溢出，未强制伪造焦点。

仍有两项不阻断交付的判断性维护建议：Studio Flow／Markdown 的 BGM 操作构造可提取同文件 helper；导入、更新与复审的作用域捕获可集中封装。现有共享协议、Catalog／CAS、作者资料投影边界和两端守卫均有实际回归，不将这些建议视为规范违反。最终未解决的硬规范问题为 `0`。

### Spec

审查发现并修复一项采用绕过：未绑定的新版音乐原可经 `bgm → sfx → bgm` 重分类删除资料，变成不需音乐审核的 legacy BGM。共享资源事务现在拒绝已有音乐资料的跨类重分类和资料删除，保留 pending／rejected／approved 状态与原字节；真正 legacy 资源继续兼容。专项 `17/17` 通过，覆盖三种状态、五种跨类尝试、带／不带显式删除、正常资料变更后的真实 SHA 复审和 legacy 往返。最终未解决的范围阻断项为 `0`。

角色对白与音乐首期要求均对应现有共享规格、用户指南及两端原生导出／播放证据。实际自动音乐生成、真人自然度／一致性评分、物理第二台设备、云端 TTS 和完整十二项系统验收仍按其各自范围推进。

### 最终整合验证

根使用与 CI 相同的 `pnpm vitest run tests/unit --reporter=default`，`242` 文件／`1737` 项通过，另 `1` 文件／`2` 项按平台跳过。根全量 lint、类型检查、有序 `build:advjs` 和两端生产构建通过；Studio 本轮聚焦构建明确关闭 legacy 插件，不将现代构建宣称为旧浏览器验收。新增的 assets → audio 依赖已同时落实到发布图和构建图，发布／工作区顺序专项 `17/17` 通过。

初次未限定目录的测试误包含独立 packed launch 套件，暴露发布顺序问题；该问题已修复并用真实发布图校验恢复。另一个资源面板隔离测试补齐与既有全局 fixture 相同的显式 ProjectStore 模块边界，面板／导航 `14/14` 通过；未改全局 TextEncoder 或生产浏览器别名。macOS watcher 当前源码、HEAD 原文与纯 fs.watch 对照在完全不写外部文件时也收到准备事件，测试现于准备期排空后再执行外部写入，保留严格空事件断言、内部编辑和关闭后的静默检查；生产 watcher 未改。初次失败日志原样保存，最终普通单测不包含另行运行的安装包 launch 套件。

重新构建后的 Editor 音乐 Chromium／WebKit `2/2` 通过（`22.4 s`），准确母版、canonical BGM、普通构建隐私和正常 Start 播放仍通过，RMS 为 `0.06690`／`0.13617`。Studio 音乐完整旅程 `2/2` 通过（`34.1 s`），焦点截图调整另在同生产源码通过一次 Chromium 旅程；该额外执行不计为新增覆盖。WebKit 仍是本机 iPhone 触摸模拟。两端都继续排除未绑定候选和作者资料，临时服务全部关闭。

本轮收尾证据目录为 `/Users/yunyou/Library/Caches/ADV.JS/issue18-closeout-20261012`；原媒体与前阶段实际 Qwen／COS 结果继续按其原证据引用。本轮新增真实模型调用、COS 写入、真人评分和物理设备验收均为 `0`。Git 提交按对白流程、音乐流程、测试隔离与本节报告分别记录；Issue 关闭评论引用实际推送的提交和 #64。

## 2026-10-13 远端 CI 收尾

### 失败定位与修复

原提交 `b1294792` 的 [ADV.JS CI](https://github.com/YunYouJun/advjs/actions/runs/38273850114) 失败于 macOS／Windows 同一条 packed-install 断言：测试仍要求 `types → audio → assets`，实际发布图已按新增的 Audio → Assets 依赖调整为 `types → assets → audio`。两平台该文件原有其余五项通过，但后续独立脚手架步骤被阻断；不能将初始运行记作完整安装包链路通过。原 Docs、Demo、Desktop 的成功和本地验收保持其原范围。

修复提交 [dfad41a0](https://github.com/YunYouJun/advjs/commit/dfad41a0b7567d4f9900a0cdd64559d02b7941ff) 仅修改测试：严格核对全部十四个公共包的成员和重复，实际拓扑继续由真实 package.json 的依赖、版本、访问及入口校验决定。新增临时原生 manifest 的反向依赖回归，确认 Assets 依赖后发布的 Audio 会被拒绝。没有修改生产协议、工作流、超时预算或跳过规则。

原 packed 定向用例真实失败，修后两项通过；相关发布图单测 `12/12` 和定向 lint 通过。本机完整 packed-install `7/7` 通过、零跳过，耗时 `98.16 s`，包含实际 npx、pnpm dlx、create、已安装 Editor 与 MCP 的启动和清理。`ADVJS_PACKED_INSTALL_SKIP_BUILD=1` 与 CI 后续阶段一致，只复用已构建产物，不跳过测试；新产物构建由下列远端全新运行验证。

### 修复版本的远端完整验收

以下四个工作流均在修复版本 `dfad41a0b7567d4f9900a0cdd64559d02b7941ff` 的第一次运行完成，结论为 success；主 CI 的十六个 job（包括 launch-required）全部成功。

| 工作流      | 运行                                                                       | 结果                             |
| ----------- | -------------------------------------------------------------------------- | -------------------------------- |
| ADV.JS CI   | [38276901241](https://github.com/YunYouJun/advjs/actions/runs/38276901241) | 全部十六项成功                   |
| ADV.JS Docs | [38276901215](https://github.com/YunYouJun/advjs/actions/runs/38276901215) | 文档生产构建成功                 |
| ADV.JS Demo | [38276901284](https://github.com/YunYouJun/advjs/actions/runs/38276901284) | 游戏构建与 Parser 浏览器冒烟成功 |
| Desktop CI  | [38276901574](https://github.com/YunYouJun/advjs/actions/runs/38276901574) | 桌面宿主测试、类型与构建成功     |

主 CI 根单测 `243` 文件／`1739` 项通过；通用 Chromium E2E `52` 项通过、`3` 项按配置跳过；Editor E2E `11` 项、完整启动旅程 `3` 文件／`10` 项、Agent 安装 `2` 项通过。Windows 和 macOS 各自完成新安装包构建、完整安装／Editor 生命周期及脚手架生成项目构建／运行；不把两平台的重复用例相加为新的独立覆盖。两端 Editor 冒烟、Editor／Studio／VRM 页面构建、类型与 lint 均通过。

Demo Parser Chromium `2` 项通过。Desktop 本次只有宿主检查：脚本测试 `17` 项通过、`1` 项跳过，宿主类型与构建通过；因为修补未影响桌面打包范围，Linux package 和 full-matrix 按既有条件跳过。本次没有新增 ZIP 或全平台桌面安装包证据，先前打包产物保持其原运行归属。

证据目录为 `/Users/yunyou/Library/Caches/ADV.JS/ci-audio-closeout-20261013`，保存原失败日志、真实红绿与本机完整安装日志、四工作流的精确 SHA／attempt／job 结论，以及成功日志中的测试计数和行号。原阶段音频、截图、模型和 COS 证据不改写。此次远端 CI 是构建、安装和自动化旅程验证，不增加真人音质评分、作者第二台物理设备、真实音乐生成或云端 TTS／COS 发布的验收声明；剩余范围仍按下节记录。

## 明确限制与剩余完整系统验收

- 音频作者服务当前固定 `adv` 内容根。自定义根显示明确错误并禁止写入；保留已有资产 profile root，不另建或猜测项目数据。
- Editor Mixer 为可保留冲突草稿的 JSON 编辑器，Studio 提供六总线控制。两端版本化音色设计与 JSON Flow 可视化编辑已接入共享协议；当前续建验收结果见上方记录。
- 本地共享 Node 服务和 Studio 原生同步已实现并真实验收。可选云部署需另行完成真实会话、项目注册、持久主机和可信预设；作者当前选择暂缓。Qwen／OpenAI 缺少供应商结果查询能力时未知请求不能自动重试，未宣称供应商侧已保证远程去重收费。
- MiniMax／豆包等更多供应商为后续目标；当前沿用 Qwen／OpenAI。
- 音乐首期采用用户创作／外部 AI 方案交接和文件回流。Suno 当前为官方创作入口与文件导入；自动音乐生成适配器须待正式能力核验后另行实现，不能将本轮原创测试波形或本地 SDK 测试端称为真实生成／云发布。
- 真实 FFmpeg 容器、服务端可信收据／计划／私有指针和 COS／STS 发布已续验；本机 worker 已构建并批准，尚未部署到云端。实际公开地址使用 COS 默认 HTTPS 域名，未宣称自定义域名或 CDN 验收。
- 本机固定 Qwen 模型的真实合成、客观音质测量、独立 ASR 和两端导出播放已验收；匿名真人听审包已准备，自然度／音色一致性评分仍 pending。作者目前只有这台 Mac，实际手机／平板、第二台电脑、真实系统中断与长任务压力仍待验收；浏览器触摸模拟与原生 OS 模拟器按本轮实际范围单独记录。付费云端 TTS、完整 Electron 应用与云端生成／发布旅程未在本轮验收；packed launch 套件未作为此次普通单测运行。

这些项目仍按主计划建设，不把本轮优先交付的引擎与协议当作十二项任务全部完成。
