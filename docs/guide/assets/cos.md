# COS 存储与发布规范

ADV.JS 把“创作期托管存储”和“生产游戏公共发布”分成两条链路。两者共用稳定逻辑 ID、SHA-256 和审计规则，但权限、对象前缀与缓存策略不同。

| 链路            | 默认可见性    | 写入者                       | 对象前缀                                       | 用途                           |
| --------------- | ------------- | ---------------------------- | ---------------------------------------------- | ------------------------------ |
| Studio 托管资源 | 私有          | `advjsAssets` CloudBase 函数 | `staging/accounts/...`、`private/accounts/...` | 登录用户的创作原件和预览       |
| 游戏生产发布    | 公共 GET/HEAD | CI、发布机或受限 STS 会话    | `games/{game-id}/v{major}/...`                 | 玩家运行时使用的不可变派生文件 |

不要把 Studio 私有原件直接当 CDN 成品，也不要把公共游戏目录作为浏览器可写的用户网盘。

## 公共地址与对象键

ADV.JS 官方素材域名为：

```text
https://cos.advjs.yunle.fun/
```

每款游戏使用独立的主版本前缀：

```text
games/{game-id}/v{major}/
├── characters/{character-id}/standing/{expression}.{sha12}.webp
├── characters/{character-id}/animations/{state}.{sha12}.webp
├── backgrounds/{scene-id}.{sha12}.webp
├── cg/{shot-id}.{sha12}.webp
├── cg/{shot-id}.thumbnail.{sha12}.webp
├── ui/{asset-id}.{sha12}.webp
├── audio/bgm/{track-id}.{sha12}.ogg
├── audio/sfx/{sound-id}.{sha12}.ogg
└── manifests/assets.json
```

`game-id`、角色、场景和状态均使用小写 ASCII kebab-case。路径不得包含空格、中文、来源作品分卷、`latest/`、查询串版本号或可编辑源文件。素材内容变化后生成新的 SHA-256 文件名；已经发布为 immutable 的对象绝不覆盖。破坏性目录变化或清单契约变化时升级到 `v2/`。

### 已确认的音频对象键扩展

下一次破坏性音频迁移会把上方简单的 `audio/bgm`、`audio/sfx` 分支升级为统一音频域。规范形式为：

```text
{projectPrefix}/audio/
├── voice/{locale}/{speakerId}/{lineId}/{takeId}.{hash}.{ext}
├── bgm/{assetId}.{hash}.{ext}
├── ambience/{assetId}.{hash}.{ext}
├── sfx/{assetId}.{hash}.{ext}
└── ui/{assetId}.{hash}.{ext}
```

`projectPrefix` 由 Asset Catalog Profile 决定：托管创作空间可以使用 `private/accounts/{accountId}/projects/{projectId}`，公共游戏发布可以继续使用 `games/{game-id}/v{major}`。不论外层 namespace 如何选择，`audio/voice/{locale}/{speakerId}` 的相对顺序固定。

locale 在 voice 域中优先于 speaker，以支持按语言发布、质检、统计和最小权限任务。普通角色的 `speakerId` 等于 `characterId`，旁白使用 `narrator`。项目文件使用规范 BCP 47（如 `zh-CN`），对象键使用规范化小写（如 `zh-cn`）。角色显示名、台词原文、Provider 名称和签名参数不进入对象键。

该扩展当前处于已确认、待实施状态。完整边界见[音频资产与 AI 配音决策](/about/design/audio)和[音频系统设计](/superpowers/specs/2026-08-12-audio-system-design)。

## 清单与发布计划

项目以 `adv/assets.json` 作为唯一资源根，保存 Profile，并内联逻辑资源或引用分片。每项不再重复保存可由 `baseUrl + objectKey` 推导的绝对 URL。构建器将源目录规范化为扁平的 `manifests/assets.json`；该稳定入口总是最后上传。

`prepare-release.mjs` 还会生成不含凭证的 `adv/cos-release.json`。发布计划逐项记录：

- 本地发布包内的相对文件；
- COS 完整对象键；
- MIME、缓存策略和 `x-cos-meta-sha256`；
- 上传顺序，其中 manifest 固定在最后。

发布时只消费计划中的对象，不递归上传整个临时目录。这样重复生成留下的旧哈希文件不会被误发布。

## 清单的消费边界

素材相关文件各自只有一种权威职责：

| 文件                    | 内容                                           | 是否手工维护           |
| ----------------------- | ---------------------------------------------- | ---------------------- |
| `adv/assets.json`       | 唯一资源根、Profile、内联条目或分片入口        | Studio、人工或工具维护 |
| `adv/assets/*.json`     | 可选分片中的逻辑素材与生成元数据               | Studio、人工或工具维护 |
| `adv/cos-release.json`  | 本次上传对象、HTTP 元数据和 manifest-last 顺序 | 由发布流程生成，不手改 |
| 项目 `ASSETS.md`        | 来源、作者、许可说明和人工核验日期             | 人工维护               |
| `manifests/assets.json` | 公开部署的扁平稳定清单，由源码目录规范化生成   | 最后上传               |

