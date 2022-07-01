---
title: Doki Doki Love
characters:
  - name: 小云
    actor: 小云
    avatar: 'https://fastly.jsdelivr.net/gh/YunYouJun/yun/images/meme/yun-good-alpha-compressed.png'
    tachies:
      default:
        src: 'https://fastly.jsdelivr.net/gh/YunYouJun/yun/images/yun-alpha-compressed.webp'
        style:
          transform: scale(1) translateY(5%)
  - name: 云游君
    actor: 云游君
    tachies:
      default:
        src: 'https://fastly.jsdelivr.net/gh/advjs/assets@main/img/characters/he.png'
        style:
          transform: scale(0.7) translateY(-20%)
bgm:
  autoplay: true
  collection:
    - name: xxx
      src: 'https://fastly.jsdelivr.net/gh/YunYouJun/cdn/audio/star-timer.mp3'
---

小云：Hello～

```json
{
  "type": "tachie",
  "enter": [
    {
      "name": "小云"
    }
  ]
}
```

小云：嘿嘿嘿

```json
{
  "type": "tachie",
  "enter": [
    {
      "name": "云游君"
    }
  ]
}
```

我：早 可恶啊！

小云：早

小云：我喜欢你

```ts
console.log('OHHHHHHH！')
```

- [ ] 好的！

  ```ts
  $adv.nav.next()
  ```

- [ ] 抱歉…… `do2`

  ```ts
  $adv.nav.next()
  ```

小云：希望你每天都开心

```yaml
type: background
url: /img/bg/stacked-steps-haikei.svg
```

小云：哼哼哼

小云：嘻嘻嘻

未完待续
