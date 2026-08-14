# ADV.JS 首发 P0 执行清单

> 状态：In progress（仓库级实现与真实 Agent 本地 packed 验收已完成；真实 RC 与正式晋级待执行）
> 目标分支：`dev`
> 上游计划：[ADV.JS 首发能力补齐计划](/about/launch-readiness-plan)
> 适用范围：Platform、Editor、Skills/MCP、Cloudflare Pages 与发布门禁

## 目标

将首发计划中的 P0 能力拆成可以独立领取、评审和验收的小型 PR，最终在干净环境完成：

```text
安装公开包与 Skills
  → Agent/MCP 生成标准项目
  → adv check --json
  → adv editor .
  → adv build --json
  → adv deploy --json
  → 获得可公开游玩的 Cloudflare Pages URL
```

Studio、自动图片生成、视频导出、内容社区和第二部署供应商不在本清单内。

## 执行规则

- 每个实现编号对应一个独立 issue 和一个主 PR，目标分支均为 `dev`；不要直接提交到 `main`。`L6-07`、`L6-08` 是发布操作 issue，只保存外部证据且不得改变已验证源码 tree，因此不创建源代码 PR。
- Codex 创建实现分支时使用 `codex/<issue-id>-<slug>`，例如 `codex/l1-01-clean-packed-build`。
- 一个 PR 只解决一个编号；共享接口先合并，消费者随后 rebase，避免多个 PR 同时修改 CLI 入口、Editor store 或 release workflow。
- 每个 issue 先提交失败测试或固定 fixture，再实现功能；验收命令必须在 PR 描述中原样记录。
- 建议提交信息遵循 Conventional Commits，例如 `fix(build): resolve packed runtime dependencies`。
- `S` 表示单一模块的小改动，`M` 表示跨少量模块，`L` 表示需要独立协议或 E2E；`L` 任务仍不得与相邻任务合并成超大 PR。
- 标记为 required 的检查只有在对应实现完成后才能启用；测试骨架允许先以非阻断状态落地。

## 总览

| ID    | Issue 标题                               | Size | 依赖                                                                        | 建议批次 |
| ----- | ---------------------------------------- | ---- | --------------------------------------------------------------------------- | -------- |
| L0-01 | 固定首发契约、错误码与黄金 fixture       | M    | —                                                                           | W0       |
| L0-02 | 建立干净环境 launch journey 骨架         | M    | L0-01、L6-01                                                                | W1       |
| L1-01 | 修复 packed 项目的生产构建               | M    | L0-01                                                                       | W0       |
| L1-02 | 固定公开包图与 packed-install smoke      | L    | L1-01、L3-01                                                                | W1       |
| L1-03 | 为 init/check/build 提供统一 JSON 输出   | M    | L0-01、L1-01                                                                | W1       |
| L2-01 | 提取浏览器兼容的标准项目编译器           | L    | L0-01                                                                       | W1       |
| L2-02 | 统一 Node 文件加载并迁移 CLI/MCP         | M    | L1-01、L2-01                                                                | W2       |
| L2-03 | 让 Editor 打开标准 Markdown 项目         | L    | L2-01、L3-01                                                                | W2       |
| L2-04 | 建立无损往返编辑合同                     | M    | L2-02、L2-03                                                                | W3       |
| L3-01 | 修复 Editor build/typecheck 基线         | L    | L0-01                                                                       | W0       |
| L3-02 | 将非首发云集成移出 Editor 核心启动链     | M    | L3-01                                                                       | W1       |
| L3-03 | 实现安全的本地 Editor bridge 与 CLI      | L    | L1-02、L1-03、L3-01、L3-02                                                  | W2       |
| L3-04 | 接入 Editor 本地工作区与实时刷新         | L    | L2-03、L3-03                                                                | W3       |
| L3-05 | 补齐 Editor 安全与生命周期 E2E           | M    | L2-04、L3-04                                                                | W4       |
| L4-01 | 统一 Skills 元数据并随 advjs 发布        | M    | L0-01                                                                       | W0       |
| L4-02 | 实现幂等的 Agent/MCP 安装器              | L    | L1-03、L4-01                                                                | W2       |
| L4-03 | 实现 adv doctor 诊断命令                 | M    | L1-02、L1-03                                                                | W2       |
| L4-04 | 建立 Codex/Claude Code/Cursor 安装 smoke | M    | L4-02、L4-03                                                                | W3       |
| L5-01 | 固定部署接口、内容版本与 receipt         | L    | L0-01、L1-01、L1-03                                                         | W1       |
| L5-02 | 实现 Cloudflare Pages Direct Upload      | L    | L1-02、L5-01                                                                | W2       |
| L5-03 | 实现部署验证、重复部署与归档恢复         | L    | L5-02                                                                       | W3       |
| L6-01 | 重建面向 dev 的基础 CI 矩阵              | M    | L0-01                                                                       | W0       |
| L6-02 | 修复 Editor Cloudflare Git 预览构建      | M    | L3-01、L6-01                                                                | W2       |
| L6-03 | 重写并自动执行首发文档 journey           | M    | L1-03、L3-04、L4-02、L5-03                                                  | W4       |
| L6-04 | 实现不可变 RC 与 release manifest 工具   | L    | L1-02、L6-01                                                                | W3       |
| L6-05 | 实现跨 Git/npm/Cloudflare 发布事务       | L    | L5-03、L6-02、L6-04                                                         | W4       |
| L6-06 | 激活 required launch journey 与 RC 门禁  | M    | L0-02、L1-02、L1-03、L2-04、L3-05、L4-04、L5-03、L6-02、L6-03、L6-04、L6-05 | W5       |
| L6-07 | 执行真实 RC 与发布审计                   | M    | L6-06                                                                       | W5       |
| L6-08 | 执行正式晋级与收敛验收                   | M    | L6-07                                                                       | W5       |

