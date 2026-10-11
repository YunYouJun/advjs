# Studio 音频执行服务

Studio 可以连接本机的 Node 服务，用现有 Qwen 插件生成音色和对白，并下载经过校验的原生媒体回执。服务复用 Editor、CLI 的供应商注册表和共享任务协议；项目中的对白、角色、词典和音频账本仍是作者数据。本地生成、COS 发布和 JSON Flow 播放不需要 CFS。远程托管是可选部署方式，另需真实身份校验和项目授权。

## 连接本地 Qwen

在同一台 Apple Silicon Mac 上运行 Studio 和音频服务。Studio 本地音频页提供「连接本地音频服务」，不要求 CloudBase 登录。当前项目 ID 显示在连接表单内；先把该 ID 与独立的本机项目目录登记到可信服务配置，再输入本地服务地址和配对凭据。项目根目录、Qwen 预设、模型路径与 COS 凭证只由本机配置决定，不能通过表单上传。

本地服务使用 `createLocalVoiceServiceOptions()`：固定监听 `127.0.0.1`，只接受精确的 loopback Origin，为登记项目使用稳定的 `local-device` 作者身份。配对凭据必须是 32 字节随机十六进制值，有效期最多 24 小时；到期后请求和新的任务执行均被拒绝。配对、刷新、重新连接只读取状态，生成仍须审核并显式执行。

先在项目外创建私有凭据文件，下面的命令不输出凭据，首次使用才创建文件：

```bash
node --input-type=module <<'JS'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

const directory = join(homedir(), 'Library/Application Support/ADV.JS/local-audio')
await mkdir(directory, { recursive: true, mode: 0o700 })
await writeFile(join(directory, 'session.json'), JSON.stringify({
  accessToken: randomBytes(32).toString('hex'),
  expiresAt: new Date(Date.now() + 8 * 60 * 60_000).toISOString(),
}), { mode: 0o600, flag: 'wx' })
JS
```

在同一私有目录创建 `audio-server.config.mjs`。替换项目 ID、项目根和预设路径，Origin 使用实际本地 Studio 的地址与端口；先按[作者语音指南](/guide/authoring-voice)完成 `adv voice setup`、`adv voice doctor` 与固定模型准备。下面使用已存在的 VoiceDesign／Base 预设，不创建或更换模型：

```js
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createQwenTtsProvider } from '@advjs/plugin-qwen-tts'
import { createLocalVoiceServiceOptions } from 'advjs/node'

const directory = join(homedir(), 'Library/Application Support/ADV.JS/local-audio')
const pairing = JSON.parse(await readFile(join(directory, 'session.json'), 'utf8'))

export default createLocalVoiceServiceOptions({
  ...pairing,
  port: 3389,
  stateDirectory: join(directory, 'state'),
  allowedOrigins: ['http://localhost:5173'],
  projects: [{
    projectId: 'replace-with-the-studio-project-id',
    root: '/absolute/path/to/registered-project',
    config: {
      authoring: {
        voice: {
          providers: [createQwenTtsProvider()],
          defaultProvider: 'qwen-tts',
          presets: {
            design: 'authoring/voices/operator-design.json',
            base: 'authoring/voices/operator-base.json',
          },
          presetProviders: { design: 'qwen-tts', base: 'qwen-tts' },
          defaultPreset: 'design',
          assetManifest: 'adv/assets.json',
        },
      },
    },
  }],
})
```

使用下方同一个 `adv-audio-server` 命令启动配置。将私有文件中的 `accessToken` 填入 Studio 配对框；不要放进 `VITE_` 环境变量、项目文件或公开日志。验证服务能力后表单清空凭据，客户端仅在当前页面内存中保留会话；断开、刷新、账号／项目变化或 401 都需要重新配对。配对过期时，停止服务，在私有目录更新凭据文件并重新启动；保留状态目录和登记身份即可继续读取原任务、媒体回执与发布指针。

本地配对入口只用于 loopback 页面与服务，不宣称公开 HTTPS Studio 可以直接访问作者电脑。浏览器只调用现有 `/v1/audio/projects/:projectId` 接口；音色设计、任务、媒体导入和 COS 发布沿用后文同一套协议。

