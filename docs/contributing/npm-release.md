# npm 可信发布

`release-npm.yml` 使用 GitHub Actions OIDC 发布 ADV.JS 的固定包集合，公开安装验证通过后才更新 `latest`。发布不依赖本机登录会话或 `NPM_TOKEN`；首次配置包名和可信发布者时，npm 仍要求维护者交互认证。

## 准备固定包

选择已通过完整 ADV.JS CI 的提交所在分支，从同一分支运行 workflow 的 `prepare` 操作。该流程检查精确提交的 CI、构建包并上传 `npm-packages-<run-id>`，其中包含 `packages.json` 和所有 `.tgz`。

若同版本已发布，压缩容器可能因打包平台不同而改变 SHA-512。准备流程仅在完整解压 tar 数据逐字节一致时复用已发布的原始 archive，并记录两个校验值；文件内容或 tar 元数据有任何变化都会阻止复用。

```bash
gh workflow run release-npm.yml --ref dev -f operation=prepare
gh run list --workflow release-npm.yml
```

首次使用新 workflow 时，它必须先进入仓库默认分支。若从维护分支发布，准备和发布操作使用相同分支、相同提交；发布会拒绝来自另一个提交的候选包，确保 provenance 指向实际打包源码。

## 初始化 npm 信任关系

新包必须先存在于 npm，才能配置 OIDC。下载通过准备流程生成的包，在本机终端运行初始化脚本；在终端即时出现的浏览器页面完成认证，避免聊天交接导致授权链接超时。

```bash
gh run download <prepare-run-id> --name npm-packages-<prepare-run-id> --dir release/npm-setup
pnpm exec node scripts/release/configure-npm-oidc.mjs release/npm-setup
```

脚本校验包的 SHA-512，只为尚不存在的包执行一次初始化发布，并保存已接受的上传记录。它为整个固定包集合建立以下信任配置，同时保留其他 workflow 的现有配置：

| 配置        | 值                                |
| ----------- | --------------------------------- |
| Provider    | GitHub Actions                    |
| Repository  | `YunYouJun/advjs`                 |
| Workflow    | `release-npm.yml`                 |
| Environment | 不设置                            |
| Permissions | `createPackage`、`manageDistTags` |

脚本使用固定版本 npm 的配置读取和交互 2FA 逻辑，通过官方 trust API 配置权限。npm CLI 的 `trust` 参数尚未提供 dist-tag 权限开关，因此不能只使用 `--allow-publish`。

若已有相同配置但缺少权限，脚本会停止并要求维护者检查设置，不会删除已有信任关系。npm 提供可选的 5 分钟免验证窗口，该窗口绑定出口 IP；是否启用由维护者在认证页决定。

新建的信任配置需要在两天内完成首次成功的可信发布，否则会过期。已存在的版本不会重新发布；检查 npm 设置中的配置验证状态，尚未验证的配置需要在有效期内用于新版本发布。

## 发布和验证

初始化完成后，从准备候选包时的同一提交运行 `publish`：

```bash
gh workflow run release-npm.yml --ref dev \
  -f operation=publish \
  -f candidate_run_id=<prepare-run-id>
```

流程按依赖顺序发布到 `rc`，等待 npm 扫描结束并核验公共 tarball。然后从公共仓库、独立缓存和 store 运行指定版本的 `pnpm create adv`，验证游戏和插件模板的安装、检查、构建与游戏预览。验证通过后，OIDC 更新 `latest`，其中 `create-adv` 最后更新；最后重新验证不指定版本的 `pnpm create adv`。

发布权限只授予上传和标签晋升作业；构建和消费者验证作业没有 OIDC 权限。npm 操作使用固定版本的 CLI，标签管理要求 npm 11.21.0 或更高版本。

npm 接受上传后可能需要数分钟扫描，暂时不可安装不代表上传失败。发布作业保存 `npm-publication-<run-id>`，中断后使用其记录恢复，避免再次上传已接受但尚未公开的版本：

```bash
gh workflow run release-npm.yml --ref dev \
  -f operation=publish \
  -f candidate_run_id=<prepare-run-id> \
  -f resume_publication_run_id=<previous-publish-run-id>
```

本流程负责 npm 包发布。包含原生桌面安装包、主分支和 Pages 的完整发布事务仍使用对应的 release workflow。

## 验证

确认 workflow 的公共包校验、指定版本验证、标签晋升和默认版本验证全部成功。报告保存在 `npm-pinned-smoke-<run-id>` 与 `npm-default-smoke-<run-id>`；`npm whoami` 不能验证 OIDC 发布权限。

参考 [npm 可信发布说明](https://docs.npmjs.com/trusted-publishers/)、[npm Registry trust API](https://api-docs.npmjs.com/) 与 [npm 发布时扫描说明](https://github.blog/changelog/2026-07-28-npm-publish-time-malware-scanning-and-dual-use-metadata/)。
