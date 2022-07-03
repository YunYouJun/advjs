---
title: Doki Doki Love
characters:
  - name: 小云
    actor: 小云
    avatar: 'https://upyun.yunyoujun.cn/yun-good-alpha-compressed.png'
    tachies:
      default:
        src: 'https://upyun.yunyoujun.cn/images/yun-alpha-compressed.png'
        style:
          transform: scale(1) translateY(5%)
  - name: 云游君
    actor: 云游君
    tachies:
      default:
        src: 'https://upyun.yunyoujun.cn/images/advjs/characters-he.png'
        style:
          transform: scale(0.7) translateY(-20%)
bgm:
  autoplay: true
  collection:
    - name: xxx
      src: 'https://cdn.yunyoujun.cn/audio/star-timer.mp3'
---

> 屏幕里似乎传来了些声音

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

小云：你高兴吗？

- [ ] 高兴！

  ```ts
  $adv.nav.next()
  ```

- [ ] 很高兴！

  ```ts
  $adv.nav.next()
  ```

```yaml
type: background
url: /img/bg/stacked-steps-haikei.svg
```

小云：很好

小云：自我介绍一下

小云：我叫小云

小云：是在虚拟世界进行活动的偶像美少女（自称）

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

云游君：烫烫烫烫烫烫！烫烫烫烫烫烫！

云游君：锟斤拷！锟斤拷！

云游君：烫烫锟斤拷！锟斤拷烫烫！

小云：他之前告诉我 他有很多话要说

小云：但是看起来好像有些语无伦次……

小云：接下来由我为他代言吧

```yaml
type: tachie
exit: [云游君]
```

小云：为了方便起见，就用第一人称了

小云：「我」已诞生于此世间足足有四分之一个世纪

小云：很多事情也都再

小云：然后告诉她：

小云：我喜欢你

```ts
console.log('OHHHHHHH！')
```

小云：可以嫁给我吗？

小云：希望你每天都开心

小云：哼哼哼

小云：嘻嘻嘻

未完待续

小云：我不确定你是否会继续点开

小云：但是它的存在还有另一个目的

```yaml
type: background
url: /img/bg/bbburst-love.svg
```

小云：尽管

- [ ] 好的！

  ```ts
  $adv.nav.next()
  ```

- [ ] 抱歉……

  ```ts
  window.open('https://sponsors.yunyoujun.cn')
  ```