正式游戏通过构建器规范化 `adv/assets.json` 及可选分片，再由公共 catalog resolver 选择 `production` Profile。角色、场景、画廊和 BGM 都从同一目录投影，不在配置中维护第二套带哈希 URL。以下直接导入形式适用于内联根或构建生成的扁平目录：

```ts
import { createAdvAssetCatalog } from '@advjs/core'
import artManifest from './adv/assets.json'

const assets = createAdvAssetCatalog(artManifest)
const summerRoom = await assets.resolve('background/summer-room')
```

Studio 不执行项目 TypeScript。`adv/settings/game.json` 的画廊等展示数据只保存 `assetId`、排序和章节关联；标题、替代文本、原图和缩略图从 catalog 投影。完整职责见[资源目录协议](./catalog)。

## Git 与本地工作区边界

Git 保存可审查、可复现发布所需的文本文件：剧情和配置、`adv/assets.json` 及可选分片、`adv/cos-release.json`、素材许可、生成提示与处理脚本。游戏使用的图片、动画、音频成品不再复制到 `public/` 或提交到 Git，正式运行统一从清单记录的 COS URL 加载。

生成中的原图、透明通道 QA、contact sheet、WAV 中间文件和待发布包写入仓库已忽略的 `temp/{game-id}-art/`。这部分可以保留在维护者本地以便重新审计和发布，也可以由同一生成流程重建；它不是 Git 仓库内容。favicon、PWA 图标等应用壳资源不属于游戏素材，可继续随应用发布。

## HTTP 元数据

| 对象                    | `Content-Type`                    | `Cache-Control`                       |
| ----------------------- | --------------------------------- | ------------------------------------- |
| WebP                    | `image/webp`                      | `public, max-age=31536000, immutable` |
| AVIF                    | `image/avif`                      | `public, max-age=31536000, immutable` |
| OGG                     | `audio/ogg`                       | `public, max-age=31536000, immutable` |
| `manifests/assets.json` | `application/json; charset=utf-8` | `public, max-age=60, must-revalidate` |

所有对象同时记录 `x-cos-meta-advjs-id`、`x-cos-meta-advjs-schema` 和 `x-cos-meta-sha256`。不要把分块上传的 ETag 当作内容 SHA-256。

`@advjs/plugin-cos` 会根据扩展名和内容哈希文件名填充默认 MIME/缓存头，也兼容 `TENCENT_COS_*` 环境变量与 STS Token。发布完整对象键时将 `prefix` 设为空字符串。

## Studio 托管上传链路

Studio 不再要求用户在浏览器填写或持久化 COS SecretId/SecretKey。登录用户发布一个本地资源时：

1. 浏览器计算 SHA-256，并调用 CloudBase Event 函数 `advjsAssets.reserveUpload`。
2. 函数验证账号、项目 ID、资源 ID、MIME 与大小，在 `staging/accounts/{uid}/uploads/{upload-id}/` 建立 15 分钟预约。
3. 函数只签发一个对象、一个 `PUT` 方法的短期 URL；签名同时约束 `Content-Type`、哈希和 upload ID 元数据。
4. 浏览器直传该对象，然后调用 `completeUpload`。
5. 函数通过 HEAD 校验字节数、类型和元数据，并按范围读取计算实际 SHA-256；验证通过后把对象服务端复制到 `private/accounts/{uid}/projects/{project-id}/assets/{asset-id}/{sha256}.{ext}`，写入私有目录记录并清理 staging。
6. Studio 预览私有资源时通过 `getPreviewUrl` 获取短期 GET URL。浏览器永远不会获得桶级或目录级写权限。

CloudBase 配置位于 `apps/studio/cloudbase/functions/advjsAssets/`。生产环境优先给函数绑定最小权限运行角色；如平台必须注入密钥，也只允许在函数运行环境中设置 `TENCENTCLOUD_*`，不得使用 `VITE_*` 或下发到浏览器。目标桶与地域用 `ADVJS_ASSET_BUCKET`、`ADVJS_ASSET_REGION` 配置。

私有桶建议启用：

- 默认私有读写；拒绝公共列目录。
- IAM 只允许函数访问 `staging/accounts/*` 和 `private/accounts/*`，发布 CI 不能访问用户原件。
- staging 生命周期 1 天自动清理；历史未引用内容寻址对象按产品保留策略清理，不能用覆盖写代替版本管理。
- CORS 只列出实际 Studio 域名和本地开发域名；方法仅 `PUT, GET, HEAD`，允许 `Content-Type` 与 `x-cos-meta-*`，不使用 `Origin: *` 配合敏感操作。
- 记录预约、完成、失败、对象键和调用 uid 的审计日志，但不记录签名 URL、Secret 或 Token。

