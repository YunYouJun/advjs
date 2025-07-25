# 基础配置

::: tip
文档正在编写中……

您可以先参考 [advjs/packages/types/src/config.ts](https://github.com/YunYouJun/advjs/blob/main/packages/types/src/config.ts)。
:::

在项目目录下创建 `adv.config.ts`。

```ts
import { defineAdvConfig } from 'advjs'

export default defineAdvConfig({
  gameConfig: {
    title: 'Your Game',
    characters: [
      {
        name: '小云',
        actor: '小云',
        avatar: 'https://fastly.jsdelivr.net/gh/YunYouJun/yun/images/meme/yun-good-alpha-compressed.png',
        tachies: {
          default: {
            src: 'https://fastly.jsdelivr.net/gh/YunYouJun/yun/images/yun-alpha-compressed.webp',
            style: {
              transform: 'scale(1) translateY(5%)'
            }
          }
        }
      }
    ]
  }
})
```

```md
@小云
你好呀！
```
