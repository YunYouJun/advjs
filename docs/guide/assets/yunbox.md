# 用 YunBox 管理源素材

用 Git 协作的 ADV.JS 游戏项目，可以用 [云匣 YunBox](https://yunbox.yunle.fun/) 把立绘、BGM 母带、PSD 等二进制源文件交给 Git LFS，存进自己的腾讯云 COS。协作者 clone 仓库就能拿到素材，旧版本可以随时恢复。YunBox 是可选的周边工具，ADV.JS 的构建、运行时和 CLI 都不依赖它；不使用它，[资源目录协议](./catalog)和 [COS 素材发布规范](./cos)照常适用。

## 适用范围

适合以下项目：

- 游戏项目托管在 GitHub 等 Git 平台，`adv/assets/` 中有需要保留历史的二进制源文件；
- 团队已经在用腾讯云 COS，希望每个协作者只拿到项目前缀的读写权限。

以下场景不使用 YunBox：

- **Studio 托管项目**：Studio 不经过 Git，素材由 `advjsAssets` 云函数托管，见 [COS 素材发布规范](./cos)；
- **ADV.JS 引擎仓库**：仓库里没有需要 LFS 托管的大文件，贡献引擎代码不需要安装 YunBox；
- **多人同时修改同一个素材**：直连模式没有文件锁，PSD 等文件无法合并。同一个素材同一时间只由一个人编辑，提交前在团队里说一声。

## 与资源目录的分工

YunBox 管理“源文件的版本”，资源目录管理“运行时如何找到素材”，两者通过文件路径衔接，不重复登记。每条路径只交给一种方式管理：

| 内容     | 示例                                         | 管理方式                                          | 进入 Git |
| -------- | -------------------------------------------- | ------------------------------------------------- | -------- |
| 源素材   | `adv/assets/` 下需要保留历史的 PNG、WAV、PSD | YunBox（Git LFS）                                 | LFS 指针 |
| 作者缓存 | `.advjs/originals/`、按清单下载的预览        | [`adv assets pull`](./catalog#从远端还原本地缓存) | 忽略     |
| 公共发布 | `games/{game-id}/v{major}/`                  | `adv/cos-release.json` 与 `@advjs/plugin-cos`     | 否       |
| 资源目录 | `adv/assets.json`、`adv/assets/*.json`       | 人工、Studio 或工具                               | 普通文件 |

- 要用 YunBox 保留历史的文件不要写进 `.gitignore`，否则不会被提交；
- 声明了 `download.source`、由 `adv assets pull` 下载的文件继续加入 `.gitignore`，包括下载到 `adv/assets/` 下的预览。不要再把它们提交到 LFS，否则同一份素材存在两处，更新一处后另一处的哈希就会过期；
- YunBox 按扩展名生成 LFS 规则，只匹配图片、设计源文件、模型、音频、视频、字体和压缩包，`adv/assets.json` 与分片 JSON 仍是普通 Git 文件。

::: tip 只让 `adv/assets/` 走 LFS
首次运行 `git yunbox init` 时，它按扩展名写入作用于整个仓库的规则，例如 `public/` 下的图标也会走 LFS。只想托管 `adv/assets/` 时，在提交前把生成的规则改成带路径的形式，例如 `adv/assets/**/*.png filter=lfs diff=lfs merge=lfs -text`。之后不要再带 `--types` 运行 `git yunbox init`，否则它会补回不带路径的规则。
:::

## 选择存储位置

源素材应放在私有 bucket 中，而游戏生产发布的 `games/` 前缀对外开放 GET/HEAD。推荐为源素材单独建一个私有 bucket。

必须共用一个 bucket 时：

- 公共读权限只授予 `games/` 前缀，不要设置整个 bucket 公共读；
- YunBox 的目录前缀（默认 `yunbox/<owner>/<repo>`）不要落在 `games/`、`staging/` 或 `private/` 下。

YunBox 给每个协作者创建独立的 CAM 子账号，只授权项目前缀的 `PutObject`、`GetObject`、`HeadObject`。不要把发布用的 COS 密钥借给 YunBox，两者的环境变量名也不同：YunBox 读取 `TENCENTCLOUD_SECRETID`、`TENCENTCLOUD_SECRETKEY`，`@advjs/plugin-cos` 读取 `TENCENT_COS_SECRET_ID`、`TENCENT_COS_SECRET_KEY`。

## 接入游戏项目

YunBox 需要 Node.js 22.18+、Git 2.30+ 和 git-lfs 3.2+，比 ADV.JS 的 Node.js 要求更高。git-lfs 不允许仓库指定传输程序，所以每个协作者和 CI 都需要安装 YunBox 命令行：

```bash
npm install -g yunbox
```

管理员第一次接入时，在游戏项目根目录运行：

1. 用腾讯云管理员身份登录，临时密钥约 2 小时有效：

   ```bash
   tccli auth login
   ```

2. 选择或新建私有 bucket、填写目录前缀，并生成 LFS 规则。`--types` 去掉了压缩包，按需增减：

   ```bash
   git yunbox init --types texture,source,model,audio,video,font
   ```

3. 提交共享配置。`.yunbox/config` 只记录 bucket、地域和前缀，不含密钥：

   ```bash
   git add .gitattributes .yunbox/config
   git commit -m "chore: 用 YunBox 托管源素材"
   git push
   ```

4. 给自己换一把只能访问这个前缀的长期子账号密钥：

   ```bash
   yunbox subaccount create --save
   ```

接入前已经作为普通文件提交的素材不会自动改存为 LFS，`git status` 可能显示它们被修改。确认后用 `git add --renormalize <路径>` 暂存并提交，从下一次提交起改存为 LFS 指针，历史提交不变。

协作者拿到管理员转交的子账号密钥后运行：

```bash
yunbox login
git yunbox clone <仓库地址>
```

已经 clone 过的仓库，在仓库目录里运行 `git yunbox init && git lfs pull`。之后照常使用 `git add`、`git commit`、`git push`、`git pull`。开子账号、离职回收等操作见 [YunBox 快速开始](https://yunbox.yunle.fun/guide/)。

## 组合使用资源目录

YunBox 负责把源文件送到每个人的工作区，资源目录负责确认拿到的正是清单登记的版本。Git LFS 的对象 ID 就是文件内容的 SHA-256，与资源条目的 `sha256` 是同一个值，所以同一份素材在两边的身份一致，不需要额外映射。

1. 素材文件放在 `adv/assets/` 下，用 YunBox 提交；
2. 对应的资源条目只写 `path`、`sha256` 和 `bytes`，不写 `objectKey`，资源目录也不需要 `download.source`：

   ```json
   {
     "id": "background/opening",
     "kind": "background",
     "type": "image",
     "path": "backgrounds/opening.webp",
     "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
     "bytes": 245760
   }
   ```

3. clone 或拉取后运行 `adv assets verify`，确认素材齐全且与清单一致。这一步只读本地文件，不需要存储插件或 COS 凭据；
4. 体积大、平时用不到的原图可以继续声明为 `original` variant，用 `adv assets pull --variant original` 按需下载到被忽略的缓存目录。

`adv assets` 能识别还没下载的 LFS 指针文件：

- `adv assets status` 把它们标为 `lfs-pointer` 并单独计数，退出码仍为 0；
- `adv assets verify` 和 `adv assets pull` 返回失败，提示先运行 `git lfs pull`。`pull` 不会覆盖指针文件，也不会代替 Git LFS 下载它们；
- 文件已经下载但报告为 `corrupt` 时，说明素材和清单登记的版本不一致。更新素材后，同步更新条目的 `sha256` 和 `bytes`。

## 在 CI 中构建

CI 从 Git 构建游戏时，LFS 素材需要先拉取，否则构建读到的是指针文件。给 CI 建一个只读子账号（`yunbox subaccount create <名称> --show-key --read-only`），把密钥存进 CI 的机密变量，在构建前拉取：

```yaml
- uses: actions/checkout@v7
- uses: actions/setup-node@v7
  with:
    node-version: 22
- run: npm install -g yunbox
- run: git yunbox init --read-only && git lfs pull
  env:
    TENCENTCLOUD_SECRETID: ${{ secrets.YUNBOX_SECRET_ID }}
    TENCENTCLOUD_SECRETKEY: ${{ secrets.YUNBOX_SECRET_KEY }}
```

`actions/checkout` 保持默认的 `lfs: false`，素材由 YunBox 的传输代理下载。之后运行 `adv assets verify`，有素材没下载或与清单不一致时，构建会在这里失败。资源目录中还有需要还原的缓存时，改为运行 `adv assets pull`。发布到公共前缀的步骤继续使用单独的发布凭据。

## 验证

```bash
yunbox doctor        # 检查 git-lfs、传输代理、密钥和前缀读写权限
git lfs ls-files     # 列出由 LFS 托管的素材
adv assets verify    # 资源目录登记的基础条目齐全并通过校验
```

只有拉取权限的协作者和 CI 使用 `yunbox doctor --read-only`。

常见问题：

- **游戏里图片或音频加载失败，文件只有一百多字节**：文件是还没下载的 LFS 指针，内容以 `version https://git-lfs.github.com/spec/v1` 开头。运行 `git yunbox init && git lfs pull`；`adv assets status` 会把资源目录登记过的这类文件标为 `lfs-pointer`。
- **推送时提示没有权限**：运行 `yunbox doctor` 查看密钥和前缀权限，按输出的修复命令处理，或请管理员检查子账号授权。
