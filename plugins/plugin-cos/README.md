# @advjs/plugin-cos

使用腾讯云 COS 存储 ADV.JS 静态资源。插件接受腾讯云 COS Skill 使用的标准环境变量，同时兼容旧的 `ADV_COS_*` 名称：

该插件用于可信的 Node.js/CI 发布进程，不应打包进浏览器，也不是 Studio 的登录用户上传通道。Studio 使用 `advjsAssets` 云函数签发的单对象短期 URL，永久密钥不会进入前端。

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
