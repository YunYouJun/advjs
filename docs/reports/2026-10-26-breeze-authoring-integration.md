# Breeze 作者语音集成验收

- 日期：2026-10-26。
- 状态：本地 Editor 的描述设计、参考声音克隆、试听、音色应用和对白选用已验证；插件尚未发布到 npm。
- 范围：新增 `@advjs/plugin-breeze-tts`，复用现有作者协议与界面，不增加独立工作台前端。

## 实现与环境

供应商通过回环 HTTP 调用 Xinference 4.1.0 中已加载的 `Breeze-TTS-2`，本机 UID 为 `breeze-bf16`。后端沿用既有 Apple M1 Pro / 32 GB 上的 MLX-Audio 0.6.1 与 BF16 文件；本轮没有安装另一份 Python 环境或下载模型权重。

现有音色描述、气质、说话风格、年龄印象、性别表达、音高和语速转换为 Breeze `instruct`。默认 seed 42、CFG 4，扩展参数按 Xinference 协议编码到字符串 `kwargs`。支持中文区域的描述设计和参考声音克隆；不声明永久供应商音色创建或流式生成。

克隆复用现有音频资源导入、授权参考音色表单和原生素材目录，实际音频通过 multipart `prompt_speech` 上传，逐字稿通过 `kwargs.prompt_text` 传递。新增通用 `referenceModes` 能力声明，Editor 只展示 Breeze 支持的 `icl`；保留未声明该字段的既有适配器行为。参考素材在请求前后检查身份、哈希、大小、路径和角色归属，原生目录分片使用共享资产解析。

候选含真实 WAV 时长、采样率、大小、SHA-256 和指令哈希身份，登记与选用沿用共享事务。预设变更、取消、异常音频及路径越界有对应检查。Xinference 注册修订与实际本地 BF16 权重可能不同，因此候选没有伪造模型修订。

## 验证结果

| 检查         | 实际结果                                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| 适配器测试   | 35 项通过，包括原有候选测试及参考录音、逐字稿、multipart、目录分片、错误模式、归属和执行期变化检查                          |
| 相关回归     | 当前工作区 10 个测试文件共 165 项通过，覆盖 Breeze、OpenAI、Qwen、CLI、供应商注册、原生音色服务、Editor 和 Studio 协议      |
| 构建         | types、Breeze、ADV.JS 宿主 unbuild 和 Editor Nuxt 构建成功；Breeze ESM 与声明约 21.6 kB                                     |
| 类型与风格   | 新适配器严格 TypeScript 检查通过，新增 TypeScript 文件 ESLint 通过                                                          |
| 文档         | `node scripts/check-docs.mjs` 通过                                                                                          |
| 真实 Editor  | Playwright Chromium 通过；使用现有 `editor/core/dist`，同一原生界面执行真实 HTTP 推理                                       |
| 参考来源     | 本轮用描述设计生成的原创虚构女声，11.76 秒、24 kHz，解码 RMS 约 0.097；不使用真人录音                                       |
| 真实声音克隆 | 界面导入该录音，保存完整逐字稿与原生授权记录，生成「我们又见面了。这一次，就让我陪你走到故事的最后。」；3.6 秒、172844 字节 |
| 克隆输入核对 | 上传录音字节哈希与原始候选完全一致，完整逐字稿、CFG 4、seed 42 与界面审核输入一致                                           |
| 样本与角色   | 确认前没有推理；生成后可试听、登记、选用，再应用到 Hero 的 `zh-CN / breeze-tts` 绑定                                        |
| 对白任务     | 生成「你好，世界。」；登记为未选 take，在对白配音面板试听后显式选用，音色项目身份和参数保留                                 |
| 布局         | 1440 × 1000 工作区与 320px 音频面板截图已检查，克隆字段、候选和播放器无面板水平溢出                                         |
| 运行错误     | 成功验收中的页面异常为 0；保留示例项目重新启动后可载入，页面异常为 0                                                        |

当前回归显式排除 `.claude/worktrees/`，165 项只计当前工作区。此前描述设计阶段的回归曾额外匹配同名工作树测试，未把那些副本计入当前结果，也未修改这些工作树。

浏览器验证采用 regular Playwright，原因是本会话未提供 Browser 插件技能。克隆验收初次发现测试加载旧的已构建 ADV.JS 宿主，导致界面没有克隆来源选项；中断等待、重建宿主后完整流程通过。等待工作区和标题就绪后再检查页面身份，未跳过功能断言。

保留示例的独立启动脚本另发现项目缺少 ESM 包标记，直接导入 TS 配置时得到默认导出包装，导致作者供应商配置没有正确传入。已在该本机示例补充 `package.json` 的 `type: module`，既有角色、样本和对白文件保留；原生宿主只读复查确认供应商声明同时包含描述与克隆来源。

## 使用入口与证据

配置与操作见[插件说明](https://github.com/YunYouJun/advjs/blob/main/plugins/plugin-breeze-tts/README.md)和[作者语音模块](/guide/authoring-voice)。可复跑的真实验收入口为 `tests/fixtures/audio/editor-real-breeze.playwright.config.ts`，必须显式设置 `ADVJS_REAL_BREEZE=1`，普通测试不调用模型。

本机保留的演示和证据：

- 示例项目：`~/.local/share/breeze-tts/advjs-demo/project/`；有角色音色、已登记试听样本和已选对白，复用原来的权重。
- 启动命令：`~/.local/bin/advjs-breeze`；本地 Editor 地址为 `http://127.0.0.1:3358`，Xinference 服务须先运行。首次访问按欢迎窗口选择语言。
- 截图与摘要：`~/.local/share/breeze-tts/advjs-evidence/` 中的 `breeze-normal.png`、`breeze-320.png`、`breeze-dialogue.png` 与 `qa.json`。
- 实际音频：同目录中的 `breeze-editor-preview.wav`、`breeze-editor-dialogue.wav`。
- 克隆证据：`~/.local/share/breeze-tts/advjs-clone-evidence/` 中的 `breeze-clone-normal.png`、`breeze-clone-320.png`、`breeze-editor-clone.wav`、`qa.json` 与本地服务复查 `demo-qa.json`。原有示例项目保留，3358 服务已重启以加载克隆能力。

示例连接信息含本地项目会话凭据，单独保存在权限为 `0600` 的本机文件，未写入本报告。示例依赖当前仓库位置及已构建 Editor，尚未作为独立安装包交付。

临时验收项目和宿主状态在退出时清理，完成后的测试运行元数据另行回收。保留的示例和早期证据不足 1 MiB，新增克隆截图与音频约 1.1 MiB；插件构建目录约 32 KiB（文件系统占用）。未复制模型、依赖目录或其他工作树；Editor 与宿主构建复用仓库常规输出和缓存。

## 验证边界

本轮证明了真实参考音频与逐字稿传递、声音克隆生成、浏览器播放、音色应用和既有对白选用，没有做真人声纹相似度、主观音质排名或情绪准确率评测。音高、语速与情绪是自然语言偏好，模型不保证精确声学数值。Studio 真实部署、Electron 分发包、Windows 服务端及游戏发布构建未在本轮验收；Studio 表单的参考模式选项尚未同步本次 Editor 能力过滤。
