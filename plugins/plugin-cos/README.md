# @advjs/plugin-cos

使用腾讯云 COS 存储 ADV.JS 静态资源。插件接受腾讯云 COS Skill 使用的标准环境变量，同时兼容旧的 `ADV_COS_*` 名称：

该插件用于可信的 Node.js/CI 发布进程，不应打包进浏览器，Studio 的音频发布通过认证的 Node 服务使用该插件；浏览器不导入 COS SDK。普通 Studio 素材上传使用 `advjsAssets` 云函数签发的单对象短期 URL，永久密钥不会进入前端。

```bash
export TENCENT_COS_SECRET_ID=TmpSecretId
export TENCENT_COS_SECRET_KEY=TmpSecretKey
export TENCENT_COS_TOKEN=SecurityToken
export TENCENT_COS_REGION=ap-guangzhou
export TENCENT_COS_BUCKET=example-1250000000
```

普通 `adv push` 继续使用默认 `adv/` 前缀。发布 `games/{game}/v1/` 完整对象键时使用空前缀，并传入发布计划中的元数据：

```ts
import { CosStorage } from '@advjs/plugin-cos'

const cos = new CosStorage({ prefix: '' })
await cos.upload(localPath, object.objectKey, {
  contentType: object.headers['Content-Type'],
  cacheControl: object.headers['Cache-Control'],
  metadata: {
    'advjs-id': object.id,
    'advjs-schema': '2',
    'sha256': object.sha256,
  },
})
```

带 8—64 位小写内容哈希的对象默认获得一年 immutable 缓存；稳定 JSON manifest 默认短缓存并强制重新验证。完整对象键、清单和 CORS 规范见项目文档的“COS 素材发布规范”。

## Ref

[对象存储 Node.js SDK | 腾讯云](https://cloud.tencent.com/document/product/436/8629)

## 音频发布

`advjs/node` 的 `createNodeAudioPublicationHost()` 复用 `CosStorage({ prefix: '' })`，执行真实转码、可信收据核验、不可变对象上传和 manifest-last。服务配置见 [Studio 音频服务](../../docs/guide/studio/audio-service.md)。浏览器只提交服务器注册的项目 ID、审核 ID 和预期 revision，不提交云端凭据、处理收据或任意主机路径。

新接口 `putBytes()` 支持 `forbidOverwrite`，`readBytes()` 使用有界流和 `If-Match` 固定 HEAD 得到的 ETag。校验实际远程字节，不能用自报 SHA 元数据代替哈希。`assertImmutableBucket()` 拒绝曾启用版本控制的桶；COS 的禁止覆盖头在版本控制桶中不生效，见 [PUT Object 官方协议](https://intl.cloud.tencent.com/document/product/436/7749?lang=en)。

公开音频清单以内容哈希命名，服务器持久指针执行 CAS；不假定 COS PUT 支持条件替换。发布角色需要限定项目 prefix 的 PutObject／GetObject 和读取桶版本配置的权限，不需要 DeleteObject、删除桶或更改版本控制权限。为浏览器读取公开变体配置 GET／HEAD CORS；private masters、参考素材、账本及授权文档不上传公开 prefix。

可信宿主可传入 `getAuthorization` 使用 COS SDK 的刷新 STS 回调。临时凭据留在服务端，只有 bucket、region 与公开资源地址进入发布配置；禁止把 SecretId、SecretKey 或 token 写进原生项目 JSON、日志和客户端。测试使用真实 SDK 对本地 HTTP 协议端进行验证，不访问真实桶。
