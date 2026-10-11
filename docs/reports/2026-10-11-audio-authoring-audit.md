# 音频管理与 TTS 插件审核

日期：2026-10-11

状态：规范与作者插件接入验证通过；完整多轨系统尚未完成

范围：`dev` 分支拉取至 `f8b35117` 后的音频、作者语音、项目构建与公共文档；本次没有修改 UI。

## 结论与依据

完整配音／音频／音效／音乐管理系统尚未建设完成。现有 `useAdvBgm` 处理兼容期音乐播放；Core Snapshot 仍只记录 BGM。`@advjs/audio`、统一 Audio Director／Mixer、台词 `lineId + locale + selectedTake`、创作 ledger、可恢复生成队列与专用音频处理／发布链路均未落地。

最新上游已实现通用作者 Provider、Qwen MLX、版本化音色库、短句样本读取／试听／显式选用、CLI 与本地 Editor 人物面板。Studio 音频素材 CRUD 和浏览器 TTS 是现有独立接口，尚未与该作者服务或新 Runtime 合并。

实际入口：

- `packages/types/src/config/voice.ts`：作者接口、候选与音色库；
- `packages/advjs/node/commands/voice.ts`、`voice-library.ts`：路由、生成、完整性验证与样本选用；
- `plugins/plugin-qwen-tts/`：本地 MLX 适配器；
- `editor/core/app/components/character/CharacterVoicePanel.vue`：本地短句审核；
- `packages/client/composables/useAdvBgm.ts`：兼容播放；
- `apps/studio/src/utils/audioMd.ts`、`ttsClient.ts`：Studio 旧素材／试听接口。

## 本次落地

1. 补齐权威设计的用途分类、资源生命周期、引用删除与交付边界，更新指南和实施计划的当前状态。
2. 添加 `@advjs/plugin-openai/voice` 与构建入口，复用 `AdvVoiceSynthesisProvider`；只读列举无需密钥，显式合成使用进程／可信服务端凭证，禁用自动收费重试。
3. OpenAI 生成不可变 WAV 候选及 receipt，支持取消、部分失败清理、预设冲突检测、模型／参数校验与项目路径隔离。供应商音色 `providerVoiceId` 与项目音色身份分开保存。
4. 注册时校验 Provider 能力；`--voice` 按实际实现路由；拒绝与请求人物不一致的预设检查结果，文件复核结束后再次检查取消与预设变化。
5. 修复项目构建将所有音频投影到 BGM 曲库的问题；现在只有 `kind: bgm` 可加入，参考、配音、环境音与音效保持隔离。

## 验证

契约测试全部使用模拟 Provider／SDK 和临时项目。没有付费 TTS 请求、模型下载、COS 写入或外部部署。

环境：Node.js 24.18.0、pnpm 11.20.0。检查结果：

| 检查                                                                               | 结果                                                                                      |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 作者接口／CLI、Qwen／OpenAI、音色审核、项目构建分类、音频 Catalog、BGM／sound 回归 | 14 个测试文件、105 项测试通过                                                             |
| `pnpm typecheck`                                                                   | 通过                                                                                      |
| 改动文件 ESLint                                                                    | 通过                                                                                      |
| `pnpm build:advjs`                                                                 | 完整有序构建链通过                                                                        |
| Qwen 与 OpenAI 插件 `build`                                                        | 均通过，生成 ESM 与声明入口                                                               |
| `pnpm docs:check`                                                                  | 44 个文件检查通过                                                                         |
| `pnpm docs:build`                                                                  | 通过；原有 TypeDoc 标签与 Vite 配置／包体积告警不阻断构建                                 |
| 无 API Key 的构建产物 CLI 检查                                                     | `adv voice preview --root <临时项目> --list --json` 成功加载 `./voice` 并列举 OpenAI 预设 |

回归命令：

```bash
pnpm vitest run tests/unit/voice plugins/plugin-openai/tests/voice.test.ts plugins/plugin-qwen-tts/tests tests/unit/assets/audio-catalog.test.ts tests/unit/desktop/desktop-project-build.test.ts tests/unit/client/client-bgm.test.ts tests/unit/client/client-runtime-presentation.test.ts tests/unit/client/use-sound.test.ts
pnpm typecheck
pnpm build:advjs
pnpm --filter @advjs/plugin-openai build
pnpm --filter @advjs/plugin-qwen-tts build
pnpm docs:check
pnpm docs:build
```

OpenAI 请求参数已核对 [Speech API 官方参考](https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create)与 [PCM 输出格式](https://developers.openai.com/api/docs/guides/text-to-speech#supported-output-formats)。未运行全仓库测试或 UI E2E；本次没有 UI 改动，也没有声称完成新 AudioEngine 的跨端验收。

## 尚未验收

- 真实 OpenAI 账户、网络、语音质量及付费行为；插件 npm 发布。
- Qwen 本机模型推理与硬件质量测试；本次只验证适配器契约。
- MiniMax 插件、统一多轨 Runtime、台词绑定、多语言 take、批量任务、完整 Editor／Studio Audio Studio 与音频发布。

后续执行以[主设计](/specs/2026-08-12-audio-system-design)和[主实施计划](/plans/2026-08-12-audio-system-implementation)为准，本报告不替代功能验收。
