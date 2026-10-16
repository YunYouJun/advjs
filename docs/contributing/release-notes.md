# 中文 Release Notes

正式主／次版本发布后，GitHub Agentic Workflows 使用仓库所有者的 Copilot 额度生成中文摘要，并放在 GitHub Release 正文顶部。现有 changelog 原文、Release 标题、附件和版本标记由原发布流程管理。

## 触发规则

| 场景                                                     | 行为                                      |
| -------------------------------------------------------- | ----------------------------------------- |
| 发布 `v0.4.0`、`v1.0.0`、`desktop-v1.2.0`、`core-v1.2.0` | 自动生成                                  |
| 发布补丁版，例如 `v0.4.1`                                | 调用模型前跳过，可手动补生成              |
| 草稿、预发布或 `v0.0.0`                                  | 自动跳过                                  |
| 已有完整中文区块                                         | 默认跳过；手动 `force=true` 可替换区块    |
| 只有 tag，没有 GitHub Release                            | 正式写入会失败；`dry_run=true` 可生成预览 |

版本和比较范围由 `scripts/release/release-notes.mjs` 在调用模型前确定。默认选择同一 tag 前缀下、可从目标提交追溯到的最高较早正式版本；首次发布使用目标提交可达的历史。`v`、`desktop-v`、`core-v` 各自比较，不混用。可用 `from_tag` 指定同系列、较早且为目标祖先的 tag。

外部发布通过 `release: published` 触发。仓库的 `release.yml` 在发布事务和桌面附件上传成功后直接调用可复用工作流，因为 `GITHUB_TOKEN` 创建的 Release 不会再次触发普通 Release 事件工作流。`release-core.yml` 只发布 npm 包，推送 tag 本身不会创建 GitHub Release，也不会生成摘要。

## 认证与额度

工作流声明 `copilot-requests: write`，编译结果直接将 `github.token` 提供给 Copilot，不需要新增 PAT、`COPILOT_GITHUB_TOKEN` secret 或外部模型 API key。ADV.JS 是个人账户仓库，按 [GitHub 官方计费规则](https://docs.github.com/en/copilot/concepts/agent-capabilities/agent-powered-workflows-and-operations/copilot-cli-in-github-actions)，调用使用仓库所有者 YunYouJun 的 Copilot 席位额度。

仓库所有者需要有可用的 Copilot 额度和模型访问权限；Actions 计算时间按现有规则计费。迁入组织后会改为组织计费，并需要组织开启相应策略。工作流的 `max-ai-credits: 50` 是 gh-aw 的成本控制配置，不等于额外赠送额度或账单硬上限；额度耗尽时应检查运行日志和 Copilot 账单。

## 手动补生成

在 Actions 中选择“中文 Release Notes”→ Run workflow，选择包含最新工作流的默认分支 `dev`，填写目标 tag。也可以运行：

```bash
gh workflow run release-notes-zh.lock.yml -R YunYouJun/advjs --ref dev \
  -f tag=v0.4.1
```

先预览旧 tag，不创建或修改 Release：

```bash
gh workflow run release-notes-zh.lock.yml -R YunYouJun/advjs --ref dev \
  -f tag=core-v0.1.2 -f dry_run=true
```

`from_tag` 可覆盖比较起点。重新生成已有区块时显式传 `force=true`；该选项仅替换 `ai-notes-zh:start/end` 管理的中文区块。区块外的原文按字节保留；缺失、重复或顺序异常的标记会导致失败，避免误覆盖手写内容。并发运行按 tag 排队，发布前重新读取 Release，重复调用不会重复添加区块。

手动入口的 `automatic` 默认关闭，允许补丁版补生成。发布流程内部调用时设为 `true`，自动执行版本筛选。

## 维护工作流

修改 `.github/workflows/release-notes-zh.md`，然后使用固定版本编译；不要直接修改生成的 `.lock.yml`：

```bash
gh extension install github/gh-aw --pin v0.92.0
gh aw compile release-notes-zh --validate
```

一并提交 Markdown、生成的 `.github/workflows/release-notes-zh.lock.yml`、`.github/aw/actions-lock.json` 和 `.gitattributes`。自定义发布 job 只接受模型生成的 `notes`，目标 tag 来自工作流输入；只有检测通过后才可执行写入。模型不能通过工具参数替换 changelog 或选择其他 Release。

## 验证

```bash
pnpm vitest run tests/unit/tooling/release-notes.test.ts \
  tests/unit/tooling/release-workflow-contract.test.ts \
  tests/unit/tooling/release-manifest.test.ts \
  tests/unit/tooling/release-transaction.test.ts --reporter=default
pnpm docs:check
pnpm docs:build
```

本地测试覆盖版本筛选、真实 Git tag 范围、原文保留、幂等和定向 PATCH；编译验证覆盖 gh-aw 配置及可复用工作流权限。云端预览用于进一步核验 `GITHUB_TOKEN` 的 Copilot 认证。运行成功后检查 `publish_release_notes` job、Summary 和 `release-notes-zh-<run_id>` artifact；`dry_run` 不会写入 Release。正式运行还应确认 GitHub Release 中中文区块下方的原 changelog 完整保留。

可复用模板和认证说明见 [YunYouJun/ai](https://github.com/YunYouJun/ai/tree/main/examples/copilot-release-notes)。