## 配置执行主机

运行环境使用 Node.js 24 LTS。先安装或在工作区构建 `advjs` 与需要的供应商插件；以下配置是部署者控制的 Node 模块，不能由浏览器或项目文件上传。

每个已授权的账号／项目组合对应独立的真实目录。提前创建这些空目录即可，Studio 会在作者明确审核任务时同步原生文件；无需手工复制章节。目录不能互相嵌套，任务状态目录必须放在所有项目之外。一个项目和状态目录由一个服务实例负责写入。

`audio-server.config.mjs` 示例使用 OpenAI 插件。账号 ID 必须是身份服务校验后返回的真实用户 ID，项目 ID 是已登记的 Studio 项目 ID；两者不是任意客户端声明。

```js
import { createOpenAiTtsProvider } from '@advjs/plugin-openai/voice'
import { createCloudBaseVoiceSessionAuthenticator } from 'advjs/node'

export default {
  host: '127.0.0.1',
  port: 3389,
  stateDirectory: '/var/lib/advjs/audio-private',
  allowedOrigins: ['https://studio.example.com'],
  // HTTPS 反向代理转发的 Host；未经过代理时无需此项。
  allowedHosts: ['audio.example.com'],
  authenticate: createCloudBaseVoiceSessionAuthenticator({
    envId: process.env.ADVJS_CLOUDBASE_ENV_ID,
  }),
  projects: [{
    accountId: process.env.ADVJS_ACCOUNT_ID,
    projectId: process.env.ADVJS_PROJECT_ID,
    root: '/srv/advjs/projects/registered-project',
    config: {
      authoring: {
        voice: {
          providers: [createOpenAiTtsProvider()],
          defaultProvider: 'openai-tts',
          presets: { openai: 'authoring/voices/openai.json' },
          presetProviders: { openai: 'openai-tts' },
          defaultPreset: 'openai',
          assetManifest: 'adv/assets.json',
        },
      },
    },
  }],
}
```

`OPENAI_API_KEY` 只设置在服务端进程环境中。预设、角色的 `voiceProfile` 和旁白档案中的模型／音色必须与实际插件检查结果相符；预设由部署者维护，具体结构见[作者语音模块](/guide/authoring-voice)。浏览器不上传预设执行代码、供应商密钥或本机路径。

Qwen 使用现有 `createQwenTtsProvider()`，执行主机必须是受支持的 Apple Silicon macOS，并已通过现有 `adv voice setup` 和 `adv voice doctor` 准备 MLX 环境。`setup` 显式创建 Python 3.12 环境并安装固定依赖，不下载模型；首次已审核的在线生成会下载预设中固定 revision 的模型并校验权重 SHA-256，离线模式缺少缓存时失败。HTTP 服务不会自动安装 Python 环境、选择模型或补写预设。注册两个插件时，在同一个 `providers` 数组中加入工厂，并用现有 `presetProviders` 为每个供应商登记对应预设；存在多个可用预设且无法唯一确定时，服务拒绝任务。

```bash
adv-audio-server /etc/advjs/audio-server.config.mjs
```

启动成功会输出 `{"event":"ready","url":"http://127.0.0.1:3389"}`。生产环境在前方配置 HTTPS 代理，并保持精确的 Origin 和 Host 白名单。`SIGTERM`、`SIGINT` 会关闭 HTTP 服务和后台执行端口。

## 验证身份与授权

云登录模式下，`authenticate(accessToken)` 必须验证真实登录会话并返回 `{ accountId }`，失败返回 `undefined`。可以接入已有可信 CloudBase／SSO 服务端验证逻辑；不要直接解码未验证的 JWT，也不要把 token 当成账号 ID。本地模式由前述工厂校验有时限的配对凭据，使用登记的 `local-device` 身份。

上面的 CloudBase 适配器只向该环境的官方 `/auth/v1/user/me` HTTPS 端点提交 Bearer 会话，要求有效的 ACTIVE 注册用户、相符的 `sub`／`user_id` 与非匿名登录来源。超时、重定向、错误状态和不合法响应均拒绝认证；不访问客户端声明的验证 URL，也不记录 token。CloudBase 管理控制台的登录态不能代替 Studio 作者会话。

