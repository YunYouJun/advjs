# CI 与站点预览

ADV.JS 使用 GitHub Actions 检查合并条件，Cloudflare Pages 提供 PR 预览，Vercel 保留生产部署并支持显式发起预览。托管平台的配额不作为代码合并条件。

## 必需合并检查

`config/ci-deployment-policy.json` 是仓库策略的权威配置。`dev` 和 `main` 使用 `Required GitHub Actions checks` ruleset，要求分支与目标分支同步，并要求以下检查由 GitHub Actions 应用报告成功：

| 检查                   | 覆盖内容                                             |
| ---------------------- | ---------------------------------------------------- |
| `launch-required`      | 构建、类型、lint、单元、浏览器、跨平台安装和发布流程 |
| `docs-build`           | 文档生产构建                                         |
| `demo-build`           | 独立 Demo 生产构建                                   |
| `parser-browser-smoke` | Parser 生产页面与 dialog 输出                        |
| `desktop-required`     | 桌面构建及本次改动需要的打包验收                     |

桌面汇总检查只接受明确的打包决策。涉及桌面运行时或打包依赖时，Linux 包必须完成启动与导出验收；无相关改动时允许跳过打包。手动执行 Desktop CI 时要求完整平台矩阵。失败、取消和不符合条件的跳过都会使汇总检查失败。

规则 payload 可由仓库配置生成，管理员应用前应检查现有 rulesets，并更新同名规则，保留其他规则：

```bash
node --input-type=module -e "import { githubRuleset } from './scripts/ci/deployment-policy.mjs'; console.log(JSON.stringify(githubRuleset()))" > /tmp/advjs-required-checks.json
gh api repos/YunYouJun/advjs/rulesets
# 首次创建；已有同名规则时使用 PUT /repos/YunYouJun/advjs/rulesets/<id>。
gh api repos/YunYouJun/advjs/rulesets --method POST --input /tmp/advjs-required-checks.json
```

## Cloudflare PR 预览

Editor、Studio 和 VRM 使用已有 Git 集成项目。Docs、Demo 和 Parser 使用以下独立项目，仅发布预览，不绑定生产域名：

| 站点   | Pages 项目             | 构建命令                                                       | 输出目录                          |
| ------ | ---------------------- | -------------------------------------------------------------- | --------------------------------- |
| Docs   | `advjs-docs-preview`   | `pnpm docs:build`                                              | `docs/.vitepress/dist`            |
| Demo   | `advjs-demo-preview`   | `pnpm build:demo`                                              | `demo/starter/dist`               |
| Parser | `advjs-parser-preview` | `pnpm build:advjs && pnpm -C packages/parser/playground build` | `packages/parser/playground/dist` |

三个项目关联同一 GitHub 仓库，在特性分支推送时发布受影响站点，并在 PR 中提供预览链接。`dev`、`main` 不触发这些项目；生产发布关闭。Node 与 pnpm 版本取自 `.node-version` 和 `package.json`，预览环境仅设置这两个构建工具版本，不复制生产凭据。

`pagesPreviewProject(key, repository)` 生成 Pages API 配置；它拒绝其他仓库。管理员可通过 Pages API 创建项目或同步设置，Git 集成自动负责构建，不需要把 Cloudflare 发布凭据交给 PR 的 GitHub Actions 工作流。

## Vercel 生产与按需预览

Vercel 的 `advjs`、`advjs-demo` 继续从 `main` 自动发布生产；`advjs-parser` 继续从 `dev` 自动发布。项目设置 `previewDeploymentsDisabled: true`，使普通 PR 推送不再自动生成 Vercel 预览。无需修改生产分支、构建目录、域名或环境变量。

需要验证 Vercel 特有行为时，在项目控制台显式创建对应提交的预览，或使用已登录的 Vercel CLI：

```bash
vercel --scope yunyoujuns-projects
```

先确认本地目录关联正确的项目，使用默认预览环境，并记录实际部署提交。不要向按需预览添加生产标志。

使用 Vercel Deployments API 时，Git 来源必须指向明确的仓库和提交；API 的预览目标使用 `staging`，不是 `production`。现有 Git 连接在服务端完成认证，无需在请求中传递 GitHub token。

## 验证

检查 GitHub 的两个目标分支是否应用同名 ruleset、检查来源是否为 GitHub Actions，以及 PR 的五项必需检查是否成功。确认普通 PR 没有自动 Vercel 部署，Cloudflare 预览的提交与 PR head 一致，并验证首页、Demo 路由和 Parser 解析输出。最后显式创建一次 Vercel 预览，确认按需部署仍可执行。

参考 [GitHub 必需状态检查](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches#require-status-checks-before-merging)、[Cloudflare 分支控制](https://developers.cloudflare.com/pages/configuration/branch-build-controls/)和 [Vercel 项目 API](https://vercel.com/docs/rest-api/projects/update-an-existing-project)。
