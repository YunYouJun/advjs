---
title: 仓鼠的笼子
---

<!-- source:hamster/hamster-cage -->

## 夏日午后 {#summer-afternoon}

<!-- scene: summer-room / 午后 / 内景 -->

```yaml
type: background
name: summer-room
transition:
  name: crossfade
  duration: 900
```

```yaml
type: bgm
name: summer-day
loop: true
fade:
  in: 1000
  out: 700
```

```yaml
type: tachie
enter:
  - name: 观测者
    status: curious
    position: right
    motion: slide-right
  - name: 小仓鼠
    status: running
    position: 58
    scale: 0.42
    motion: hop
```

> 冷气把盛夏挡在玻璃幕墙之外。观测者喂着一只毛茸茸的小仓鼠，读书人仍埋在书页里。

```yaml
type: tachie
enter:
  - name: 读书人
    status: default
    position: left
    motion: slide-left
```

@观测者
你说，世界上真的有外星人吗？

@读书人
人类如此渺小，外星生命当然可能存在。只是眼见未必能抵达它们。

> 观测者把小仓鼠放上转轮。它哒哒地跑起来，仿佛也在追逐两米视野之外的世界。

@观测者
既然总有科技比我们早一步的文明，为什么它们还没有乘着魔法般的飞船来到这里？

@读书人
地球上尚有许多未见的生物。我宁愿在午后读前人的幻想，也不想闯进未知的动物世界。

> 墙幕亮起《动物世界》的重播。突然的光与声令仓鼠发抖；读书人提醒她，仓鼠只能分辨近处的灰度，却对嘈杂格外敏感。

- [调低音量，先照顾仓鼠](#observers)

  ```yaml
  id: lower-volume
  actions:
    - type: variables/increment
      key: empathy
      by: 1
  ```

- [记下“被观察者”的反应](#observers)

  ```yaml
  id: record-reaction
  actions:
    - type: variables/increment
      key: curiosity
      by: 1
    - type: variables/increment
      key: observationCount
      by: 1
  ```

## 观察者 {#observers}

@读书人
这更像人类单方面的偷窥。也许你期待的外星人正隐蔽地观察我们，而我们像屏幕里的动物一样毫无察觉。

@观测者
那我们安稳活到现在真是幸运。要是哪家外星人的野孩子闯进来，人类岂不是会被当玩具拿捏？

@读书人
发现新奇生物，更可能划出保护区。可若那保护只是畜牧或种植，科技飞跃是施肥，文明成长是催熟——收割季节又会发生什么？

@观测者
这么了解，难道你就是观察员？

> 读书人只笑了笑，没有回答。漏斗里的沙粒落尽，小仓鼠也在饭后睡去。

@读书人
谢谢款待。

@观测者
请等一下。明天务必再来，我有一个秘密要告诉你。

```yaml
type: tachie
enter:
  - name: 观测者
    status: determined
    position: right
    motion: emphasis
  - name: 读书人
    status: curious
    position: left
  - name: 小仓鼠
    status: sleepy
    position: 58
    scale: 0.42
```

> 他惊讶片刻，还是点头。夕阳穿过单向玻璃，为屋内染上与笑容相似的暖色。

@读书人
我也有。

> 观测者按住加快的心跳，在日历上标下世界毁灭的倒计时。

- [赴第二天的约定](world-destruction#starry-room)

  ```yaml
  id: continue-to-world-destruction
  ```

## 回声演算 {#echo-simulation}

<!-- scene: starfield-room / 演算时间未定义 / 内景 -->

```yaml
type: background
name: starfield-room
transition:
  name: dissolve
  duration: 1200
```

```yaml
type: actions
actions:
  - type: variables/set
    key: storyMode
    value: echo
```

```yaml
type: bgm
name: final-echo
loop: true
fade:
  in: 1200
  out: 900
```

```yaml
type: tachie
enter:
  - name: 观测者
    status: determined
    position: right
    motion: slide-right
  - name: 读书人
    status: default
    position: left
    motion: slide-left
exit:
  - 小仓鼠
```

> 观测者把工作站切入低功耗沙盒。第四十三组参数从记忆结晶里展开：这一次，星图可以由他们亲手校准。

```yaml
type: activity
use: star-map/compare
input:
  stars: 7
  hint: 对齐最明亮的三颗星
```

```yaml
type: when
condition: starMatched && starMatchScore >= 0.82
```

> 星点完全重合。演算沿着新的轨迹稳定下来，黑域边缘第一次出现可供航行的微光。

```yaml
type: when
condition: '!starMatched || starMatchScore < 0.82'
```

> 星点仍有误差。观测者保留了偏差：世界并不需要重复某次答案，也能继续运转。

- [把星光交还给仍在仰望者](#ending-still-gazing)

  ```yaml
  id: unlock-still-gazing
  actions:
    - type: variables/set
      key: ending
      value: still-gazing
    - type: variables/push-unique
      key: unlockedEndings
      value: still-gazing
  ```

- [把宇宙固定为永不出错的转轮](#ending-endless-wheel)

  ```yaml
  id: unlock-endless-wheel
  actions:
    - type: variables/set
      key: ending
      value: endless-wheel
    - type: variables/push-unique
      key: unlockedEndings
      value: endless-wheel
  ```

- [只记住那只普通仓鼠](#ending-common-hamster)

  ```yaml
  id: unlock-common-hamster
  actions:
    - type: variables/set
      key: ending
      value: common-hamster
    - type: variables/push-unique
      key: unlockedEndings
      value: common-hamster
  ```

## 仍在仰望 {#ending-still-gazing}

> 星图没有许诺答案。好奇与善意却使黑暗之外始终保留方向。

- [结束本次演算](#echo-end)

  ```yaml
  id: close-still-gazing
  ```

## 无尽转轮 {#ending-endless-wheel}

> 每一次稳定记录都复制上一次选择。世界安全、精确，也再没有意外。

- [结束本次演算](#echo-end)

  ```yaml
  id: close-endless-wheel
  ```

## 普通仓鼠 {#ending-common-hamster}

> 它活过、忘记，又把一点记忆交给后来者。普通因此不再等于徒劳。

- [结束本次演算](#echo-end)

  ```yaml
  id: close-common-hamster
  ```

## 演算结束 {#echo-end}

> 星图缓缓熄灭。这次回答被收进一颗小小的记忆结晶。