其他 SSO 可以继续使用 `createRemoteVoiceSessionAuthenticator({ url, audience, serviceToken })`：调用部署者提供的 HTTPS 端点，发送 `POST { accessToken, audience }`，仅接受 `{ authenticated: true, audience, accountId }` 且 audience 精确相符。这是可选验证端点契约，不代表 ADV.JS 已部署该端点。

每次 HTTP 请求先验证会话，再从服务端登记表确定项目根目录。可选的 `authorizeProject(accountId, projectId)` 用于实时成员权限检查，后台任务在执行前也会再次检查。HTTP 请求只能传登记的项目 ID；账号、目录、供应商实例和发布存储由可信主机决定。

## 连接 Studio 与同步原生项目

本地模式使用音频页的配对表单。云登录模式的 Studio 构建配置优先读取 `VITE_ADVJS_VOICE_SERVICE_URL`；未配置时使用现有 `VITE_ADVJS_AI_RUNTIME_URL`。只有对应 URL 实际部署了下列音频路由才可执行配音。云登录会话通过现有 Runtime access token 接入，无服务或无会话时显示不可用状态。

```dotenv
VITE_ADVJS_VOICE_SERVICE_URL=https://audio.example.com
```

审核任务前，Studio 通过带版本检查的有限同步接口提交最新原生源文件：`adv.config.json`、游戏 JSON、角色数据、Markdown／JSON Flow 章节、唯一资源目录、音频账本、词典、旁白档案、Mixer 和 toolchain lock。服务端不会执行上传的 TypeScript 或 JavaScript。引用的授权文档按有限项目相对路径同步；音频媒体只能按已登记的 `assetId` 上传，并核对 SHA-256、大小和 MIME。

源文件单次最多 512 个，总计 8 MiB；单文件最多 1 MiB，授权文档最多 64 KiB，单项音频最多 64 MiB。服务端保留已登记的不可变 take 历史与媒体身份，拒绝同 ID 不同哈希、越界路径、秘密字段和旧 revision 写入。新生成的 take 默认未选用，作者明确选用后，相同 ID 才进入服务端发布账本。

## HTTP 任务与发布接口

所有路由位于 `/v1/audio/projects/:projectId`，需要 `Authorization: Bearer <已验证会话或本地配对凭据>`；JSON 请求使用 `Content-Type: application/json`。接口不接受任意查询参数。

| 方法与路径                       | 用途                                                     |
| -------------------------------- | -------------------------------------------------------- |
| `GET /sync`                      | 读取原生快照 revision 和缺失媒体                         |
| `POST /sync`                     | `{ expectedRevision, files }`，同步原生源文件            |
| `PUT /media/:assetId`            | 上传原始媒体，使用 `X-Advjs-Sha256` 和真实音频 MIME      |
| `POST /prepare`                  | `{ lineId, locale, providerId }`，只读解析真实供应商输入 |
| `POST /plan`                     | 逐句／最多 200 句计划与显式预算审核                      |
| `POST /enqueue`                  | `{ planId, planHash }`，幂等登记已审核计划               |
| `POST /command`                  | `{ jobId, action }`，执行、取消、恢复或重试              |
| `GET /jobs`                      | 项目私有任务状态和真实能力                               |
| `GET /jobs/:jobId/receipts`      | 已校验的生成回执，保留原 take／asset ID                  |
| `GET /jobs/:jobId/media/:taskId` | 下载 SHA-256 验证过的原始音频                            |
| `POST /releases/prepare`         | 排队准备发布，返回持久后台任务状态                       |
| `GET /releases/preparations`     | 恢复当前项目的发布准备记录                               |
| `GET /releases/preparations/:id` | 查询转码与发布审核结果                                   |
| `POST /releases/publish`         | 发布已审核 plan，检查源文件与 manifest revision          |
| `GET /releases/current`          | 读取当前公开 manifest 指针                               |

