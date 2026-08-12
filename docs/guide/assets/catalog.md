# 资源目录协议

ADV.JS 使用“稳定逻辑 ID + 可切换位置 Profile + 可选加载 Bundle”的资源目录。剧情、角色卡、场景卡、画廊和游戏设置只引用 `assetId`；本地路径、COS 对象键、内容哈希和媒体元数据由资源目录集中管理。

这条边界借鉴了成熟游戏引擎的共同做法：Unity Addressables 用地址隔离逻辑引用与物理位置；Godot 将源文件、导入描述和生成缓存分层；Cocos Asset Manager 用 Bundle 与版本信息组织本地和远端资源。ADV.JS 对应采用 `id`、`profiles`、`bundles` 与构建清单，同时保留适合 Git 审阅的 JSON 源文件。

## 配置边界

| 文件或目录                      | 权威职责                             | 不应该包含什么                       |
| ------------------------------- | ------------------------------------ | ------------------------------------ |
| `adv/settings/game.json`        | 标题、变量、进度与画廊排序等游戏语义 | 路径、对象键、哈希、重复的素材元数据 |
| `adv/assets.json`               | 唯一资源目录根；内联资源或引用分片   | 玩家设置、章节流程、COS 凭据         |
| `adv/assets/*.json`             | 可选的创作期资源分片                 | Profile、发布入口、第二个根配置      |
| `adv/assets/**`                 | 项目内二进制源文件                   | 带哈希的公开发布副本                 |
| `dist/**/manifests/assets.json` | 构建生成的扁平运行时目录             | 人工修改                             |
| `adv/cos-release.json`          | 一次发布的精确对象与 HTTP 元数据     | 游戏语义与部署凭据                   |
| `ASSETS.md`                     | 来源、许可解释与人工验收记录         | 机器消费的对象列表                   |

`settings/game.json` 与 `assets.json` 不是二选一：前者描述游戏是什么，后者描述资源如何定位，两者通过稳定 `assetId` 连接。

## 物理路径应该放在哪里

物理路径可以出现在资源目录中，而且本地 Profile 需要它；问题不在“存在路径”，而在“谁依赖路径”。

- `path` 是 `project` 适配器的源坐标，只在资源目录边界内使用；
- `objectKey` 是 `http` 适配器的发布坐标，由 `baseUrl` 解析；
- 剧情、游戏设置、内容卡和 UI 只依赖 `assetId`；
- 移动文件或切换 CDN 时只修改目录映射，不修改剧情和游戏语义。

不要把绝对文件系统路径写入项目。`path` 必须相对 `profiles.local.root`，使用 `/` 分隔，并且不能逃出项目资源目录。绝对 HTTP URL 只作为旧格式兼容入口；新项目使用 `baseUrl + objectKey`，避免每项重复域名。

## 一个根文件，两种创作形式

项目只有一个可写根文件 `adv/assets.json`。它必须在以下形式中二选一，不能同时声明 `assets` 与 `includes`。

小型项目或完全由工具生成的目录可以内联：

```json
{
  "schemaVersion": 2,
  "id": "my-game",
  "defaultProfile": "local",
  "profiles": {
    "local": { "provider": "project", "root": "adv/assets" },
    "production": {
      "provider": "http",
      "baseUrl": "https://cos.advjs.yunle.fun/"
    }
  },
  "assets": [
    {
      "id": "background/summer-room",
      "kind": "background",
      "type": "image",
      "path": "backgrounds/summer-room.webp"
    }
  ]
}
```

中大型项目可以让同一个根文件引用按领域拆分的清单：

```json
{
  "schemaVersion": 2,
  "id": "my-game",
  "defaultProfile": "local",
  "profiles": {
    "local": { "provider": "project", "root": "adv/assets" },
    "production": {
      "provider": "http",
      "baseUrl": "https://cos.advjs.yunle.fun/"
    }
  },
  "includes": ["assets/characters.json", "assets/backgrounds.json", "assets/cg.json", "assets/audio.json"]
}
```

