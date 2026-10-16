# AI 双语 Release Notes

正式主／次版本发布后，GitHub Agentic Workflows 使用仓库所有者的 Copilot 额度生成简体中文和英文摘要，并放在 GitHub Release 正文顶部。手动补生成可选择语言，现有 changelog 原文、Release 标题、附件和版本标记由原发布流程管理。

## 语言与阅读方式

默认 `language=both`，一次分析 Git 变更后输出中英文，分类、事实和引用相互对应。已有另一语言摘要会作为翻译对照，同时仍需核对目标 Git 范围。

新生成的每种语言必须包含可点击的 GitHub PR 或 commit 链接；同时生成中英文时，脚本还会检查两版引用 URL 的集合一致，避免一版遗漏来源。该检查保证引用对应，内容是否忠实仍需维护者审阅。

Release 顶部提供“简体中文 · English · 完整变更记录”导航，使用 GitHub 原生 `<details>` 分区。中文默认展开，英文和完整 changelog 默认折叠；只生成英文时，英文默认展开。读者先阅读摘要，需要时再查看另一语言或完整记录。导航和折叠不调用模型；GitHub Release 使用单一正文，不保存个人语言偏好。

导航使用 `<a name="ai-release-notes-zh"></a>` 形式的命名锚点，放在对应分区的内容内部，并链接到 GitHub 渲染后带 `user-content-` 前缀的目标。点击导航时，GitHub 会展开目标分区并定位；也可直接点击分区标题。实际页面检查应确认内容可见且进入视口，不能只核对 fragment。

| `language` | 本次请求                   |
| ---------- | -------------------------- |
| `both`     | 中英文；默认只补缺失的语言 |
| `zh-CN`    | 仅简体中文，保留已有英文   |
| `en`       | 仅英文，保留已有中文       |

旧版 `ai-notes-zh:start/end` 中文区块仍受支持。首次补英文时会升级为双语布局，已有中文区块与其外原文保持原样。已有语言默认不重写；`force=true` 仅重新生成本次选择的语言。

## 触发规则

| 场景                                                     | 行为                                      |
| -------------------------------------------------------- | ----------------------------------------- |
| 发布 `v0.4.0`、`v1.0.0`、`desktop-v1.2.0`、`core-v1.2.0` | 自动生成                                  |
| 发布补丁版，例如 `v0.4.1`                                | 调用模型前跳过，可手动补生成              |
| 草稿、预发布或 `v0.0.0`                                  | 自动跳过                                  |
| 所选语言全部已有完整区块                                 | 调用模型前跳过；`force=true` 重写所选语言 |
| 只有 tag，没有 GitHub Release                            | 正式写入会失败；`dry_run=true` 可生成预览 |

