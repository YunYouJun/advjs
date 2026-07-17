# 仓鼠 Demo 素材来源清单

最后核验：2026-07-17。本清单记录 Demo 直接使用的非软件内容，不替代权利人的许可文件。

| 使用位置                                                          | 来源与作者                                                                           | 许可                                                                         | 状态与备注                                                   |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `public/md/chapters/01-*.adv.md`—`06-*.adv.md`                   | YunYouJun，《[仓鼠](https://www.yunyoujun.cn/posts/hamster)》                        | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh) | 已确认；完整章节改编、重新编排并增加汇合式交互               |
| `public/md/chapters/07-*.adv.md`—`19-*.adv.md`                  | YunYouJun，《[仓生](https://www.yunyoujun.cn/posts/the-common-hamster)》             | CC BY-NC-SA 4.0                                                              | 已确认；完整章节改编；A+ 演绎路线在脚本中明确标注为非原作    |
| `public/img/bg/*.svg`                                             | 本 Demo 以源码形式新绘制的靛蓝/琥珀色抽象场景                                        | CC BY-NC-SA 4.0                                                              | 已确认；无嵌入或远程图片                                     |
| `public/img/characters/*.svg`                                     | 本 Demo 以源码形式新绘制的观测者与仓鼠立绘                                           | CC BY-NC-SA 4.0                                                              | 已确认；无真人肖像或第三方角色素材                           |
| `public/audio/observatory.wav`                                    | 由 `scripts/generate-ambient.mjs` 以固定种子、正弦波与程序噪声生成                   | CC BY-NC-SA 4.0                                                              | 已确认；12 秒、22,050 Hz、单声道、16-bit PCM，可确定性再生成 |
| `public/favicon.svg`                                              | [Remix Icon](https://github.com/Remix-Design/RemixIcon) `video-chat-line`            | [Apache-2.0](https://github.com/Remix-Design/RemixIcon/blob/v2.5.0/License)  | 已确认                                                       |

本 Demo 未捆绑下载的第三方图片、角色立绘或音乐。新增内容至少记录仓库路径或 URL、作品名与作者、原始来源、明确许可、核验日期，以及裁剪、翻译或改色等修改；来源或许可未确认的素材不进入演示路径。

后续生成的正式角色与场景图片使用 `https://cos.advjs.yunle.fun/games/hamster/v1/` 前缀和带内容哈希的不可变文件名，并由 `adv/assets.json` 记录 SHA-256、尺寸、生成来源与许可。COS 密钥、临时令牌和未发布原图不进入仓库或 Skill。
