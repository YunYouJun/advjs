# Studio 生产 AI 能力盘点

盘点范围：`apps/studio/src` 的文本生成、聊天、内容抽取、Embedding、图片、TTS、ASR、配置与凭证持久化。目标是验证生产版只有已登记能力可以产生供应商调用。

| 能力/遗留路径                   | 生产状态    | 生产行为                                                            | 验证点                                                 |
| ------------------------------- | ----------- | ------------------------------------------------------------------- | ------------------------------------------------------ |
| 剧情大纲                        | 托管        | `generate-outline` 经 `ManagedAgentRuntime`；返回待确认提案         | `OutlineGenerateModal.vue`、proposal review            |
| 章节草稿                        | 托管        | `generate-chapter-draft` 经 Runtime；只读取目标章节和共享创作上下文 | `ChapterDraftModal.vue`、project-context tests         |
| 情节建议                        | 托管        | `suggest-plot` 经 Runtime；结构化结果显示在任务轨                   | `PlotSuggestionModal.vue`、result parser tests         |
| 角色扮演模拟                    | 托管        | `simulate-roleplay` 经 Runtime；只发送选中的已保存角色卡            | `RoleplaySimulationModal.vue`、project-context tests   |
| 一致性检查                      | 托管、只读  | `check-consistency` 经 Runtime；诊断审阅完成后不写项目              | `ConsistencyCheckModal.vue`、diagnostic proposal state |
| 通用聊天                        | 隐藏        | `/tabs/chat` 重定向到工作区；不加载旧 Chat 页面                     | router/source guard                                    |
| 角色聊天                        | 隐藏        | 旧聊天 URL 重定向到角色信息；不加载聊天页面                         | router/source guard                                    |
| 群聊                            | 隐藏        | 生产路由和 World 入口移除                                           | router/source guard                                    |
| 智能素材导入                    | 隐藏        | 旧入口和路由关闭；不回退旧生成 pipeline                             | Workspace/CreateProjectModal/router                    |
| 内容抽取、记忆抽取              | Fail closed | 未登记托管能力前不发模型请求                                        | `aiExtraction.ts`                                      |
| Embedding                       | 本地回退    | 未登记托管能力前仅用关键词检索，不请求向量服务                      | `useKnowledgeBase.ts`                                  |
| 角色日记、世界事件              | Fail closed | 保留本地数据结构，不生成新 AI 内容                                  | diary/world event stores                               |
| 图片生成                        | 隐藏        | 场景、角色、封面和市场发布不调用图片模型；可保留提示词              | workspace/editor modals                                |
| 云端 TTS、托管 ASR              | 隐藏        | 生产入口不加载供应商 TTS/ASR 客户端                                 | build guard                                            |
| 模型/provider/base URL/key 设置 | 移除        | 设置页只显示服务状态、点数、额度和隐私说明                          | `SettingsAiPage.vue`、source guard                     |
| 旧 BYOK 本地数据                | 本地删除    | 启动时只调用 `removeItem('advjs-studio-ai')`，不读取或上传          | `legacy-credentials.ts`、unit test                     |
| BYOK 开发 Runtime               | 隔离        | 仅允许从 `agent/byok-dev` 显式导入；生产 barrel 不导出              | module/build guard                                     |

## 静态门禁

1. 源码测试锁定五个入口不再依赖旧设置 store、浏览器 AI client 或旧 generator。
2. 生产路由测试锁定未迁移页面不被动态加载。
3. Vite `generateBundle` 守卫同时检查模块图和最终 JavaScript 文本；发现 BYOK 开发模块、旧客户端、供应商域名或旧设置 schema 标记即构建失败。
4. 真实旧 localStorage key 只允许出现在本地清理迁移中，因此守卫扫描旧设置模块/字段，而不阻止这条单向删除代码进入生产包。

## 后续开放规则

新能力只有在服务端完成 capability ID、上下文白名单、价格、用量上限、安全规则、结果 parser 和点数结算登记后，才能重新出现在 Studio 生产 UI。仅保留旧浏览器实现不构成已迁移；没有托管实现时必须继续隐藏或 fail closed。
