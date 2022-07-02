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

小云：很高兴见到你

- [ ] 好的！

  ```ts
  $adv.nav.next()
  ```

- [ ] 抱歉……

  ```ts
  window.open('https://sponsors.yunyoujun.cn')
  ```

小云：我叫小云

小云：是在虚拟世界进行活动的偶像（自称）

<!-- ~~偶像~~ -->

小云：旁边的这位是我的合作伙伴——云游君

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

我：烫烫烫烫烫烫！

我：不是乱码，是 mac 烫！

我：Hello!!! 我是云游君！

我：很高兴见到大家！

我：但是我不知道说啥，所以就请小云代言了！

```json
{
  "type": "tachie",
  "exit": ["云游君"]
}
```

小云：大概就是这样，那么它可以用来做什么呢？

小云：做一个向喜欢的人告白的网页吧！

小云：骗她打开网页。

小云：然后告诉她：

小云：我喜欢你

```ts
console.log('OHHHHHHH！')
```

小云：可以嫁给我吗？

小云：希望你每天都开心

```yaml
type: background
url: /img/bg/stacked-steps-haikei.svg
```

小云：哼哼哼

小云：嘻嘻嘻

未完待续

小云：我不确定你是否会继续点开

小云：但是它的存在还有另一个目的

小云：尽管