服务端持久保存计划、调用状态和媒体回执。关闭浏览器或 HTTP 超时只会停止等待，不会把已发出的供应商请求变成“未执行”。未知结果需要真实供应商查询能力才能恢复；现有 Qwen／OpenAI 插件没有该能力时，任务保持阻塞，不自动重复收费。缓存命中的原生 take 会先验证本地字节；没有服务端生成记录时不会伪造生成回执。

音色设计在同一项目路径下使用 `/voice-design`：`GET` 读取能力、版本与候选；`POST /save`、`/plan`、`/execute`、`/register`、`/select`、`/apply` 对应保存版本、审核、执行、登记、样本选择和角色应用。`GET /previews/:id` 查询当前状态，`GET /previews/:id/media` 下载已核验媒体，`POST /previews/:id/cancel` 取消。所有操作遵循 `VoiceDesignPort`，候选状态与审核保存在项目外，媒体路径和凭证不回传。

原生同步包含唯一作者音色库和宿主派生的设计 JSON 预设。服务端按已注册插件的可信模板重新派生并校验预设，拒绝客户端更换模型、revision、权重路径或哈希；不会执行上传内容。同步返回有限文件变更时比较 Studio 上传的实际原始字节，再写回规范 JSON。保存音色只改变作者文件，执行试听需再次审核预算；应用 Profile 后既有对白任务按当前语言的设计预设执行。

预算必须明确审核字符上限和未知成本。服务端对同一供应商限制并发，本地执行最多 1 项，云端最多 3 项；这些限制不替代部署者的账号额度与实际收费策略。

## 接入 COS 发布

发布端口按已验证的账号、项目和真实根目录创建并缓存。`@advjs/plugin-cos` 是部署者显式安装的可选插件；COS 凭证留在服务端，`CosStorage` 使用空前缀，由发布计划生成完整对象键。

以下片段加入前面的配置模块；本地模式也可以将同一个 `publication` 回调传入 `createLocalVoiceServiceOptions()`，使用项目外的本机状态目录与既有 COS 配置。批准的 toolchain 列表来自部署者控制的文件，不能用浏览器上传的锁文件作为批准依据。

```js
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { CosStorage } from '@advjs/plugin-cos'
import { createNodeAudioPublicationHost } from 'advjs/node'

const approvedProfiles = JSON.parse(
  await readFile('/etc/advjs/approved-audio-toolchains.json', 'utf8'),
)

async function publication(context) {
  const scope = createHash('sha256')
    .update(JSON.stringify([context.accountId, context.projectId]))
    .digest('hex')
  return createNodeAudioPublicationHost({
    root: context.root,
    stateDirectory: `/var/lib/advjs/audio-releases/${scope}`,
    approvedProfiles,
    projectPrefix: `projects/${scope}`,
    publicBaseUrl: 'https://media.example.com/',
    storage: new CosStorage({ prefix: '' }),
  })
}
// 将 publication 加入 export default 的服务配置。
```

实际发布核验所选对白的可信生成记录、授权文件、不可变主文件和转码收据，最后上传带哈希的 manifest，再通过服务端持久 CAS 更新公开指针。转码在后台执行，重启后可查询并恢复准备记录；服务进程最多同时执行 2 个转码任务。

可选的 `createLockedAudioContainerRunner({ root, outputDirectory: '.advjs/audio-release/variants', profile, approvedProfiles, dockerContext })` 可作为发布工厂的 `runner`。部署者先构建并批准固定 SHA-256 镜像 ID；执行器核对已安装镜像，不拉取镜像，禁用网络，将项目只读挂载，输出目录单独可写。可选的 `dockerContext` 由可信主机设置，不改变用户的全局 context。仓库 `apps/studio/cloudbase/audio-worker/Dockerfile` 使用固定官方 Debian 基础镜像与 FFmpeg 包；2026-10-12 已实际验证 Linux/arm64 容器、两种编码、禁网与只读挂载，并用于真实 COS 发布。其他架构或重建镜像仍需各自核验和批准，不能复制验收摘要作为批准依据。

## 使用受限部署配置

