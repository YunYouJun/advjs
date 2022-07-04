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
assets:
  background:
    love: /img/bg/bbburst-love.svg
---

> 屏幕里似乎传来了些声音

小云：Hello～

```yaml
type: tachie
enter: 小云
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

```yaml
type: tachie
enter: 云游君
```

云游君：烫烫烫烫烫烫！烫烫烫烫烫烫！

云游君：锟斤拷！锟斤拷！

云游君：烫烫锟斤拷！锟斤拷烫烫！

小云：他之前告诉我 他有很多话要说

小云：但是看起来好像有些语无伦次……

小云：接下来由我为他代言吧

```yaml
type: tachie
exit: 云游君
```

小云：为了方便起见，就用第一人称了

小云：让我来看看稿子

小云：「我」已诞生于此世间足足有四分之一个世纪

小云：（小云是二十分之一）

小云：同样也几乎走完了人生道路中最重要的四分之一

小云：时至今日，原本某些柔软的东西也像胡茬一样开始变得硬邦邦的，再也无法逆转。

小云：在过去的几年
「我」的想法和人生发生了很多改变

小云：「我」遇到了一些无法预测的人和事
也做了些或庆幸或后悔的决定

小云：「假如当时选择了别的道路，现在的我会是什么样？」

小云：「我」不止一次又一次地询问自己
并幻想平行世界中自己的现状

小云：人生就像是玩文字冒险游戏

- 选择 A
- 选择 B
- 选择 C

小云：做着一个又一个的选择
最后迎来自己所决定的结局

小云：「四叠半神话大系」中的「我」在每话开始都会以“过着有如玫瑰色的校园生活”为期许
在假设的平行世界中参加各式各样的社团
但加入后都会以“我总是一个无可救药的大笨蛋”开头
最后用“我后悔我自己在命运的钟塔前选了○○社团“作结

小云：所以「我」想人生总是充满着懊悔与遗憾

小云：但「我」在动画里听过这样一句台词

- 不做而后悔
- 做了再后悔

小云：「与其不做而后悔，不如做了再后悔」

小云：因此「我」想试试说一句一直想说看看的台词
并向「我」的校园生活告别

```yaml
type: background
name: love
```

小云：我喜欢你

小云：或许这种话应该由本人来说更好？

```yaml
type: tachie
enter: 云游君
```

云游君：�������

小云：看起来还没有好转

云游君：等一下……

小云：真是拐弯抹角呢

云游君：你愿意出演「我」人生的轻小说女主角吗？

- 好
- 抱歉

云游君：烫烫烫烫烫烫烫

```yaml
type: tachie
exit: 云游君
```

小云：他脸皮还是太薄了

小云：接下来还是交给我吧

小云：我也不清楚你是否会一直看到这里
以及做出了怎样的选择

小云：但如果有什么想说的可以直接告诉他

小云：不管怎么样，我想他也是终于鼓起勇气对过去的校园生活做了告别/告白

小云：「四叠半」中的「我」最终总会与明石相遇
但是小说终归是小说，动画终归是动画

小云：人生也不会像文字冒险游戏一样可以存档读档，二次修正

小云：当一个决定作出后，总会有这样那样遗憾的事情

小云：过去所有的人与事就如同正向动力学中的骨骼解算
连续的关节依次计算出了如今的「自己」

小云：不同节点的偏差与蝴蝶效应可能会导致端点的「自己」大相径庭

小云：但人生的目标确是大抵一致的，比如不想上班
比如可以惬意的生活和做喜欢的事情
以及喜欢的人天天都开心

小云：所以
新的一天也要加油鸭！

Q.E.D.
