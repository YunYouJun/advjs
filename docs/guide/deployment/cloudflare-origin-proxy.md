# Cloudflare 外部源站代理

`deployCloudflareOriginProxy` 用一个 Cloudflare Worker Custom Domain 承接公开域名，再以流式请求访问既有 HTTPS 源站。它适合游戏已经部署在 EdgeOne Pages 等平台、但希望继续使用 `*.advjs.org` 稳定入口的场景。

这层代理只负责域名与源站解耦，不改变游戏的内容事实源：源码和构建仍由游戏仓库管理，图片、视频、音频等大体积媒体仍应使用 COS 或其他对象存储，并通过稳定 CDN URL 直接加载。

::: warning 不要代理临时 Preview
生产代理的 `origin` 应指向稳定、公开、可回滚的 HTTPS 源站。不要把带签名查询参数的临时 Preview URL 写入 Worker、仓库或日志。
:::

## 适用边界

推荐使用本能力的情况：

- Cloudflare 托管目标域名所在的有效 Zone；
- 游戏已有独立、公开的 HTTPS 源站；
- 目标子域名没有现存的 CNAME 或其他冲突记录；
- Worker 是该域名的公开入口，而不是附着在现有源站前的路径 Route。

Cloudflare Custom Domain 会为 Worker 管理 DNS 和 TLS 证书。不要预先手工创建同名 CNAME，也不要把 Custom Domain 与需要现有橙云 DNS 记录的 Worker Route 混用。

## 部署

先使用项目依赖中的 Wrangler 完成登录，并取得目标 Zone 所属的 Account ID。Account ID 不是密钥，但建议通过环境变量传入，避免把账号绑定写死在可复用脚本中。

```ts
import { deployCloudflareOriginProxy } from 'advjs/node'

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
if (!accountId)
  throw new Error('CLOUDFLARE_ACCOUNT_ID is required')

const result = await deployCloudflareOriginProxy({
  accountId,
  domain: 'game.advjs.org',
  origin: 'https://game.example.com',
})

console.log({
  deploymentId: result.deploymentId,
  url: result.url,
})
```

部署器会使用 ADV.JS 内置的固定版本 Wrangler，并在临时目录中生成 Worker 与配置。成功后临时文件会被删除，返回值只包含非密钥部署信息。调用方可把 `deploymentId`、`domain`、`origin` 和对应 Git revision 写入自己的发布记录。

首次接入前可以只执行编译检查：

```ts
await deployCloudflareOriginProxy({
  accountId,
  domain: 'game.advjs.org',
  origin: 'https://game.example.com',
  dryRun: true,
})
```

`dryRun` 不创建 Worker、DNS 或证书，也不会返回 `deploymentId`。

## 默认安全行为

部署器生成的 Worker 固定采用以下边界：

- `origin` 必须是无账号、路径、查询参数和片段的 HTTPS Origin；
- 只接受与配置完全一致的公开 Host，其他 Host 返回 `421`；
- 请求体和响应体保持流式传输，不把游戏包或模型响应整体读入内存；
- 上游重定向使用 `manual` 模式，同源 `Location` 会改写回公开域名，外部登录地址保持不变；
- 上游 Cookie 的 `Domain` 属性会移除，使其成为公开域名的 Host-only Cookie；
- 浏览器的 `Origin`、`Referer` 与转发协议会按源站重写；
- 客户端提供的 `X-Forwarded-For` 不受信任，只使用 Cloudflare 写入的 `CF-Connecting-IP` 重建转发地址；
- 上游异常返回不含内部错误正文的 `502`，结构化日志只记录方法、路径与错误类型，不记录查询参数；
- `workers.dev` 与 Preview URL 默认关闭，Custom Domain 为唯一公开入口；
- Worker Observability 默认开启，调用方仍需按自身隐私政策设置日志保留期。

::: danger 下游仍需建立可信代理边界
重建 `X-Forwarded-For` 只保证 Worker 发出的头部可预测。若源站也允许绕过 Worker 直接访问，源站不能无条件信任任意来访者提供的该头部。IP 限流、认证和付费额度仍应在服务端按可信代理、签名或平台提供的客户端 IP 字段校验。
:::

## 媒体与缓存

推荐把不同职责拆开：

| 内容                    | 推荐位置       | 公开访问方式                             |
| ----------------------- | -------------- | ---------------------------------------- |
| HTML、JS、CSS、同源 API | 原部署平台     | 经 Worker Custom Domain 代理             |
| 图片、视频、音频        | COS 等对象存储 | 经独立 CDN 域名直接访问                  |
| API Key、HMAC、模型凭据 | 服务端 Secret  | 永不进入 Worker 源码、浏览器包或素材清单 |
| 内容哈希与公开 URL      | Git 内文本清单 | 构建和发布时校验                         |

大体积媒体使用版本化对象键和 `immutable` 缓存；HTML 保持短缓存或重新验证。不要为了统一域名把已具备稳定 CDN URL 的媒体再次穿过 Worker，这只会增加链路与流量成本。

## 验证与回滚

部署后至少验证：

1. 公开域名、关键 JS/CSS 和同源 API 守卫返回预期状态；
2. 公开入口与源站的同一静态文件内容哈希一致；
3. 浏览器网络面板中的媒体只命中批准的 CDN 域名；
4. 登录重定向、Cookie、移动端、Reduced Motion 和刷新恢复正常；
5. 下游 IP 限流与日志脱敏在经过代理后仍符合预期。

Worker 与源站版本彼此独立。游戏回滚应先在源平台切换到已验证部署；只有域名代理逻辑或源站地址发生变化时才重新部署 Worker。移除 Custom Domain 属于外部基础设施变更，应通过 Cloudflare 控制台或 API 单独审核执行。