仓库提供 `apps/studio/cloudbase/audio-service/` 部署入口。复制 `service.example.json` 为服务端配置，填写真实 CloudBase 环境、已验证作者 ID、已登记项目 ID、HTTPS Host／Origin 和持久卷。该 JSON 只选择现有 Qwen／OpenAI 插件、可信预设与已批准工具链；示例中的占位值和空工具链列表必须替换，不能直接作为已部署服务使用。

CloudRun 使用独立音频服务和单实例持久卷。项目与任务目录放在卷内的独立绝对路径，临时容器磁盘不能保存配音回执和收费幂等记录。首次初始化仅接受已经挂载的空目录：

```bash
node apps/studio/cloudbase/audio-service/entrypoint.mjs \
  prepare-volume /srv/advjs-audio "$PERSISTENT_VOLUME_ID"
```

初始化后创建配置中的项目／私有状态目录，放入部署者维护的原生预设，设置 `ADVJS_AUDIO_SERVICE_CONFIG` 为服务端 JSON 的绝对路径，再启动：

```bash
node apps/studio/cloudbase/audio-service/entrypoint.mjs serve
```

启动验证卷标记、目录隔离、单写入实例、预设及实际 FFmpeg 指纹。卷标记是部署者的持久性声明，不能证明云平台已经挂载了 CFS；上线仍须检查真实挂载和重启持久性。进程异常退出留下的实例锁不会自动删除，先确认旧实例停止再处理。Linux 镜像只使用 OpenAI；已有 Qwen MLX 执行继续使用受支持的 Mac 主机和同一入口。

启用 publication 时，STS 签发端按 `sha256(JSON.stringify([accountId, projectId]))` 隔离项目，并以原子替换更新 `stsDirectory/<scope>.json`，权限为 0600。内容包含 `bucket`、`region`、完整 `projectPrefix`、`TmpSecretId`、`TmpSecretKey`、`SecurityToken`、`StartTime`、`ExpiredTime`。授权回调每次读取当前会话，限定版本状态读取与该项目前缀 GET／HEAD／PUT，拒绝过期会话、列目录、删除和跨项目访问。部署入口拒绝以长期 COS 密钥环境变量代替 STS；签发端及密钥不属于浏览器或项目数据。

## 在普通项目构建中使用公开音频

发布完成后，`manifestUrl` 指向公开资源目录，`revision` 是该文件原始字节的 SHA-256。普通 Markdown／JSON Flow 项目可以显式选择这份已发布目录：

```bash
adv build --audio-manifest "$MANIFEST_URL" --audio-manifest-sha256 "$MANIFEST_REVISION"
```

第一个参数也可以是下载后的本地 JSON 文件；第二个参数始终必填。网络地址要求 HTTPS，本机 HTTP 仅允许 localhost／loopback。目录最多 2 MiB，构建核对原生资源 ID、kind、实际母版字节、当前选用对白 take 身份，以及 Opus／AAC 两种公开变体的对象键、SHA-256、大小与 MIME。缺失音频、母版或选用身份变化、错误 revision 或变体不完整都会停止构建。仅修改对白文本仍按共享协议标记已选 take 过期，不自动替换或禁止播放。

默认 `adv build` 继续使用原生本地音频。这两个参数只替换音频的运行时地址；章节、对白正文、选用身份与显式背景／头像／封面／图标仍来自原生项目。发布模式不复制整个 `public` 目录，也不打包母版、参考音频、未选历史、授权文档和作者生成参数；未声明图标时使用内置图标。请在项目中明确声明需要构建的非音频资源。

## 验证

本地配对的正式 Studio 应用验证使用生产构建、真实项目入口和 Node HTTP 服务，不注入云登录；测试供应商只提供能力，模型调用为零：

```bash
pnpm build:advjs
pnpm -C apps/studio build
pnpm -C apps/studio exec playwright test --config tests/e2e/local-voice.playwright.config.ts
```