`YunLeFun/drive` 若已经绑定 COS，应把它视为服务端存储连接器，而不是让 ADV.JS 复用 Drive 的浏览器凭据或私有实现。可以共用同一腾讯云账号，甚至共用一个私有桶，但必须使用不同服务角色、不同前缀和各自的目录数据库；更推荐独立桶，以便生命周期、CORS、审计和事故隔离。ADV.JS 项目协议只依赖 `advjsAssets` 契约，不依赖 Drive 仓库配置。

## 公共读取与 CORS

本节只适用于 `games/` 生产发布源。公共素材域名向浏览器开放匿名 `GET`、`HEAD`，上传和删除必须走发布服务、受限子账号或 STS。公共无凭据资源可以使用 `Access-Control-Allow-Origin: *`，并暴露：

```text
Cache-Control, Content-Length, Content-Type, ETag,
x-cos-meta-advjs-id, x-cos-meta-sha256
```

公共发布域名的浏览器 CORS 不开放 `PUT`、`POST`、`DELETE`。私有 Studio 桶按上一节使用精确 Origin 和单对象签名。防盗链属于 CDN/EdgeOne 策略，不应通过破坏 Canvas、WebGL、Studio 或下载功能的 CORS 配置实现。

## 加速层与源站缓存

接入 EdgeOne 或其他 CDN 后，版本化素材目录必须遵循 COS 源站的 `Cache-Control`，不能再按图片、音频扩展名统一覆盖浏览器缓存时间。推荐按域名和游戏主版本前缀建立路径规则，例如：

```text
^/games/{game-id}/v{major}/
```

该规则的浏览器缓存策略设为“遵循源站”，并放在通用图片缓存规则之后，使其获得更高优先级。这样带内容哈希的资源保持一年 immutable，稳定 manifest 保持 60 秒并重新验证；不得把二者都覆盖成固定一小时。

发布验收需要分别访问 COS 源站和公开自定义域名。除状态码、字节数、MIME 与 SHA-256 元数据外，还应按语义核对缓存指令，不依赖响应头内指令的书写顺序。公开域名的完整 GET 下载还需重新计算文件 SHA-256，避免只验证缓存节点返回的 HEAD 元数据。

## 标准发布流程

仓鼠 Demo 可以直接生成和审计发布包：

```bash
pnpm -C demo/hamster assets:release
pnpm -C demo/hamster assets:audit
pnpm -C demo/hamster assets:audit:remote
```

通用项目使用：

```bash
node skills/adv-art/scripts/prepare-release.mjs \
  --adaptation demo/example/adv/adaptation.json \
  --asset-root temp/example-art \
  --release-root temp/example-release \
  --manifest demo/example/adv/assets.json \
  --cos-release-plan demo/example/adv/cos-release.json \
  --public-base-url https://cos.advjs.yunle.fun/ \
  --object-prefix games/example/v1/ \
  --license 'CC BY-NC-SA 4.0' \
  --model imagegen-built-in \
  --prompt-version example-art-v1 \
  --created-at 2026-07-20

node skills/adv-art/scripts/audit-cos-release.mjs \
  demo/example/adv/cos-release.json \
  temp/example-release

node skills/adv-art/scripts/audit-cos-remote.mjs \
  demo/example/adv/cos-release.json
```

审计成功后，使用仅允许目标前缀读写的临时 STS 凭证，或在可信 CI 中使用单对象预签名，按 `cos-release.json.objects` 顺序上传。稳定 manifest 覆盖后，若 EdgeOne 仍返回旧清单，只清除该 manifest URL，不例行清除或覆盖带内容哈希的对象。当且仅当整个游戏前缀的 CORS 或响应头策略发生修正时，可先对该目录“标记过期”；如条件回源仍保留旧响应头，才执行一次目录“直接删除”并做好回源容量评估。这两种操作都只处理 EdgeOne 缓存，不删除 COS 对象。

然后运行远端审计：它会完整下载当前发布计划的每个对象并重算 SHA-256，以 identity encoding 执行 HEAD 字节校验，同时核对 MIME、缓存语义、checksum 元数据、GET/HEAD 响应的 CORS 暴露头，以及 OPTIONS 预检的方法与 Max-Age。最后再进行一次禁用缓存和一次启用缓存的浏览器试玩。

SecretId、SecretKey 和 Token 只存在于当前终端环境，不写入项目、清单、发布计划或日志。可编辑原图、提示词草稿、QA 图和被拒素材只保存在本地工作目录。

腾讯云参考：[前端直传与临时密钥](https://cloud.tencent.com/document/product/436/40265)、[预签名 PUT](https://cloud.tencent.com/document/product/436/14114)、[签名安全说明](https://cloud.tencent.com/document/product/436/36121)、[生命周期](https://cloud.tencent.com/document/product/436/17031)。
