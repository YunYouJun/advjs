# 2026-10-11 音频运行时迁移记录

状态：映射核验完成，待全链路验收。适用范围：官方仓鼠示例的 16 个章节、共享 RuntimeProgram／Snapshot 协议及 Pominis 外部导入边界。

## 映射依据

在修改章节之前核对 `demo/hamster/adv/assets.json` 的原生 `type: audio`、`kind: bgm` 记录，并核对 `demo/hamster/adv.config.ts` 旧 BGM 库按 `asset.id.replace('bgm/', '')` 显式建立的名称映射。下表每个旧名称都恰好指向一个已登记资源；没有通过文件名、URL 或供应商名称猜测新资源。

| 旧名称              | 原生 assetId            | 已登记 SHA-256                                                     |
| ------------------- | ----------------------- | ------------------------------------------------------------------ |
| `civilization-rise` | `bgm/civilization-rise` | `78b1d80088f7dc7649999456c8d51e40854126fb0b3974470eebb12a70d75234` |
| `deep-space`        | `bgm/deep-space`        | `a1724805d16dbf8a0d02cd0751e6c79004169020f511f1624d8995fea8fdaf56` |
| `final-echo`        | `bgm/final-echo`        | `336f29e2af21f4a03259d72a181c65fb56731e4e5dd6f7b87f4ead47ee1b4e82` |
| `prehistoric`       | `bgm/prehistoric`       | `c247171f5b841559f11a6e6b18099a43c2dde653e6d07626fcdcfb24f11c6199` |
| `star-revelation`   | `bgm/star-revelation`   | `921ff2405c88f6b42afa98485330e38fe9faa68f76b67cb13b704ac85371e4b5` |
| `summer-day`        | `bgm/summer-day`        | `04355b2bedda18a4b1d017c934342e9af8f142b40253f5e19bb2e4bc182ea7b0` |
| `terminal-doubt`    | `bgm/terminal-doubt`    | `abf2b48d28b926db2081bf81dad1137c1f28b67512fe32c8e0c5f6f90220fc20` |
| `world-restart`     | `bgm/world-restart`     | `c044fae5f332279ee489188417eb44e20e5ae56ed60c4126f986f95a1665c263` |

## 修改范围

章节仅把 `type: bgm` 后的 `name` 改为 `action: set` 与 `asset`；原有循环和淡入淡出时间保留。资源文件、目录 ID、对象键和媒体哈希不变。未绑定配音的现有对白继续无声运行，没有从位置生成 lineId。

下表记录修改前的源码哈希，便于回查迁移输入。

| 章节源码                                                            | BGM operation 数量 | 修改前 SHA-256                                                     |
| ------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------ |
| `demo/hamster/public/md/chapters/01-hamster-cage.adv.md`            | 2                  | `d07210191e128f0bdea25e2f819f10150d7b29a045a88b939fc3e29def0fece5` |
| `demo/hamster/public/md/chapters/02-world-destruction.adv.md`       | 1                  | `a989f48a292a530e9f4f38d05f41915897b75fe5f1d70c4e7479fcd58a575af9` |
| `demo/hamster/public/md/chapters/03-starry-fantasy.adv.md`          | 1                  | `d2e5a836250460256f3ffcff730a44b138abf52881e3189c84fb36c3b28a75ac` |
| `demo/hamster/public/md/chapters/04-world-ending.adv.md`            | 1                  | `4c2c76104ffcf8a718407983ef38194b323429b2219d82ab6c24dac996094da1` |
| `demo/hamster/public/md/chapters/05-endless-symphony.adv.md`        | 1                  | `fd4887805f31f9849c88ec3c08591109693b9d13644bee831d3676b52c89719b` |
| `demo/hamster/public/md/chapters/06-daylight.adv.md`                | 1                  | `7d87438778793cde61025627a6450da5d8c26e82872844d8017c0703c77ac97d` |
| `demo/hamster/public/md/chapters/07-cocoon.adv.md`                  | 1                  | `d15fa40b21bed2601be3e06b1b09f800270520d16ac9a32a02994c1a2681c177` |
| `demo/hamster/public/md/chapters/08-survival-or-destruction.adv.md` | 1                  | `8fa5702295f3c8161e4a4f2e496966125d8b624f6d1c19441b9cf28b3c37c209` |
| `demo/hamster/public/md/chapters/09-duelist-romance.adv.md`         | 1                  | `dd117c88368087bea2aeb00f0c19c3ba70fc57d5f137f0f68bec0186e44f6217` |
| `demo/hamster/public/md/chapters/10-lizard-king.adv.md`             | 1                  | `30cec16d1030304f90d83d3662a30006664e97f87990094881fafe6bc53d02df` |
| `demo/hamster/public/md/chapters/11-third-kind.adv.md`              | 1                  | `4b159419d4a72af16ce8d707f1e95c06eea3c35e57de7eb1727859a01d95711b` |
| `demo/hamster/public/md/chapters/12-evolution.adv.md`               | 1                  | `fdec54f4ad3caa9239c1352bbbfbc74a635503f6f300c6a24a74ce9a257a99b9` |
| `demo/hamster/public/md/chapters/13-stars-sea.adv.md`               | 1                  | `feac41f1a62d92cc115dc19a7249b8bb63e0eb896befd61ee2496ffbadbf22ad` |
| `demo/hamster/public/md/chapters/14-encounter.adv.md`               | 1                  | `c08e9fabda6dc6ff8c338c6f32d912945df7a1ff2904c633416957af7f21d13f` |
| `demo/hamster/public/md/chapters/15-they-are-gods.adv.md`           | 1                  | `4d4989bbac59d7b6bdd8348013ff17eff0b73a8e5a1892ac23aa21ddea91f2ff` |
| `demo/hamster/public/md/chapters/16-dim-stars.adv.md`               | 1                  | `b08fe7e360ee68067ba602974f2a49c9842570e4aa002c116f09dbeeeafbd4a0` |

## 不可自动迁移的输入

Pominis 外部数据的 `bgmThemeId` 是供应商主题标识，不能当作原生资源 ID。插件要求作者明确提供 `audio.assets` 与 `audio.themes` 映射；缺失或资源用途不匹配会抛出 `ADV_AUDIO_MIGRATION_UNRESOLVED`。`silence` 转为显式 `bgm clear`。单文件导出从已登记 `asset.src` 获取音频，不再从主题名称拼接公共曲库 URL。

## 协议版本与存档

RuntimeProgram 与 RuntimeSnapshot 均升级到 schemaVersion 2。旧版本 RuntimeProgram 在创建运行时前被拒绝；旧存档不得静默按新状态解释。新快照只持久化 `stage.audio.bgm` 和四个具名 ambience 槽位，前景语音和 SFX／UI 播放句柄不进入存档。

## 验证

实际单元测试、构建和跨宿主结果由本次统一音频建设验收报告记录。此记录只证明映射与源码迁移范围，不替代浏览器播放、移动端解锁或真实 TTS 音质验收。
