# 音频管理与统一协议验收

日期：2026-10-11；真实 COS、本地配对与 Qwen 参数续验更新：2026-10-12

状态：真实本地 Qwen 两端作者执行／导出播放、真实 FFmpeg 容器、限定 STS 的 COS 发布及双浏览器公开音频播放通过。作者最新确认先使用本地 TTS；云端 TTS 与持久云部署暂缓，不属于本阶段完成条件。统一协议、音色设计与 JSON Flow 实现及质量限制见下方记录

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

## 明确限制与剩余完整系统验收

- 音频作者服务当前固定 `adv` 内容根。自定义根显示明确错误并禁止写入；保留已有资产 profile root，不另建或猜测项目数据。
- Editor Mixer 为可保留冲突草稿的 JSON 编辑器，Studio 提供六总线控制。两端版本化音色设计与 JSON Flow 可视化编辑已接入共享协议；当前续建验收结果见上方记录。
- 本地共享 Node 服务和 Studio 原生同步已实现并真实验收。可选云部署需另行完成真实会话、项目注册、持久主机和可信预设；作者当前选择暂缓。Qwen／OpenAI 缺少供应商结果查询能力时未知请求不能自动重试，未宣称供应商侧已保证远程去重收费。
- MiniMax／豆包等更多供应商为后续目标；当前沿用 Qwen／OpenAI。
- 真实 FFmpeg 容器、服务端可信收据／计划／私有指针和 COS／STS 发布已续验；本机 worker 已构建并批准，尚未部署到云端。实际公开地址使用 COS 默认 HTTPS 域名，未宣称自定义域名或 CDN 验收。
- 本机固定 Qwen 模型的真实合成、单机指标和两端导出播放已验收；声音自然度／一致性仍需听审，尚未做独立 ASR 转录、长任务压力或跨设备质量评估。付费云端 TTS、完整 Electron 应用与云端生成／发布旅程未在本轮验收；packed launch 套件未作为此次普通单测运行。

这些项目仍按主计划建设，不把本轮优先交付的引擎与协议当作十二项任务全部完成。