分片只保存自身的资源数组：

```json
{
  "schemaVersion": 2,
  "assets": [
    {
      "id": "bgm/summer-day",
      "kind": "bgm",
      "type": "audio",
      "path": "audio/bgm/summer-day.ogg"
    }
  ]
}
```

`includes` 相对 `adv/` 解析，必须指向 `assets/` 下的 JSON，不能使用绝对路径、`.`、`..` 或重复条目。Studio 和构建器按声明顺序合并分片，在内存中得到统一的扁平目录；生成结果只写入构建目录或发布包，不在源码目录创建第二个索引。

## Schema v2

完整的发布阶段条目可以包含：

```json
{
  "id": "background/summer-room",
  "kind": "background",
  "type": "image",
  "bundle": "opening",
  "path": "backgrounds/summer-room.webp",
  "objectKey": "games/my-game/v1/backgrounds/summer-room.0123456789ab.webp",
  "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "bytes": 245760,
  "mimeType": "image/webp",
  "width": 1920,
  "height": 1080,
  "license": "CC-BY-4.0",
  "source": {
    "type": "original",
    "createdAt": "2026-07-20"
  }
}
```

字段职责：

- `id` 是内容和编辑器使用的长期地址；改文件名、换 CDN 或重新压缩时不改 ID；
- `kind` 表示 ADV 语义，如 `character`、`animation`、`background`、`cg`、`bgm`；`type` 表示加载器媒体类型；
- `variants` 保存同一逻辑资源的缩略图、低清或其他派生版本，画廊缩略图不创建第二个 CG ID；
- `bundle` 是预载、卸载和发布分组，不改变稳定 ID；
- `sha256` 是完整性和不可变文件名依据，COS multipart ETag 不能替代它；
- `source` 与 `license` 记录来源和使用边界，运行时可以忽略，发布审计不得删除。

JSON 看起来比直接写 URL 更长，是因为它同时承担可移植交换格式和构建输入。创作者通常只维护 `id`、`kind`、`type`、`path` 与必要语义；Studio/导入器补齐 MIME、尺寸，发布流程补齐 `objectKey`、哈希与字节数。不要为了缩短 JSON 删除稳定 ID 或把路径重新散落到内容文件中。

## 内容引用

场景卡：

```md
---
id: summer-room
name: 盛夏房间
assetId: background/summer-room
---
```

音频卡：

```md
---
name: summer-day
assetId: bgm/summer-day
duration: 24
---
```

画廊设置：

```json
{
  "gallery": {
    "items": [
      { "id": "finale", "assetId": "cg/finale", "chapterId": "chapter-16" }
    ]
  }
}
```

标题、原图、缩略图、替代文本和哈希从资源目录投影。旧项目的 `src` 和绝对 URL 仍可读取，新内容统一使用 `assetId`。

## 构建、发布与迁移

1. Studio 导入媒体时先写二进制文件，再更新分片，最后原子更新 `adv/assets.json`；
2. 构建器校验根模式、分片边界、重复 ID、未知 Bundle、缺失文件、MIME、尺寸和哈希，并在构建输出生成扁平目录；
3. 发布工具生成内容寻址对象与 `cos-release.json`，先上传不可变对象，最后上传稳定 manifest；
4. Schema v1 的 `publicBaseUrl` 与每项绝对 `url` 保持只读兼容；旧的嵌套索引由 Studio 读取，并在下一次资源写入时迁移到单一根文件。

详细架构取舍见[资源系统设计](/about/design/assets)，发布目录与缓存规则见 [COS 存储与发布规范](./cos)。

参考：[Unity Addressables](https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/AddressableAssetsOverview.html)、[Godot 导入流程](https://docs.godotengine.org/en/latest/tutorials/assets_pipeline/import_process.html)、[Cocos Asset Bundle](https://docs.cocos.com/creator/3.8/manual/en/asset/bundle.html)。