版本和比较范围由 [ai 中的集中脚本](https://github.com/YunYouJun/ai/blob/main/scripts/release-notes.mjs) 在调用模型前确定。默认选择同一 tag 前缀下、可从目标提交追溯到的最高较早正式版本；首次发布使用目标提交可达的历史。`v`、`desktop-v`、`core-v` 各自比较，不混用。可用 `from_tag` 指定同系列、较早且为目标祖先的 tag。

外部发布通过 `release: published` 触发。仓库的 `release.yml` 在发布事务和桌面附件上传成功后直接调用可复用工作流，因为 `GITHUB_TOKEN` 创建的 Release 不会再次触发普通 Release 事件工作流。`release-core.yml` 只发布 npm 包，推送 tag 本身不会创建 GitHub Release，也不会生成摘要。

预检查和 Copilot 分析运行在不同 job，二者都必须检出完整 Git 历史。分析 job 使用顶层 `checkout.fetch-depth: 0`，优先从本地 Git 读取历史版本；GitHub MCP 的完整性过滤可能隐藏历史内容，不能将其作为唯一数据来源。首次发布的比较起点为空是正常情况。

## 认证与额度

工作流声明 `copilot-requests: write`，编译结果直接将 `github.token` 提供给 Copilot，不需要新增 PAT、`COPILOT_GITHUB_TOKEN` secret 或外部模型 API key。ADV.JS 是个人账户仓库，按 [GitHub 官方计费规则](https://docs.github.com/en/copilot/concepts/agent-capabilities/agent-powered-workflows-and-operations/copilot-cli-in-github-actions)，调用使用仓库所有者 YunYouJun 的 Copilot 席位额度。

仓库所有者需要有可用的 Copilot 额度和模型访问权限；Actions 计算时间按现有规则计费。迁入组织后会改为组织计费，并需要组织开启相应策略。工作流的 `max-ai-credits: 50` 是 gh-aw 的成本控制配置，不等于额外赠送额度或账单硬上限；额度耗尽时应检查运行日志和 Copilot 账单。

## 手动补生成

在 Actions 中选择“AI Release Notes”→ Run workflow，选择包含最新工作流的默认分支 `dev`，只需填写目标 tag；高级选项通过可选的 `options` JSON 传入。工作流文件名保留 `release-notes-zh.lock.yml`，兼容既有调用；它现在是手写的轻量调用入口，不再是本仓库编译的文件。默认补齐中英文：

```bash
gh workflow run release-notes-zh.lock.yml -R YunYouJun/advjs --ref dev \
  -f tag=v0.4.1
```

先预览旧 tag，不创建或修改 Release：

```bash
gh workflow run release-notes-zh.lock.yml -R YunYouJun/advjs --ref dev \
  -f tag=core-v0.1.2 -f options='{"dry_run":true}'
```

只补英文，或只重写英文：

```bash
gh workflow run release-notes-zh.lock.yml -R YunYouJun/advjs --ref dev \
  -f tag=v0.4.1 -f options='{"language":"en"}'

gh workflow run release-notes-zh.lock.yml -R YunYouJun/advjs --ref dev \
  -f tag=v0.4.1 -f options='{"language":"en","force":true}'
```

`options` 支持 `from_tag`、`language`、`force`、`dry_run`；其中 `from_tag` 可覆盖比较起点。JSON 布尔值必须使用 `true` / `false`，未知字段和无效类型会在调用模型前报错。旧版 CLI 的 `-f language=en -f force=true` 改为 `-f options='{"language":"en","force":true}'`。新版布局由 `ai-release-notes:start/end` 管理，每种语言另有 `ai-notes-zh:start/end` 或 `ai-notes-en:start/end` 标记。未选中的语言区块和外部原文按字节保留；缺失、重复、交叉或越界的标记会导致失败。并发运行按 tag 排队，发布前重新读取 Release，重复调用不会重复添加区块。

完整 changelog 放在 `ai-changelog:start/end` 标记的折叠容器内，容器中的原文保留原有换行和内容，不修改仓库内的 changelog 文件。仅调整既有摘要排版的 `layout` 命令由 ai 集中维护，操作说明见 [复用工作流指南](https://github.com/YunYouJun/ai/blob/main/docs/guide/copilot-release-notes.md)，不会调用模型。

共享事件入口根据调用方事件集中判断：手动调用允许补丁版，Release 事件只自动处理正式主／次版本。调用方不再声明 `automatic`、语言或多个布尔输入。发布事务通过 typed API 显式传 `automatic=true`，继续自动执行版本筛选。

## 维护工作流

`.github/workflows/release-notes-zh.lock.yml` 仅声明 Release 事件及 `tag`、可选 `options` 两个手动输入，再调用 ai 的 `release-notes.yml` 事件入口；没有本地 `workflow_call.inputs` 或 `with` 转发。`release.yml` 在发布事务完成后直接调用 ai 的 `release-notes.lock.yml` typed API，传入目标 tag 与 `automatic=true`。两处引用固定为同一提交，不需要复制 AI 提示词、发布脚本或安装 gh-aw。

调用版本固定为完整提交 SHA；升级时先检查 ai 的变更，再同步修改两处 `uses` 后的 SHA。公共复用示例也提供 `release-notes-v1` 标签，便于其他仓库用几行配置接入。

预检查和发布脚本按 `job.workflow_sha` 检出 ai 的同一提交，分析 job 按 `github.repository` 检出 ADV.JS 的完整历史。运行及 Copilot 认证使用 ADV.JS 自带的 `GITHUB_TOKEN`，不需要 `secrets: inherit`、PAT 或模型密钥。分析保持只读，只有检测通过的发布 job 可以写入本仓库 Release。

摘要格式、版本筛选和原文保留的回归测试已集中在 ai；ADV.JS 检查调用权限、输入转发和发布事务的衔接。不要在本仓库重新引入一份生成器副本。

## 验证

```bash
pnpm vitest run tests/unit/tooling/release-notes.test.ts \
  tests/unit/tooling/release-workflow-contract.test.ts \
  tests/unit/tooling/release-manifest.test.ts \
  tests/unit/tooling/release-transaction.test.ts --reporter=default
pnpm docs:check
pnpm docs:build
```

集中实现的测试覆盖版本筛选、真实 Git tag 范围、双语与单语、旧中文区块升级、按语言重写、原文保留、幂等和定向 PATCH；本仓库的测试覆盖调用接口和发布事务。云端预览用于进一步核验 `GITHUB_TOKEN` 的 Copilot 认证。运行成功后检查 `publish_release_notes` job、Summary 和 `release-notes-<run_id>` artifact 内的 `release-notes-preview.md`；`dry_run` 不会写入 Release。正式运行还应确认两种语言内容对应、导航与折叠正常，以及下方原 changelog 完整保留。

可复用模板和认证说明见 [YunYouJun/ai](https://github.com/YunYouJun/ai/tree/main/examples/copilot-release-notes)。