## W0：立即启动的基线任务

### L0-01 固定首发契约、错误码与黄金 fixture

**主要落点：**

- Create: `packages/advjs/node/cli/contracts.ts`
- Create: `tests/launch/contracts/`
- Create: `tests/launch/fixtures/golden-request.md`
- Create: `tests/launch/fixtures/golden-project/`
- Create: `tests/unit/cli-contracts.test.ts`

**待办：**

- [x] 将 Node `lts/*`、Ubuntu/macOS/Windows、npm/npx、pnpm/dlx、Chromium、default/galgame、公开包、Skills 与 Agent 客户端固化为机器可读 support matrix fixture。
- [x] 固定 CLI envelope 的 `schemaVersion`、`command`、`ok`、`data`、`warnings`、`errors`。
- [x] 固定 `ADV_USAGE`、`ADV_VALIDATION`、`ADV_BUILD`、`ADV_EDITOR`、`ADV_AUTH`、`ADV_DEPLOY`、`ADV_NETWORK`、`ADV_INTERNAL`。
- [x] 固定 `contentRevision` canonical manifest 算法、关键部署资源和非确定性字段列表。
- [x] 准备一个最小中文生成请求和确定性的标准项目 fixture。
- [x] 为 `init`、`check`、`build`、`editor` 事件流、`agent install`、`doctor`、`deploy` 和 artifact recovery 分别建立成功/失败 JSON Schema；示例必须由 Schema 验证，不作为 Schema 的替代。

**完成标准：**

```bash
pnpm vitest run tests/unit/cli-contracts.test.ts
```

测试必须证明所有命令 Schema 与 support matrix 均可枚举且无遗漏，并证明 key 排序、路径分隔符和文件遍历顺序不会改变 `contentRevision`。

### L1-01 修复 packed 项目的生产构建

**主要落点：**

- Modify: `packages/advjs/package.json`
- Modify: `packages/client/package.json`
- Modify: `packages/advjs/node/virtual/locales.ts`
- Modify: `packages/advjs/node/vite/loaders.ts`
- Create: `tests/launch/packed-build.test.ts`

**待办：**

- [x] 先复现 packed tarball 安装后 `/@advjs/locales` 无法解析 `defu` 的失败。
- [x] 修正运行时依赖归属和虚拟模块解析，禁止依赖 monorepo hoist 偶然成功。
- [x] 首发包的 `engines` 与 Vite 最低运行版本对齐；仓库源码构建与 CI 使用当前 LTS。
- [x] 用 `default`、`galgame` 两个模板分别执行 `init → check → build`。
- [x] 用静态服务器验证 HTML、JS、CSS、构建入口和 SPA fallback。

**完成标准：**

```bash
pnpm vitest run tests/launch/packed-build.test.ts
pnpm build:advjs
```

测试临时目录不得位于仓库内部，也不得读取仓库 `node_modules`。

### L3-01 修复 Editor build/typecheck 基线

**主要落点：**

- Modify: `editor/core/app/stores/flow.ts`
- Modify: `editor/core/nuxt.config.ts`
- Modify: `editor/core/package.json`
- Modify: Editor 报错涉及的 imports、runtime exports 与类型声明
- Create: `tests/unit/editor-build-contract.test.ts`

**待办：**

- [x] 修复当前 `../../constants`、`../flow` 等无法解析的入口。
- [x] 修复 Editor 对 `advjs`、`@advjs/core` 和 GUI 的失效导入或缺失 export。
- [x] 将真实类型问题与纯配置噪音分开处理，不使用全局 `skipLibCheck` 掩盖产品错误。
- [x] 固定 Editor 生产产物目录及启动入口，供 Pages 与 `adv editor` 复用。
- [x] 加入最小构建合同测试，防止产物目录再次漂移。

**完成标准：**

```bash
pnpm --filter @advjs/editor typecheck
pnpm --filter @advjs/editor build
pnpm vitest run tests/unit/editor-build-contract.test.ts
```

### L4-01 统一 Skills 元数据并随 advjs 发布

**主要落点：**

- Modify: `skills/*/SKILL.md`
- Create/Modify: `skills/*/agents/openai.yaml`
- Create: `skills/catalog.json`
- Modify: `skills/README.md`
- Modify: `packages/advjs/package.json`
- Modify: `tests/unit/content-skills.test.ts`

**待办：**

