# 仓鼠 Demo 素材来源清单

最后核验：2026-08-01。本清单记录 Demo 直接使用的非软件内容，不替代权利人的许可文件。

| 使用位置                                       | 来源与作者                                                                                                                 | 许可                                                                         | 状态与备注                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `public/md/chapters/01-*.adv.md`—`16-*.adv.md` | YunYouJun，《[仓鼠](https://www.yunyoujun.cn/posts/hamster)》《[仓生](https://www.yunyoujun.cn/posts/the-common-hamster)》 | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh) | 正文整理为单一完整航线；前言、后记与作者说明不进入可玩剧情 |
| `adv/assets.json` 中 15 张背景                 | 按 `adv/art-bible.md` 与场景卡生成的深蓝、琥珀、青色科幻视觉小说背景                                                       | CC BY-NC-SA 4.0                                                              | WebP、16:9、无前景人物；模型、日期、尺寸与 SHA-256 见清单  |
| `adv/assets.json` 中 28 张角色差分             | 按角色卡生成的观测者、读书人、小仓鼠、巴、探索王与仓鼠军官立绘                                                             | CC BY-NC-SA 4.0                                                              | 连通区域抠图；五底色 alpha QA；观测者不戴眼镜              |
| `adv/assets.json` 中 8 张 CG 与缩略图          | 按关键场面和统一镜头语言生成                                                                                               | CC BY-NC-SA 4.0                                                              | 原图 1536×1024；独立缩略图；画廊使用稳定 CG ID             |
| `adv/assets.json` 中仓鼠六帧动画               | 以现有仓鼠形象生成并由 `scripts/prepare-media.mjs` 统一锚点、体积和阴影                                                    | CC BY-NC-SA 4.0                                                              | 6×512×512 水平 spritesheet，10 FPS 循环                    |
| `adv/assets.json` 中 8 首 BGM                  | `scripts/generate-bgm.mjs` 以确定性加法合成生成的 8 首原创主题动机                                                         | CC BY-NC-SA 4.0                                                              | 24 秒、双声道 OGG；归一化峰值与周期接缝                    |
| `public/favicon.svg`                           | [Remix Icon](https://github.com/Remix-Design/RemixIcon) `video-chat-line`                                                  | [Apache-2.0](https://github.com/Remix-Design/RemixIcon/blob/v2.5.0/License)  | 已确认                                                     |

本 Demo 未使用下载的第三方图片、角色立绘或音乐。新增内容至少记录仓库路径或 URL、作品名与作者、原始来源、明确许可、核验日期，以及裁剪、翻译或改色等修改；来源或许可未确认的素材不进入演示路径。

正式素材使用 `https://cos.advjs.yunle.fun/games/hamster/v1/` 前缀和带内容哈希的不可变文件名。角色、动画、背景、CG 与 BGM 的逻辑 ID、SHA-256、尺寸/时长、生成版本和许可均由 `adv/assets.json` 记录；`adv/cos-release.json` 精确列出 69 个当前发布对象、HTTP 元数据和 manifest-last 顺序，避免上传临时目录中残留的旧哈希。开发服务器可从 `temp/hamster-art/release-current/` 映射同一对象键；COS 密钥、临时令牌、可编辑原图和未采用生成图均不进入仓库或 Skill。

Git 仅保存剧情、配置、素材清单、许可、提示与可复现生成/处理脚本；游戏图片、动画和音频成品均从 COS 加载。生成脚本只把中间产物与待发布文件写入已忽略的 `temp/hamster-art/`，`demo/hamster/public/` 不保存游戏媒体副本。

2026-08-01 已按发布计划核对 68 个带哈希资源，补齐 8 首最终 BGM，并最后覆盖稳定 manifest。同时将公共桶 CORS 收紧为匿名 `GET/HEAD`、预检 Max-Age 86400，并暴露 catalog 审计所需头；补齐了每个 BGM 的 `advjs-id` 与 SHA-256 元数据。EdgeOne 仅因这次整体响应头策略修正执行了一次 `games/hamster/v1/` 目录缓存直接清除，未删除 COS 对象。

69 个当前对象现均通过 `assets:audit:remote`：公开自定义域名的完整 GET SHA-256、identity HEAD 字节数、MIME、缓存语义、逐对象 checksum 元数据、GET/HEAD 暴露头与 OPTIONS 预检校验全部为空错误列表。哈希资源保持一年 immutable，manifest 保持 60 秒并强制重新验证。旧哈希对象保留供已有缓存和历史构建使用，不被当前清单引用，也不在发布时破坏性删除。
