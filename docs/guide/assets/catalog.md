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

## 从远端还原本地缓存

Node CLI 提供 `adv assets pull`、`adv assets status` 和 `adv assets verify`。它们消费同一个内联或分片 `adv/assets.json`，不创建第二份媒体清单。`@advjs/assets` 只提供平台无关的下载规划与校验元数据；文件、网络和凭据由 CLI 与存储插件处理，浏览器目录解析器不执行下载。

```bash
adv assets pull                          # 仅基础条目，通常是运行或编辑用预览
adv assets pull --variant original       # 仅原图，显式按需下载
adv assets pull --originals              # 基础条目和 original 一起下载
adv assets status --all-variants         # 查看全部缓存；允许缺失，报告损坏
adv assets verify                       # 要求基础条目齐全并通过校验
adv assets verify --variant original     # 要求原图齐全并通过校验
adv assets pull --root ./my-game --json  # 单个机器可读 CLI envelope
```

`--variant` 可重复；`default` 表示基础条目而非实际命名 variant。`--variant`、`--originals`、`--all-variants` 互斥。没有声明某种 variant 的条目跳过该 variant；整个目录都没有该名称时报错。`status` 的缺失和损坏数属于查询结果，退出码仍为 0；`verify` 或 `pull` 遇到损坏缓存返回失败并保留文件。先将损坏文件移出缓存，再重新拉取。

例如私有 COS 的作者原图与轻量预览可以共用一个资源 ID：

```json
{
  "schemaVersion": 2,
  "id": "my-game",
  "defaultProfile": "local",
  "profiles": { "local": { "provider": "project", "root": "adv/assets" } },
  "download": {
    "profile": "local",
    "source": { "provider": "tencent-cos", "bucket": "my-assets-1234567890", "region": "ap-shanghai" }
  },
  "assets": [{
    "id": "background/opening",
    "kind": "background",
    "type": "image",
    "path": "backgrounds/opening.webp",
    "objectKey": "private/my-game/previews/opening.webp",
    "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "bytes": 245760,
    "variants": {
      "original": {
        "cachePath": ".advjs/originals/opening.png",
        "objectKey": "private/my-game/originals/opening.png",
        "sha256": "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
        "bytes": 2097152
      }
    }
  }]
}
```

基础条目下载到 `profiles.local.root + path`；`cachePath` 是项目根目录相对路径，优先用于 Node 缓存，不改变浏览器的 `path` 解析。作者原图只声明 `cachePath`，不会因为下载到 `.advjs/` 就成为运行时图片。所有选中条目必须有完整 SHA-256、正整数 `bytes` 和本地坐标；缺失缓存还需要 `download.source` 和 `objectKey`。只有缓存校验的 `status`、`verify` 和离线复用不需要存储插件或凭据。

HTTP/CDN 下载可配置 `download.source: { "provider": "http", "baseUrl": "https://cdn.example.com/" }`，对象键相对此目录解析。新清单不保存签名 URL；源地址不能包含账号口令、查询参数或片段。下载器拒绝越界坐标、重复缓存位置和缓存符号链接；流式下载核对字节数与哈希后独占安装，不覆盖并发创建的文件，失败时清理临时文件。图片、音频、视频等均按字节处理，不执行转码。

把二进制缓存目录加入项目 `.gitignore`；分片 JSON 如果位于该目录，需要单独保留跟踪规则。当前原生 `build`/`editor` 不隐式拉取，请先运行 `adv assets pull`，或像三国项目一样在项目启动包装器中调用它。私有 COS 鉴权见 [COS 存储规范](./cos)。

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

## Codex 本地生成工作流

场景包含 `imagePrompt` 后，可以在安装 ADV.JS Skills 与 MCP 的 Codex 环境中使用：

```bash
adv assets plan --scene summer-room --json
```

候选仅保存在 Git 忽略的 `.adv/generated/`，导入候选不会修改正式目录。只有用户预览并明确确认后，`adv assets accept --confirm` 才会写入内容哈希文件、资源清单、场景 `assetId` 和 `adv/generations/{taskId}.json` 回执。拒绝和重试不会污染正式资源。

Editor 通过 `adv editor .` 的本地桥接提供 Codex 就绪状态、任务提示复制、外部变更刷新和本地资源预览；它不内嵌 Codex 或重复实现 Agent。完整阶段边界与云端延期事项见 [Codex 资产工作流与云端 Agent 路线图](/superpowers/specs/2026-08-13-codex-asset-workflow-roadmap)。

详细架构取舍见[资源系统设计](/about/design/assets)，发布目录与缓存规则见 [COS 存储与发布规范](./cos)。

## 已确认的音频扩展

多轨音频与 AI 配音会在下一次破坏性 Asset Catalog 升级中使用同一个资源根，并增加：

- `bgm`、`ambience`、`voice`、`sfx`、`ui` 五类音频资产；
- 独立的 `adv/audio/voice-ledger.json`，保存全部生成 take 与创作元数据；
- 运行时 `adv/assets/audio.json` 分片，只暴露最终选中的可播放资产；
- `lineId + locale + selectedTake` 的稳定语音绑定；
- 禁止剧情、角色卡和 Flow 节点直接写入 `src` 或 Provider URL。

创作账本与运行时目录不会合并成一个文件：前者用于生成审计和版本选择，后者保持最小、可发布。完整目标协议见[音频系统设计](/superpowers/specs/2026-08-12-audio-system-design)和[音频创作指南](/guide/audio)。在实施计划完成前，本节不代表当前 Schema v2 已经支持这些字段。

参考：[Unity Addressables](https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/AddressableAssetsOverview.html)、[Godot 导入流程](https://docs.godotengine.org/en/latest/tutorials/assets_pipeline/import_process.html)、[Cocos Asset Bundle](https://docs.cocos.com/creator/3.8/manual/en/asset/bundle.html)。