- [x] 将 7 个 Skill 的 frontmatter 收敛到 `name`、`description`。
- [x] 为 6 个公开 Skill 补齐发现元数据；`adv-hamster-demo` 保持仓库专用。
- [x] catalog 明确 default、optional、repository-only 三组及每项 revision/integrity。
- [x] 构建时将公开 Skills 复制进 `advjs` npm tarball，避免首发再增加第四个入口包。
- [x] 验证 tarball 不包含仓库专用 Skill、凭据或 Demo 私有素材。

**完成标准：**

```bash
pnpm vitest run tests/unit/content-skills.test.ts
pnpm -C packages/advjs pack --pack-destination ../../artifacts
```

解包后必须找到默认和可选 Skills 的 catalog、`SKILL.md` 与发现元数据。

### L6-01 重建面向 dev 的基础 CI 矩阵

**主要落点：**

- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/demo.yml`
- Modify: `.github/workflows/docs.yml`
- Modify: `package.json`

**待办：**

- [x] 将 push/PR 主集成目标从仅 `main` 调整为 `dev`，同时保留 `main` 的生产校验。
- [x] 恢复 unit job，Node.js `lts/*` 在 Ubuntu 运行 build、unit、typecheck。
- [x] macOS/Windows 先运行安装、CLI、Editor 启停和 build smoke，不提前承诺完整 E2E。
- [x] 使用 `pnpm install --frozen-lockfile`，统一 workflow 中混用的 npm/pnpm 命令。
- [x] 为 build、unit、typecheck、Editor、packed smoke 预留稳定 job 名称，供 branch protection 引用。

**完成标准：**

- workflow 语法检查通过；
- 针对 `dev` 的测试 PR 能触发全部预期 job；
- 此阶段不得把尚未实现的 launch journey 设为 required。

## W1：合同与基础设施

### L0-02 建立干净环境 launch journey 骨架

**主要落点：**

- Create: `tests/launch/launch-journey.test.ts`
- Create: `tests/launch/helpers/`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**待办：**

- [x] 测试从系统临时目录开始，只接受 packed tarball 或 registry 包路径。
- [x] 编排安装、Agent/MCP 写入、check、Editor、build、deploy 和 URL 验证阶段。
- [x] 尚未实现的阶段以明确的 pending capability 标记，不伪造成功结果。
- [x] 失败时上传命令日志、Editor 日志、项目 diff、构建摘要和浏览器 trace。
- [x] 新增非 required 的 `launch-journey` CI job。

**完成标准：**

```bash
pnpm vitest run tests/launch/launch-journey.test.ts
```

已实现阶段必须执行真实命令；未实现阶段必须在报告中可见，不能静默跳过。

### L1-02 固定公开包图与 packed-install smoke

**主要落点：**

- Modify: `packages/*/package.json`
- Modify: `editor/core/package.json`
- Modify: `pnpm-workspace.yaml`
- Create: `scripts/release/package-manifest.mjs`
- Create: `tests/launch/packed-install.test.ts`

**待办：**

- [x] 固定用户入口 `advjs`、`@advjs/editor`、`@advjs/mcp-server` 及其公开依赖闭包。
- [x] 统一首发包版本策略、workspace dependency 替换和 publishConfig。
- [x] 将当前 private Editor 转为可安装产物，并在 tarball 内提供本地 UI 的确定入口。
- [x] 生成排序后的 package manifest，记录名称、版本、tarball integrity 和发布顺序。
- [x] 将 tarball 发布到隔离的本地测试 registry，在空目录分别真实执行 `npx --yes advjs@<version> --version`、`pnpm dlx advjs@<version> --version`，再安装并启动 Editor artifact 和 MCP Server。

**完成标准：**

```bash
node scripts/release/package-manifest.mjs --pack --json
pnpm vitest run tests/launch/packed-install.test.ts
```

任何 workspace 源码路径泄漏、缺失文件、部分依赖未打包，或 npx/pnpm dlx 未经 registry 解析而直接调用仓库 binary，都视为失败。L6-07 还必须针对真实 `rc` dist-tag 重复相同 npx/pnpm dlx smoke。

### L1-03 为 init/check/build 提供统一 JSON 输出

**主要落点：**

- Modify: `packages/advjs/node/cli/index.ts`
- Modify: `packages/advjs/node/cli/{init,check,build}.ts`
- Modify: `packages/advjs/node/commands/{init,check}.ts`
- Modify: `packages/advjs/node/commands/build/`
- Create: `tests/unit/cli-json-output.test.ts`

**待办：**

- [x] 提供唯一的 stdout JSON writer；`--json` 模式下日志全部进入 stderr 或结构化 warnings。
- [x] 命令业务函数返回数据并抛出带稳定 code 的错误，不在深层直接 `process.exit()`。
- [x] `init` 返回 root、template 和创建文件摘要；`check` 返回 diagnostics；`build` 返回 outDir 和资源摘要。
- [x] 未知参数、验证失败、构建失败和内部异常映射到 L0-01 的错误码。
- [x] 保持默认人类可读输出兼容。

**完成标准：**

```bash
pnpm vitest run tests/unit/cli-json-output.test.ts
```

stdout 每次只能包含一个通过 Schema 的 envelope，退出码与 `ok`/error code 一致。

### L2-01 提取浏览器兼容的标准项目编译器

**主要落点：**

- Create: `packages/core/src/project/`
- Modify: `packages/core/src/index.ts`
- Create: `packages/core/test/project/compile.test.ts`
- Modify: `packages/types/` 中的项目与诊断类型

**待办：**

- [x] 定义只依赖文件内容映射、不访问 Node `fs` 的 `compileProject`。
- [x] 统一配置、章节、角色、场景、插件和资产清单的输入模型。
- [x] 返回 normalized compiled project、排序 diagnostics 和 source map。
- [x] 明确未知字段的保留边界和非确定性字段。
- [x] 覆盖 default/galgame、缺失引用、未知插件和多章节入口。

**完成标准：**

```bash
pnpm vitest run packages/core/test/project/compile.test.ts
pnpm -C packages/core build
```

该模块不得导入 `node:*`，可在浏览器 bundle 中使用。

### L3-02 将非首发云集成移出 Editor 核心启动链

**主要落点：**

- Modify: `editor/core/nuxt.config.ts`
- Modify: `editor/core/app/composables/feishu/`
- Modify: `editor/core/app/stores/useGitHubStore.ts`
- Modify: `editor/core/app/utils/cos/`
- Modify: `editor/core/server/api/`
- Create: `tests/unit/editor-feature-boundaries.test.ts`

**待办：**

- [x] 定义 local、online、optional-integration 三类 capability。
- [x] Feishu、GitHub、COS、登录和统计缺少环境变量时不得导入失败或阻塞启动。
- [x] 通过 lazy import/feature flag 隔离非首发 server route 和浏览器 SDK。
- [x] local 模式默认不发出第三方网络请求。
- [x] UI 对不可用能力显示明确状态，而不是留下失效按钮。

**完成标准：**

```bash
pnpm vitest run tests/unit/editor-feature-boundaries.test.ts
pnpm --filter @advjs/editor build
```

在空环境变量下构建、启动 Editor，网络记录中不得出现 Feishu、GitHub、COS 或分析服务请求。

### L5-01 固定部署接口、内容版本与 receipt

**主要落点：**

- Create: `packages/advjs/node/deploy/`
- Create: `packages/advjs/node/cli/deploy.ts`
- Modify: `packages/advjs/node/cli/index.ts`
- Create: `tests/unit/deploy-contracts.test.ts`

**待办：**

- [x] 定义 provider-neutral adapter、deploy result 和 provider error 映射。
- [x] `adv deploy` 普通模式必须依次执行 `adv check` 与全新 `adv build`，任一步失败立即停止且不得读取或上传既有 `dist/`；构建失败返回 `ADV_BUILD`。
- [x] 只有显式 `--artifact` 恢复模式允许跳过 check/build，并改为校验 archive 与 artifact receipt。
- [x] 实现 canonical manifest 与 `contentRevision`，复用 L0-01 合同。
- [x] 定义不含凭据的 `.advjs/deploy.json`。
- [x] 生成不可变 archive、artifact receipt 和追加式 deployment receipt。
- [x] 实现 `safeDeploymentId` 的无歧义文件名编码和冲突测试。

**完成标准：**

```bash
pnpm vitest run tests/unit/deploy-contracts.test.ts
```

同一内容重复归档得到相同 `contentRevision` 和 archive hash；deployment receipt 不互相覆盖。测试还必须预置一份陈旧 `dist/`，证明 check/build 失败时 provider adapter 从未被调用。

## W2：核心集成

### L2-02 统一 Node 文件加载并迁移 CLI/MCP

**主要落点：**

- Create/Modify: `packages/advjs/node/project/`
- Modify: `packages/advjs/node/runtime/project.ts`
- Modify: `packages/advjs/node/commands/{check,context}.ts`
- Modify: `packages/advjs/node/commands/build/`
- Modify: `packages/mcp-server/src/index.ts`
- Modify: `tests/unit/runtime-project-loader.test.ts`

**待办：**

- [x] 实现安全、排序稳定的 Node filesystem adapter。
- [x] 统一识别项目根、`adv.config.*`、Markdown 章节、角色和场景。
- [x] 让 check/build/context/MCP 读取同一 `loadProject → compileProject` 结果。
- [x] 保留现有 CLI 行为所需的显式兼容层，不让旧 JSON 成为默认路径。
- [x] 相同 fixture 在 CLI/MCP 得到相同 diagnostics 与 compiled project。

**完成标准：**

```bash
pnpm vitest run tests/unit/runtime-project-loader.test.ts tests/unit/check-runtime.test.ts tests/unit/mcp-resources.test.ts
```

### L2-03 让 Editor 打开标准 Markdown 项目

**主要落点：**

- Modify: `editor/core/app/stores/useProjectStore.ts`
- Modify: `editor/core/app/stores/useFileStore.ts`
- Modify: `editor/core/app/components/panel/AEOpenProject.vue`
- Modify: `editor/core/app/templates/`
- Create: `tests/unit/editor-project-adapter.test.ts`

**待办：**

- [x] 删除主链对 `adv/index.adv.json` 的强制要求。
- [x] 将 File System Access API 读到的文件映射交给 `compileProject`。
- [x] 展示章节、角色、场景与 diagnostics，并用 compiled project 驱动试玩。
- [x] default/galgame 模板均能直接打开。
- [x] 旧 JSON 只显示明确迁移提示；完整兼容适配器留到 P1。

**完成标准：**

```bash
pnpm vitest run tests/unit/editor-project-adapter.test.ts
```

### L3-03 实现安全的本地 Editor bridge 与 CLI

**主要落点：**

- Create: `packages/advjs/node/cli/editor.ts`
- Create: `packages/advjs/node/editor/`
- Modify: `packages/advjs/node/cli/index.ts`
- Modify: `packages/advjs/package.json`
- Create: `tests/unit/editor-bridge.test.ts`

**待办：**

- [x] 实现 `adv editor [root]` 和 `--no-open --host --port --json`。
- [x] 从安装的 `@advjs/editor` artifact 提供 UI，不引用 monorepo 源码。
- [x] bridge 只允许访问启动时固定的 realpath 项目根。
- [x] 文件 API 使用显式相对路径；命令 API 只允许 check/build allowlist。
- [x] JSON 模式输出 `ready`、`stopped` 事件；错误统一为 `ADV_EDITOR`。
- [x] SIGINT/SIGTERM 后关闭 watcher、server 和子进程。

**完成标准：**

```bash
pnpm vitest run tests/unit/editor-bridge.test.ts
```

测试覆盖路径穿越、越界符号链接、非本机 origin、端口占用、命令注入和重复启停。

### L4-02 实现幂等的 Agent/MCP 安装器

**主要落点：**

- Create: `packages/advjs/node/agent/`
- Create: `packages/advjs/node/cli/agent.ts`
- Modify: `packages/advjs/node/cli/index.ts`
- Create: `tests/unit/agent-install.test.ts`

**待办：**

- [x] 实现 `adv agent install --client <client> --skills default --mcp --json`。
- [x] 从当前 `advjs` 包内 catalog 解析 Skill revision/integrity。
- [x] 为 Codex、Claude Code、Cursor 建立显式配置 adapter。
- [x] dry-run 输出目标路径和结构化 diff；正式写入使用原子替换和备份。
- [x] 重复执行幂等，不覆盖无关用户配置；测试只使用 fake home。

**完成标准：**

```bash
pnpm vitest run tests/unit/agent-install.test.ts
```

### L4-03 实现 adv doctor 诊断命令

**主要落点：**

- Create: `packages/advjs/node/cli/doctor.ts`
- Create: `packages/advjs/node/commands/doctor.ts`
- Modify: `packages/advjs/node/cli/index.ts`
- Create: `tests/unit/doctor.test.ts`

**待办：**

- [x] 检查 Node 版本、CLI 包、项目根、写权限、端口和 Editor artifact。
- [x] 启动 MCP Server 并完成 initialize/resource read 的短生命周期 handshake。
- [x] 检查已安装 Skills 的 revision/integrity 和目标 Agent 配置。
- [x] 检查 Cloudflare/Wrangler 和可选图片/音频等生成工具的可用性；未安装或没有登录时只报告可操作诊断，不把可选工具误判为核心失败。
- [x] `--json` 使用统一 envelope 和固定错误码。

**完成标准：**

```bash
pnpm vitest run tests/unit/doctor.test.ts
```

### L5-02 实现 Cloudflare Pages Direct Upload

**主要落点：**

- Create: `packages/advjs/node/deploy/cloudflare.ts`
- Modify: `packages/advjs/package.json`
- Modify: `packages/advjs/node/cli/deploy.ts`
- Create: `tests/unit/deploy-cloudflare.test.ts`

**待办：**

- [x] 首发固定使用版本锁定的 Wrangler CLI，复用其 OAuth 和 Pages API，不自行实现 Cloudflare OAuth。
- [x] 从 `advjs` 依赖解析 Wrangler binary，禁止在运行时调用未锁版本的 `npx ...@latest`。
- [x] 多账号时要求显式选择 account，不静默使用列表第一项。
- [x] 支持首次登录、创建 Pages project、后续复用和 Direct Upload。
- [x] 将 Wrangler 失败稳定映射为 `ADV_AUTH`、`ADV_NETWORK`、`ADV_DEPLOY`。
- [x] unit test 使用 fake Wrangler executable，不访问真实账号。

**完成标准：**

```bash
pnpm vitest run tests/unit/deploy-cloudflare.test.ts
```

受保护的集成 CI 另用最小测试账号完成一次真实 Pages 部署，不复用 ADV.JS 官方站点项目。

### L6-02 修复 Editor Cloudflare Git 预览构建

**主要落点：**

- Modify: Editor 构建相关文件
- Modify: `.github/workflows/ci.yml`
- Modify: `docs/about/launch-readiness-plan.md` 中的审计状态
- External config: Cloudflare Pages project `advjs`

**待办：**

- [x] 复现 `npm run editor:build`、`editor/core/dist` 的 Pages 环境合同。
- [ ] 修复 `dev` 最新预览构建失败原因。
- [ ] 保持 production branch 为 `main`，preview branches 包含 `dev` 和 feature PR。
- [x] 将 Pages 的 Node/pnpm 版本、build command、output dir 记录进文档和 CI。
- [ ] 验证 preview URL、PR check 和 `editor.advjs.org` 旧生产不受影响。

**完成标准：**

- `dev` 精确 commit 的 Cloudflare preview deployment 成功；
- 仓库 CI 中相同命令成功；
- 未合并 `main` 前不改变 Editor 正式站内容。

## W3：闭环能力

### L2-04 建立无损往返编辑合同

**主要落点：**

- Create: `packages/core/src/project/serialize.ts`
- Modify: Editor 文件保存逻辑
- Create: `tests/unit/project-roundtrip.test.ts`

**待办：**

- [x] 编辑已知字段时保留未知 frontmatter、未识别配置和无关 Markdown。
- [x] 明确哪些操作使用结构化 patch，哪些操作只允许原文编辑。
- [x] fixture 保存后的 diff 与 SHA-256 固定。
- [x] 保存后重新 compile 并通过 `adv check`。
- [x] CLI 与 Editor 的 normalized compiled project 深度相等。

**完成标准：**

```bash
pnpm vitest run tests/unit/project-roundtrip.test.ts
```

### L3-04 接入 Editor 本地工作区与实时刷新

**主要落点：**

- Create: `editor/core/app/adapters/local/`
- Modify: `editor/core/app/stores/useProjectStore.ts`
- Modify: `editor/core/app/stores/useFileStore.ts`
- Modify: `editor/core/app/components/scene/AdvGamePreview.vue`
- Create: `tests/e2e/editor-local.spec.ts`

**待办：**

- [x] Editor 根据启动 capability 选择 browser FS 或 local bridge adapter。
- [x] 本地模式打开章节、角色和场景并保存。
- [x] bridge watcher 检测 Agent 外部写入，去抖后重新 compile 和刷新试玩。
- [x] 外部变更与未保存编辑冲突时提示，不静默覆盖。
- [x] 试玩直接使用当前源文件，不要求先 build。

**完成标准：**

```bash
pnpm exec playwright test tests/e2e/editor-local.spec.ts
```

### L4-04 建立 Codex/Claude Code/Cursor 安装 smoke

**主要落点：**

- Create: `tests/launch/agent-install-smoke.test.ts`
- Create: `tests/fixtures/agent-configs/`
- Modify: `.github/workflows/ci.yml`
- Modify: `docs/ai/mcp.md`

**待办：**

- [x] 从 packed `advjs`、`@advjs/mcp-server` 安装，不读取根目录 Skills。
- [x] 三个客户端分别验证 Skill 可发现、MCP 可启动、配置不覆盖已有字段。
- [x] 至少一个支持的 Agent 执行固定一句话请求，并通过 MCP 创建最小项目。2026-08-12 已用 Codex CLI 0.147.0、packed `advjs@0.1.2`、packed `@advjs/mcp-server@0.1.2` 与 `adv-create@0.1.2` 在隔离环境完成：固定一句话生成 1 个角色、1 个场景、1 个章节，`adv_validate` 与独立 `adv check --json` 均通过。L6-07 仍须针对真实 `rc` dist-tag 重复并将证据保存为不可变 workflow artifact。
- [x] 最终以 `adv_validate` 和 `adv check --json` 判断确定性成功。
- [x] 保存精确包版本、Skill revision 和客户端版本。

**完成标准：**

```bash
pnpm vitest run tests/launch/agent-install-smoke.test.ts
```

### L5-03 实现部署验证、重复部署与归档恢复

**主要落点：**

- Modify: `packages/advjs/node/deploy/`
- Create: `tests/launch/cloudflare-deploy.test.ts`
- Modify: `.gitignore`

**待办：**

- [x] 部署后验证入口、引用资源、MIME 和 SPA fallback。
- [x] 同一项目连续部署复用 project ID，并产生不同 deployment receipt。
- [x] 实现 `adv deploy --artifact <archive> --receipt <receipt> --json`。
- [x] 恢复模式校验 archive/manifest hash，跳过重新 build。
- [x] 对 stdout、stderr、项目文件、构建产物和 CI artifact 做 token 泄漏扫描。

**完成标准：**

```bash
pnpm vitest run tests/launch/cloudflare-deploy.test.ts
```

真实集成测试返回 HTTPS URL，并能从复制到空目录的 archive/receipt 恢复部署。

### L6-04 实现不可变 RC 与 release manifest 工具

**主要落点：**

- Create: `scripts/release/create-manifest.mjs`
- Create: `scripts/release/verify-manifest.mjs`
- Create: `.github/workflows/release-candidate.yml`
- Modify: `.github/workflows/release.yml`
- Create: `tests/unit/release-manifest.test.ts`
- Create: `tests/unit/release-workflow-contract.test.ts`
- Create: `scripts/release/changelog.mjs`

**待办：**

- [x] 工具从给定的 `dev` 精确 SHA 构建所有公开 tarball 一次，不在本 issue 中冻结真实 `dev` 或发布正式 RC。
- [x] manifest 记录旧 `main` SHA/tree hash、目标 source SHA/tree hash、包版本/integrity、旧/新 dist-tag 和旧/目标 Pages production deployment。
- [x] 生成基于 Git 历史的 changelog、完整包清单和已知限制引用，并纳入 manifest integrity。
- [x] workflow 支持 dry-run/local registry 测试；真实 `rc` dist-tag 发布和第二环境 registry smoke 由 L6-07 执行。
- [x] 删除 `.github/workflows/release.yml` 中不存在的 `npm run ci:publish`，并用测试逐项验证 workflow 引用的本地 script 全部存在。
- [x] 同一 manifest 可幂等重跑，已正确发布的包不重复上传。

**完成标准：**

```bash
pnpm vitest run tests/unit/release-manifest.test.ts
pnpm vitest run tests/unit/release-workflow-contract.test.ts
node scripts/release/verify-manifest.mjs <manifest> --local-registry
```

验收不得修改真实 npm dist-tag、`main` ref 或 Cloudflare production deployment。

## W4：发布门禁

### L3-05 补齐 Editor 安全与生命周期 E2E

**主要落点：**

- Extend: `tests/e2e/editor-local.spec.ts`
- Create: `tests/e2e/editor-security.spec.ts`
- Modify: `.github/workflows/ci.yml`

**待办：**

- [x] 覆盖非法 root、路径穿越、越界 symlink、非本机 origin 和命令注入。
- [x] 覆盖解析失败、保存失败、端口占用的 JSON 错误。
- [x] 覆盖 SIGINT/SIGTERM 后端口立即复用、无遗留子进程。
- [x] 断言项目目录只新增文档声明的 `.advjs/` 状态。
- [x] 将 Chromium Editor E2E 加入 required 候选 job。

**完成标准：**

```bash
pnpm exec playwright test tests/e2e/editor-local.spec.ts tests/e2e/editor-security.spec.ts
```

### L6-03 重写并自动执行首发文档 journey

**主要落点：**

- Modify: `README.md`
- Modify: `docs/guide/index.md`
- Modify: `docs/guide/quick-start.md`
- Modify: `docs/guide/editor/`
- Modify: `docs/ai/mcp.md`
- Modify: `docs/ai/skills/`
- Create: `tests/launch/docs-journey.test.ts`

**待办：**

- [x] 移除 WIP、“尚未发布”、旧 JSON 默认入口和失效安装命令。
- [x] 写出从安装、Agent 生成、Editor 精修到 Cloudflare URL 的单一路径。
- [x] 标明 local Editor 首发浏览器/OS 范围和 Studio/P1 限制。
- [x] 文档命令块由测试提取并在 packed 环境执行。
- [x] 示例输出使用真实 JSON Schema，不手写过期结果。

**完成标准：**

```bash
pnpm docs:check
pnpm docs:build
pnpm vitest run tests/launch/docs-journey.test.ts
```

### L6-05 实现跨 Git/npm/Cloudflare 发布事务

**主要落点：**

- Create: `scripts/release/promote.mjs`
- Create: `scripts/release/abort.mjs`
- Modify: `.github/workflows/release.yml`
- Create: `tests/unit/release-transaction.test.ts`
- External config: GitHub `dev`/`main` branch protection 与 release environment

**待办：**

- [x] 使用 GitHub Actions concurrency/environment 建立唯一发布锁和人工批准点。
- [ ] 配置并自动核查 `main` branch protection：禁止人类直接 push；正常路径只允许受控 fast-forward，回滚路径只允许发布机器人按 CAS 恢复 manifest 旧 SHA。
- [x] 按 manifest CAS 校验当前 `main`、npm dist-tag 和 Pages production deployment。
- [x] 顺序执行 `main` fast-forward、Pages 生产验证、正式 dist-tag 提升、tag/release。
- [x] 任一步骤失败时禁止公告；支持同一 RC 幂等续跑。
- [x] 在正式 tag 与 GitHub release 均尚未创建时，中止可以恢复 npm dist-tag、Cloudflare deployment，并由受控机器人把 `main` ref 恢复到旧 SHA。
- [x] 正式 tag 或 GitHub release 任一已经可见即越过不可逆点：`abort` 必须拒绝回滚 `main`、npm 和 Cloudflare，只允许保持发布锁并幂等收敛到同一 RC。
- [x] 非快进恢复必须验证当前 `main` 仍是本次 RC SHA，并保留不可变事务日志。
- [x] promotion 的人工批准输入必须引用 L6-07 生成的浏览器试玩证据和签署人；证据缺失时拒绝执行。

**完成标准：**

```bash
pnpm vitest run tests/unit/release-transaction.test.ts
node scripts/release/promote.mjs <manifest> --dry-run
```

故障注入至少覆盖 Pages 失败、npm 部分提升失败，以及“正式 tag 已创建但 GitHub release 创建失败”。前两者在不可逆点前可整体恢复；最后一种必须证明没有执行任何回滚，并可续跑完成同一 RC。整体恢复后下一次 `dev → main` 仍可 fast-forward。

本 issue 只交付和验证 promotion/abort 工具，不执行真实 `main`、npm 正式 dist-tag 或 Pages production 变更；真实 promotion 必须等待 L6-07 的 RC 与人工证据。

## W5：首发激活

### L6-06 激活 required launch journey 与 RC 门禁

**主要落点：**

- Modify: `tests/launch/launch-journey.test.ts`
- Modify: `.github/workflows/ci.yml`
- Create: `docs/about/launch-known-limitations.md`

**待办：**

- [x] 移除所有仓库级 pending capability，让 launch journey 完成 packed install、Editor 浏览器编辑/保存/试玩、build 与部署适配器闭环；真实 Agent 模型和 Cloudflare Preview 仍由 L6-07 验收。
- [x] Ubuntu 执行完整路径；macOS/Windows 完成约定 smoke。
- [x] 将 launch journey、Editor build/typecheck/E2E、packed install 汇总为稳定的 `launch-required` 门禁，供 `dev`/release branch protection 引用。
- [x] 在源码中固定首发已知限制和人工试玩清单，使二者进入待验证 RC tree。
- [ ] 合并本 PR 后，在 `dev` 精确 commit 上运行全部实现级 required checks。
- [x] 本任务不得发布真实 RC、冻结 `dev`，也不得预先声称 Ready for Promotion。

**完成标准：**

```bash
pnpm vitest run tests/launch
pnpm docs:check
pnpm docs:build
```

本 PR 合入 `dev` 后必须保持 tree 不变进入 L6-07；发布状态通过外部 release manifest/事务记录推进，不在 RC 验证后回写源码。

### L6-07 执行真实 RC 与发布审计

**源码改动：** 无。证据保存到不可变 workflow artifact、release manifest 和发布操作 issue。

**待办：**

- [ ] 确认 L6-06 合入后的 `dev` required checks 全绿，获取发布事务锁并冻结该精确 SHA。
- [ ] 调用 L6-04 工具，以选定的最终 `X.Y.Z` 向真实 registry 的 `rc` dist-tag 发布一次不可变包集。
- [ ] 在第二个干净环境真实执行 `npx --yes advjs@X.Y.Z --version` 与 `pnpm dlx advjs@X.Y.Z --version`，随后运行完整 launch journey 和 Cloudflare 测试项目部署。
- [ ] 由指定人工验收者在 RC Preview URL 完成生成、编辑、保存、试玩、构建和部署检查。
- [ ] 签署证据必须包含验收者、时间、RC SHA、包 integrity、Skill revision、项目 diff、contentRevision、deployment ID、试玩 URL 和场景清单。
- [ ] 核对 manifest 中的 changelog、包清单和已知限制，将外部事务状态标记为 `ready_for_promotion`。

**完成标准：**

```bash
node scripts/release/verify-manifest.mjs <manifest> --registry
```

若真实 RC 失败，在未改变 `main`、正式 dist-tag 和 Pages production 的前提下解除冻结，回到 `dev` 修复并使用新的最终版本重新执行 L6-06、L6-07。不得为记录失败结果而修改已验证 RC tree。

### L6-08 执行正式晋级与收敛验收

**源码改动：** 无。该操作 issue 是正式上线的终态 owner。

**待办：**

- [ ] 人工批准必须引用 L6-07 的签署证据和不可变 release manifest。
- [ ] 执行 L6-05 promotion workflow：将 `main` fast-forward 到 RC SHA，验证 Cloudflare production，提升同一包集到正式 dist-tag，创建正式 tag/release。
- [ ] 核对 `main`、正式 tag、npm integrity、Pages production deployment 与 manifest 完全一致。
- [ ] 若失败，保持发布锁并按 L6-05 规则处理：不可逆点前可以幂等续跑或整体恢复；正式 tag/release 任一可见后只能收敛同一 RC，禁止回滚；未收敛前禁止公告。
- [ ] 全部收敛后解除发布锁，发布正式公告并关闭首发 P0 milestone。

**完成标准：**

- `main` 与正式 tag 指向 RC SHA；
- 正式 dist-tag 与 RC dist-tag 的包版本/integrity 一致；
- `editor.advjs.org` 返回成功并对应 manifest 的 production deployment；
- GitHub release 附带 changelog、包清单、已知限制和人工试玩证据；
- 不可变 candidate manifest 保持 `candidate`，其哈希链事务日志的最终状态为 `released`。

## 依赖说明

总览表中的“依赖”列是唯一执行依据。CI 应解析该表或等价的机器可读清单检查缺失 ID 与循环依赖，不再维护第二套手写依赖图。

## 推荐执行顺序

如果只有一个执行者，按以下关键路径推进：

1. `L0-01 → L6-01 → L0-02 → L1-01 → L1-03 → L2-01 → L2-02`；
2. `L3-01 → L1-02 → L2-03 → L2-04 → L3-02 → L3-03 → L3-04 → L3-05`；
3. `L4-01 → L4-02 → L4-03 → L4-04`；
4. `L5-01 → L5-02 → L5-03`；
5. `L6-02 → L6-04 → L6-05 → L6-03 → L6-06 → L6-07 → L6-08`。

如果可以并行，先完成 W0-A 的 `L0-01`；契约合并后，再并行启动 W0-B 的 `L1-01`、`L3-01`、`L4-01` 和 `L6-01`。W1 起严格遵循总览中的依赖，避免并行修改同一热点入口。

## 首批可领取任务

建议第一批分两阶段执行：

1. W0-A 只执行 `L0-01`，固定所有后续任务依赖的完整契约；
2. W0-A 合并后，并行执行 `L1-01`（干净构建）、`L3-01`（Editor 基线）、`L4-01`（Skills 发布物）和 `L6-01`（`dev` CI）。

`L6-01` 先建立非 required job，待各能力完成后再逐项升级为 required。