实际 Qwen 环境与两端完整旅程见[作者语音指南](/guide/authoring-voice#仓库真实-qwen-验收)。Studio 的真实模型旅程通过本地配对表单连接同机服务，默认不发布 COS。要在已授权的测试前缀续验实际发布，另行提供项目外的可信 Node publication 工厂模块，导出默认工厂和已批准的 `toolchainLock`，再显式开启：

```bash
ADVJS_REAL_QWEN_COS_PUBLISH=1 \
ADVJS_REAL_QWEN_PUBLICATION_MODULE=/absolute/path/to/trusted-publication.mjs \
ADVJS_REAL_QWEN_ARTIFACTS=/absolute/path/to/private-acceptance \
pnpm e2e:qwen:studio
```

该模块由本机操作者维护，使用前述同一个 publication 端口；不能从项目或浏览器加载。凭据、STS 与批准工具链留在可信主机，工厂仅返回发布能力。测试只审核当前剧情选用音频，再将回执用于下方 COS 重放，不因配对、构建或页面重载自动生成／上传。

先确认独立服务命令输出 ready，并检查未登录请求返回 401、其他账号的项目请求返回 403。再在已登录 Studio 中保存一条对白、审核预算并执行，确认生成结果未自动选用；试听后明确选用，再审核发布。

专项测试使用真实 Node HTTP、原生项目目录和现有注册表的 fake 供应商验证重启恢复、账号隔离、媒体哈希、候选同 ID 导入、选用同步和发布端口；不会调用真实模型或收费 API。

```bash
pnpm vitest run tests/unit/audio/studio-voice-service.test.ts
```

真实云端验收单独启用，默认 CI 跳过。先准备已登录的私有浏览器 `storageState` 文件，包含 Studio IndexedDB，设置以下目标；登录状态文件不要提交或公开：

```dotenv
ADVJS_STUDIO_CLOUD_E2E=1
ADVJS_STUDIO_CLOUD_URL=https://studio.advjs.org
ADVJS_STUDIO_CLOUD_AUDIO_URL=https://audio.example.com
ADVJS_STUDIO_CLOUD_ACCOUNT_ID=verified-author-id
ADVJS_STUDIO_CLOUD_PROJECT_ID=registered-project-id
ADVJS_STUDIO_CLOUD_STORAGE_STATE=/private/path/studio-session.json
```

```bash
pnpm e2e:audio:cloud
```

默认只读验证真实 HTTPS 服务、登录会话及项目授权。实际发布还需 `ADVJS_STUDIO_CLOUD_WRITE=1`、`ADVJS_STUDIO_CLOUD_MEDIA_ORIGIN` 和已审核 take／asset ID／母版 SHA；实际生成另需 `ADVJS_STUDIO_CLOUD_GENERATE=1`、章节、line ID、locale、provider ID 与字符预算，最多执行一条明确目标对白，未知结果不重复调用。`ADVJS_STUDIO_CLOUD_PLAYER=1` 配合目标对白和分支文本验证原生 ZIP、普通 check／build 与双浏览器播放。准确变量见 `apps/studio/tests/fixtures/cloud-audio/config.ts`；未配置、跳过或使用本机 HTTP 均不能记为真实云端通过。

已发布的真实 COS 与此前本地 Qwen 产物可以独立重放，不调用模型或写云端：

```bash
ADVJS_COS_REPLAY_PUBLICATION=/private/path/publication.json pnpm e2e:audio:cos
```

该回执包含 `{ project: absoluteNativeProjectPath, publication: { manifestUrl, revision } }`。重放读取原生 JSON Flow 和真实选用身份，经普通构建锁定公开清单，再验证 COS 字节与 Chromium／WebKit 正常 Start 播放；这项验收不替代托管服务的真实生成验收。实际结果和部署限制统一记录在[验收报告](/reports/2026-10-11-audio-runtime-implementation)。

`ADV_AUDIO_PROVIDER_HOST_UNSUPPORTED` 表示本地执行主机不受支持；`ADV_AUDIO_PROVIDER_NOT_READY` 表示本地环境或云端凭证检查未通过；`ADV_AUDIO_SYNC_CONFLICT` 要求重新读取并审核快照。未知供应商结果、源文件变化和发布 revision 冲突应保留原任务，先查看持久状态，再决定下一步。
